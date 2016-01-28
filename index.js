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

var NUMBER_WORKERS = 3;

var WidgetSnapshotProvider = require('./WidgetSnapshotProvider');
var WorkerPool = require('./WorkerPool');

var workerPool = new WorkerPool();

var startedCount = 0;
for(var i = 0; i < NUMBER_WORKERS; i++) {
    var snapshotProvider = new WidgetSnapshotProvider(i);
    snapshotProvider.init(function(snapshotProvider, success) {

        if(!success) {
            console.error("Unable to init WidgetSnapshotProvider");
            phantom.exit();
        }

        workerPool.add(snapshotProvider);
        console.log("Worker " + snapshotProvider.id + " added to pool.");

        if(++startedCount === NUMBER_WORKERS) {
            startListening();
        }

    }.bind(null, snapshotProvider));

}

var startListening = function() {
    console.log("Listening for requests.");

    //TODO: this is a temporal simulation of jobs received from stdin/pipe
    // ---------------------------------------------------

    var chart = "TimeBar";

    var metrics = [{
        id: 'product-success-rate',
        max: 20,
        prid: "product-sdh"
    }];

    var configuration = {
        height: 65,
        color: function(val) {
            var color = d3.scale.linear()
                .domain([0, 0.5, 1])
                .range(["red", "yellow", "green"]);
            return color(val);
        } + '', //To string
        tooltip: '<h3>Value: ¬Math.round(_E.value * 100)/100¬</h3>' +
        '<h3>Date: ¬Widget.format.date(_E.time)¬ </h3>',
        legend: ['Success', 'Broken']
    };

    //Multiple requests at the same time
    executeJob(chart, metrics, configuration);
    executeJob(chart, metrics, configuration);

    //---------------
};

var executeJob = function(chart, metrics, configuration) {

    //TODO: no workers idle?

    var snapshotProvider = workerPool.getIdleAndSetBusy();

    snapshotProvider.getChartImage("TimeBar", metrics, configuration, onJobFinished.bind(null, snapshotProvider));

};

var onJobFinished = function(snapshotProvider, fileName) {

    if(fileName != null) {
        console.log(fileName);
    } else {
        console.error("Capture could not be done!");
    }

};
