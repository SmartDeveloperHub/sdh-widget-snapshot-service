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

function WidgetSnapshotProvider (id, workerPool, onKill) {
    this.id = id;
    this.isReady = false;
    this.bridge = null;
    this.currentJob = null;
    this.currentJobs = 0;
    this.maxJobs = 0;
    this.jobs = {};
    this.timeoutId = null;
    this.workerPool = workerPool;
    this.onKill = onKill;

    this.workerPool.add(this);
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

        this.isReady = true;

    }

    , destroy: function() {
        if(this.isReady) {
            this.isReady = false;
            this.bridge.close();
            this.bridge = null;
        }
    }

    , getChartImage: function(job) {

        if(typeof job.data.onImageReady !== 'function')
            throw new Error(job.worker.msg('A onImageReady function must be specified in "getChartImage" method.'));

        if(job.worker.currentJob != null) {
            throw new Error(job.worker.msg('The WidgetSnapshotProvider instance is busy!'));
        }

        if(!job.worker.isReady) {
            throw new Error(job.worker.msg('The WidgetSnapshotProvider instance is not initialized!'));
        }

        job.worker.currentJob = job;

        //Set the viewport
        job.worker.bridge.getPage().viewportSize = job.data.viewport;

        //Set the clipRect to be sure that the image generated is of the size we want
        job.worker.bridge.getPage().clipRect = {
            top: 0,
            left: 0,
            width: job.data.viewport.width,
            height: job.data.viewport.height
        };

        //Load the chart in the web executor
        //The execution of the job will continue when the DATA_RECEIVED event is received
        var success = job.worker.bridge.getPage().evaluate(chartCreateWebFunction, job.data.chart, job.data.metrics, job.data.config); //TODO: maybe asynchronous?

        if(!success) {
            processErrorEvent("Some kind of error happened.");
        }

    }

    , msg: function(txt) {
        return 'WidgetSnapshotProvider('+this.id+') ' + txt;
    },

    kill: function () {
        if(this.isReady) {
            this.destroy();
            this.currentJob.abort(408, "Max execution time reached");
            this.currentJobs = 0;
            this.onKill(this);
        }
    },

    setJobFinished: function(job) {
        if(this.isReady && this.currentJobs > 0) {

            this.currentJobs--;
            this.currentJob = null;

            this.workerPool.setIdle(this);

            var jobInfo = this.jobs[job.id];
            delete this.jobs[job.id];

            clearTimeout(jobInfo.timeout);
        }
    },

    startJob: function(job) {
        if(this.isReady && this.currentJobs < this.maxJobs) {

            // Add the job to the list of jobs
            this.jobs[job.id] = {
                job: job,
                timeout: setTimeout(this.kill.bind(this), job.maxExecTime)
            };

            this.currentJobs++;

            // Run the job
            job.start(this);

        } else {
            throw new Error("This worker has reached the maximum of jobs");
        }
    },

    isCompletellyBusy: function() {
        return this.currentJobs >= this.maxJobs;
    },

    decreaseMaxJobs: function(amount) {
        if(amount > 0) {
            this.maxJobs -= amount;
            if (this.maxJobs < 0) {
                this.maxJobs = 0;
            }
            this.workerPool.refresh(this);
        }
    },

    increaseMaxJobs: function(amount) {
        if(amount > 0) {
            this.maxJobs += amount;
            this.workerPool.refresh(this);
        }

    }

};

var processChartReadyEvent = function(causedByTimeout) {

    if(this.currentJob == null) {
        console.warn(this.msg("A job in the WidgetSnapshotProvider was lost!!!"));
        return;
    }

    if(this.timeoutId != null) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
    }

    // If no CHART_READY event was received, the make sure to flush the animation frames before taking the snapshot
    if(causedByTimeout) {
        this.bridge.getPage().evaluate(function() {
            flushAnimationFrames();
        });
    }

    // Yield to make sure that rendering has been done
    setTimeout(function() {
        var fileName = '/tmp/' + Math.round(Math.random() * 1000000000) + ".png"; //TODO: compatibility with Windows?
        var success = this.bridge.getPage().render(fileName);

        //Clear the chart
        this.bridge.getPage().evaluate(chartDeleteWebFunction);

        // Execute the callback
        this.currentJob.data.onImageReady(this.currentJob, success ? fileName : undefined);

        // Clear the current job information
        this.currentJob.setFinished();
    }.bind(this), 0);

};

var processDataReceivedEvent = function() {
    if(this.currentJob != null) {
        this.timeoutId = setTimeout(processChartReadyEvent.bind(this, true), 200);
    }
};

var processErrorEvent = function(msg) {

    console.error(msg);

    //Clear the chart
    this.bridge.getPage().evaluate(chartDeleteWebFunction);

    this.currentJob.abort(500, msg);

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

    window.resetOptimizations && window.resetOptimizations();

    //Clear previous chart
    if(window.chart != null) {
        Bridge.stopEventTransmission(window.chart, "DATA_RECEIVED");
        window.chart.delete();
    }

    // Reset common widget colors
    framework.widgets.CommonWidget.prototype.previousColors = {};

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

    //TODO: if no chart ready is generated, flushAnimationFrames

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
            Bridge.transmitEventAndExecute(window.chart, "DATA_RECEIVED", false);

            return true;
        }

    } catch(e) {
        console.error(e);
    }

    return false;

};

module.exports = WidgetSnapshotProvider;