/*
    #-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=#
      This file is part of the Smart Developer Hub Project:
        http://www.smartdeveloperhub.org/
      Center for Open Middleware
            http://www.centeropenmiddleware.com/
    #-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=#
      Copyright (C) 2015 Center for Open Middleware.
    #-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=#
      Licensed under the Apache License, Version 2.0 (the "License");
      you may not use this file except in compliance with the License.
      You may obtain a copy of the License at
                http://www.apache.org/licenses/LICENSE-2.0
      Unless required by applicable law or agreed to in writing, software
      distributed under the License is distributed on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
      See the License for the specific language governing permissions and
     limitations under the License.
    #-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=#
*/

"use strict";

var Bridge = require('./PhantomBridge');

function WidgetSnapshotProvider (id, timeout) {
    this.id = id;
    this.timeout = timeout;
    this.creationDate = new Date();
    this.isReady = false;
    this.bridge = null;
    this.currentJob = null;
    this.currentJobs = 0;
    this.timeoutId = null;
}

WidgetSnapshotProvider.prototype = {
    constructor: WidgetSnapshotProvider

    /**
     * Initialize the web capturer.
     * @param onReady
     */
    , init: function(requireJsWidgetList, api_url, onReady) {

        if(typeof onReady !== 'function') {
            throw new Error(this.msg('A callback function must be specified in "init" method.'));
        }

        this.bridge = new Bridge(this.id);
        this.bridge.initFramework(requireJsWidgetList, api_url, phantomWebMessageHandler.bind(this), onReady);


    }

    , destroy: function() {

        this.isReady = false;
        this.bridge.close();
        this.bridge = null;

    }

    , getCreationDate: function() {
        return this.creationDate;
    }

    , isReady: function() {
        return this.isReady;
    }

    , getChartImage: function(chart, viewPort, metrics, config, onImageReady, onError) {

        if(typeof onImageReady !== 'function')
            throw new Error(this.msg('A onImageReady function must be specified in "getChartImage" method.'));

        if(this.currentJob != null) {
            throw new Error(this.msg('The WidgetSnapshotProvider instance is busy!'));
        }

        this.currentJob = {
            chart: chart,
            metrics: metrics,
            config: config,
            onImageReady: onImageReady,
            onError: onError
        };

        //Set the viewport
        this.bridge.getPage().viewportSize = viewPort;

        //Set the clipRect to be sure that the image generated is of the size we want
        this.bridge.getPage().clipRect = {
            top: 0,
            left: 0,
            width: viewPort.width,
            height: viewPort.height
        };

        //Load the chart in the web executor
        //The execution of the job will continue when the DATA_RECEIVED event is received
        var success = this.bridge.getPage().evaluate(chartCreateWebFunction, chart, metrics, config, this.timeout); //TODO: maybe asynchronous?

        if(!success) {
            this.bridge.getPage().evaluate(chartDeleteWebFunction);
            onError(); //Callback with empty file name
        }

    }

    , msg: function(txt) {
        return 'WidgetSnapshotProvider('+this.id+') ' + txt;
    },

    kill: function () {
        this.destroy();
        this.currentJobs = 0;
    },

    decrementJobCount: function() {
        if(this.currentJobs > 0) {
            this.currentJobs--;
        }
    },

    incrementJobCount: function() {
        if(this.currentJobs < 1) {
            this.currentJobs = 1;
        } else {
            throw new Error("This worker has reached the maximum of jobs");
        }
    },

    isCompletellyBusy: function() {
        return this.currentJobs === 1;
    }

};

var processChartReadyEvent = function() {

    if(this.currentJob == null) {
        console.warn(this.msg("A job in the WidgetSnapshotProvider was lost!!!"));
    }

    if(this.timeoutId != null) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
    }

    var fileName = '/tmp/' + Math.round(Math.random() * 1000000000) + ".png"; //TODO: compatibility with Windows?
    var success = this.bridge.getPage().render(fileName);

    //Clear the chart
    this.bridge.getPage().evaluate(chartDeleteWebFunction);

    // Clear the current job information
    var onImageReady = this.currentJob.onImageReady;
    this.currentJob = null;

    // Execute the callback
    onImageReady(success ? fileName : undefined);

};

