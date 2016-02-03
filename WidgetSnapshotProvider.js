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

function WidgetSnapshotProvider (id) {
    this.id = id;
    this.creationDate = new Date();
    this.isReady = false;
    this.bridge = null;
    this.onReadyCallback = null;
    this.currentJob = null;
}

WidgetSnapshotProvider.prototype = {
    constructor: WidgetSnapshotProvider

    /**
     * Initialize the web capturer.
     * @param onReady
     */
    , init: function(requireJsWidgetList, onReady) {

        if(typeof onReady !== 'function') {
            throw new Error(this.msg('A callback function must be specified in "init" method.'));
        }

        this.bridge = new Bridge(this.id);
        this.bridge.initFramework(requireJsWidgetList, phantomWebMessageHandler.bind(this), onReady);


    }

    , destroy: function() {

        this.isReady = false;
        this.bridge.close();
        this.bridge = null;
        this.onReadyCallback = null;

    }

    , getCreationDate: function() {
        return this.creationDate;
    }

    , isReady: function() {
        return this.isReady;
    }

    , getChartImage: function(chart, viewPort, metrics, config, onImageReady) {

        if(typeof onImageReady !== 'function')
            throw new Error(this.msg('A onImageReady function must be specified in "getChartImage" method.'));

        if(this.currentJob != null) {
            return false; //This means this WidgetSnapshotProvider is busy
        }

        this.currentJob = {
            chart: chart,
            metrics: metrics,
            config: config,
            onImageReady: onImageReady
        };

        //Set the viewport
        this.bridge.getPage().viewportSize = viewPort;

        //Load the chart in the web executor
        //The execution of the job will continue when the DATA_RECEIVED event is received
        var success = this.bridge.getPage().evaluate(chartCreateWebFunction, chart, metrics, config); //TODO: maybe asynchronous?

        if(!success) {
            this.bridge.getPage().evaluate(chartDeleteWebFunction);
            onImageReady(); //Callback with empty file name
        }


    }

    , msg: function(txt) {
        return 'WidgetSnapshotProvider('+this.id+') ' + txt;
    }

};


var processDataReceivedEvent = function() {

    setTimeout(function() { //TODO: detect if the image has been rendered

        if(this.currentJob == null) {
            console.warn(this.msg("A job in the WidgetSnapshotProvider was lost!!!"));
        }

        var fileName = '/tmp/' + Math.round(Math.random() * 1000000000) + ".png"; //TODO: compatibility with Windows?
        var success = this.bridge.getPage().render(fileName);

        //Clear the chart
        this.bridge.getPage().evaluate(chartDeleteWebFunction);

        var onImageReady = this.currentJob.onImageReady;
        this.currentJob = null;

        // Execute the callback
        onImageReady(success ? fileName : undefined);

    }.bind(this), 500);

};


/**
 * This method handles all the messages sent from the webExecutor to Phantom
 * @param data
 */
var phantomWebMessageHandler = function(data) {
    switch (data.type) {
        case 'DATA_RECEIVED': processDataReceivedEvent.call(this); break;
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
 * @returns {boolean}
 */
var chartCreateWebFunction = function(chartType, metrics, config) {

    //TODO: size of the image

    //TODO: allow functions in config??
    for(var param in config) {
        var val = config[param];
        if(typeof val === 'string' && val.indexOf('function (') === 0) {
            config[param] = eval('('+val+')');
        }
    }

    $("body").append("<div id='chart' style='width: 100%; height: 100%;'></div>");

    var domElement = document.getElementById("chart");

    try {
        var constructor = framework.widgets[chartType];
        if(constructor != null) {
            window.chart = new constructor(domElement, metrics, [], config);
            Bridge.transmitEvent(window.chart, "DATA_RECEIVED");
            return true;
        }

    } catch(e) {
        console.error(e);
    }

    return false;

};


module.exports = WidgetSnapshotProvider;