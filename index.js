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

var fs = require('fs');
var WidgetSnapshotProvider = require('./WidgetSnapshotProvider');
var WorkerPool = require('./WorkerPool');


var workerPool = null;
var widgets = null;

var main = function() {

    widgets = obtainWidgetList();

    var requireJsWidgetList = [];

    //Obtain the list to give to the snapshot providers
    for(var i = widgets.length -1; i >= 0; i--) {
        requireJsWidgetList.push(widgets[i].requireJsPath);
    }

    //Create a pool of workers
    workerPool = new WorkerPool();

    // Fill the pool with workers
    var startedCount = 0;
    for(var i = 0; i < NUMBER_WORKERS; i++) {
        var snapshotProvider = new WidgetSnapshotProvider(i);
        snapshotProvider.init(requireJsWidgetList, function(snapshotProvider, success) {

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

};

var obtainWidgetList = function() {

    var widgetList = [];

    //Check widget dir
    var pathToWidgetDir = "web/vendor/sdh-framework/widgets/";
    if(pathToWidgetDir.substr(-1, 1) !== '/') {
        pathToWidgetDir += '/';
    }
    if(!fs.isDirectory(pathToWidgetDir) || !fs.isReadable(pathToWidgetDir)) {
        throw new Error("Widget directory is not defined or not readable.");
    }

    //Get list of folders inside the widgets dir (one folder per widget)
    var dirContents = fs.list(pathToWidgetDir);

    // Read the config.json file of each widget
    for(var x = 0; x < dirContents.length; x++) {

        var folderPath = pathToWidgetDir + dirContents[x] + '/';
        var configFile = folderPath + 'config.json';

        if(fs.isFile(configFile) && fs.isReadable(configFile)) {
            try {
                var content = fs.read(configFile);
                var config = JSON.parse(content);

                config.main = config.main.trim();

                var mainFilePath = folderPath + config.main;
                var mainFileWithoutJs = (config.main.length >= 3 && config.main.substr(-3, 3) === '.js' ? config.main.substr(0, config.main.length - 3) : config.main);

                //heck if main file exists
                if(!fs.isFile(mainFilePath)) {
                    console.warn('Could not find main file ' + mainFilePath);
                    continue;
                }

                //Add it to the widget list
                widgetList.push({
                    name: config.name,
                    main: config.main,
                    requireJsPath: 'vendor/sdh-framework/widgets/' + dirContents[x] + '/' + mainFileWithoutJs
                })

            } catch(e) {
                console.warn('Could not read configuration file ' + configFile);
            }
        }
    }

    return widgetList;

};

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

var executeJob = function(chart, metrics, configuration, viewport) {

    //TODO: no workers idle?

    //If viewport is not set, set the default values
    viewport = viewport || {};
    viewport.height = viewport.height || 450;
    viewport.width = viewport.width || 450;

    if(configuration.height == null) {
        configuration.height = viewport.height;
    }

    var snapshotProvider = workerPool.getIdleAndAddJob();

    snapshotProvider.getChartImage(chart, viewport, metrics, configuration, onJobFinished.bind(null, snapshotProvider));

};

var onJobFinished = function(snapshotProvider, fileName) {

    if(fileName != null) {
        console.log(fileName);
    } else {
        console.error("Capture could not be done!");
    }

};

main();