var processDataReceivedEvent = function() {
    if(this.currentJob != null) {
        this.timeoutId = setTimeout(processChartReadyEvent.bind(this), 500);
    }
};

var processErrorEvent = function(msg) {

    //Clear the chart
    this.bridge.getPage().evaluate(chartDeleteWebFunction);

    // Clear the current job information
    var onError = this.currentJob.onError;
    this.currentJob = null;

    // Execute error callback
    onError(msg);
};


/**
 * This method handles all the messages sent from the webExecutor to Phantom
 * @param data
 */
var phantomWebMessageHandler = function(data) {
    switch (data.type) {
        case 'DATA_RECEIVED': processDataReceivedEvent.call(this); break;
        case 'CHART_READY': processChartReadyEvent.call(this); break;
        case 'ERROR': processErrorEvent.call(this, data.data); break;
        default:
            console.warn(this.msg("Received unknown type in phantomWebMessageHandler!"));
            break;
    }
};


var chartDeleteWebFunction = function() {

    //Clear previous chart
    if(window.chart != null) {
        Bridge.stopEventTransmission(window.chart, "DATA_RECEIVED");
        window.chart.delete();
    }

    $("body").empty();

};

/**
 * This method is evaluated in the WebExecutor and creates the requested chart in the page
 * @param chartType Name of the class of the chart (the name with which the chart is registered in the sdh-framework).
 * @param metrics Metrics array to pass to the chart constructor.
 * @param config Configuration to pass to the chart constructor.
 * @param timeout Maximum execution time
 * @returns {boolean}
 */
var chartCreateWebFunction = function(chartType, metrics, config, timeout) {

    //TODO: allow functions in config??
    //TODO: improve function detection (with/without spaces, with/without name, etc)

    //For nvd3: overwrite the addGraph method to make sure that the CHART_READY event is triggered
    if(nv != null) {
        window._addGraph = window._addGraph || nv.addGraph;
        nv.addGraph = function(generator, callback) {
            window._addGraph(generator, function(c) {
                flushAnimationFrames();
                Bridge.sendToPhantom("CHART_READY", null);
                if (typeof callback === 'function') callback(c);
            })
        };
    }

    /*if(Chart != null) {
        Chart.defaults.global.animation = false;
        Chart.defaults.global.onAnimationComplete = function() {
            Bridge.sendToPhantom("CHART_READY", null);
        }
    }*/

    for(var param in config) {
        var val = config[param];
        if(typeof val === 'string' && isAFunctionString(val)) {
            config[param] = createSandboxedFuntion(val)();
        }
    }

    for(var i = 0; i < metrics.length; i++) {
        var metric = metrics[i];
        if(metric instanceof Object) {
            for(var param in metric) {
                var val = metric[param];
                if(typeof val === 'string' && isAFunctionString(val)) {
                    metric[param] = createSandboxedFuntion(val)();
                }
            }
        }
    }

    $("body").append("<div id='chart' style='width: 100%; height: 100%;'></div>");

    var domElement = document.getElementById("chart");

    try {
        var constructor = framework.widgets[chartType];
        if(constructor != null) {

            //Handle errors
            constructor.prototype.onError = function(msg) {
                Bridge.sendToPhantom("ERROR", msg);
            };

            window.chart = new constructor(domElement, metrics, [], config);
            Bridge.transmitEventAndExecute(window.chart, "DATA_RECEIVED", false, function() {
                clearTimeout(window.chartTimeout);
                window.chartTimeout = null;
            });

            //Set a timeout
            window.chartTimeout = setTimeout(function() {
                window.chartTimeout = null;
                Bridge.sendToPhantom("ERROR", "Max execution time reached!");

            }, timeout);

            return true;
        }

    } catch(e) {
        console.error(e);
    }

    return false;

};

module.exports = WidgetSnapshotProvider;