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

var fs = require('fs');
var webserver = require('webserver');
var system = require('system');

var WidgetSnapshotProvider = require('./WidgetSnapshotProvider');
var WorkerPool = require('./WorkerPool');
var config = require('./config.js');

var workerPool = null;
var widgets = null;
var server = null;

var NUMBER_WORKERS = 0;
var LISTEN_PORT = 0;
var TIMEOUT = 0;
var LISTEN_IP = "127.0.0.1";

var PROVIDER_INITIALIZATION_ERROR = 1;
var API_INITIALIZATION_ERROR = 2;

var main = function() {

    // Process parameters
    if(system.args.length != 2 || system.args[1] == "") {
        console.log('Usage: phantomjs  PhantomService.js  LISTEN_PORT');
        phantom.exit();
    }

    NUMBER_WORKERS = parseInt(config.phantom.executors_per_worker);
    TIMEOUT = parseInt(config.phantom.timeout);
    LISTEN_PORT = parseInt(system.args[1]);


    //Get a list with information about available widgets
    widgets = obtainWidgetList();

    var requireJsWidgetList = [];

    //Obtain the list to give to the snapshot providers
    for(var i = widgets.length -1; i >= 0; i--) {
        requireJsWidgetList.push(widgets[i].requireJsPath);
    }

    //Create a pool of workers
    workerPool = new WorkerPool(1);

    // Fill the pool with workers
    var startedCount = 0;
    for(var i = 0; i < NUMBER_WORKERS; i++) {
        var snapshotProvider = new WidgetSnapshotProvider(i, TIMEOUT);
        snapshotProvider.init(requireJsWidgetList, function(snapshotProvider, success) {

            if(!success) {
                console.error("Unable to init WidgetSnapshotProvider");
                phantom.exit(PROVIDER_INITIALIZATION_ERROR);
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

    server = webserver.create();

    var ok = server.listen(LISTEN_IP + ':' + LISTEN_PORT, function(request, response) {

        if(request.method != 'GET') {
            response.statusCode = 404;
            response.close();
        }

        var requestUrlInfo = parseUrl(request.url);

        switch(requestUrlInfo.pathname) {
            case '/image':
                handleGetImage(request, response, requestUrlInfo);
                break;
            default:
                response.statusCode = 404;
                response.close();
        }

    });

    if(!ok) {
        console.error("Unable to start web server!");
        phantom.exit(API_INITIALIZATION_ERROR);
    }

    console.log("Listening for requests in "+LISTEN_IP + ':' + LISTEN_PORT+ " ...");

};

var handleGetImage = function(request, response, requestUrlInfo) {

    var onJobFinished = function(snapshotProvider, fileName) {

        workerPool.setIdle(snapshotProvider);

        if(fileName != null) {
            response.statusCode = 200;
            response.write(fileName);
        } else {
            response.statusCode = 400;
            response.write("Capture could not be done!"); //TODO: better error messages!
        }

        response.close();

    };

    var onJobError = function(snapshotProvider, msg) {

        workerPool.setIdle(snapshotProvider);

        response.statusCode = 400;
        response.write((msg ? "Error: " + msg : "Error while creating the chart"));
        response.close();
    };

    try {

        var chart, metrics, configuration, viewport;

        chart = requestUrlInfo.params['chart'];

        if(requestUrlInfo.params['metrics'] != null) {
            metrics = JSON.parse(requestUrlInfo.params['metrics']);
        } else {
            throw new Error("Parameter 'metrics' is required.");
        }

        if(requestUrlInfo.params['configuration'] != null) {
            configuration = JSON.parse(requestUrlInfo.params['configuration']);
        } else {
            configuration = {};
        }

        //If viewport is not set, set the default values
        viewport = {};
        viewport.height = requestUrlInfo.params['height'] || configuration['height'] || 450;
        viewport.width = requestUrlInfo.params['width'] || 450;

        if(configuration.height == null) {
            configuration.height = viewport.height;
        }

        var ok = executeJob(chart, metrics, configuration, viewport, onJobFinished, onJobError);

        if(!ok) { //Could not find an idle worker
            response.statusCode = 503;
            response.write("No workers available");
            response.close();
        }

    } catch(e) {
        response.statusCode = 400;
        response.write("Error in arguments: " + e); //TODO: better error messages!
        response.close();
    }

};

var executeJob = function(chart, metrics, configuration, viewport, onJobFinished, onJobError) {

    var snapshotProvider = workerPool.getIdleAndAddJob();

    if(snapshotProvider != null) {
        snapshotProvider.getChartImage(chart, viewport, metrics, configuration,
            onJobFinished.bind(null, snapshotProvider),
            onJobError.bind(null, snapshotProvider));

        return true;

    } else { //No idle workers
        return false;
    }

};

var parseUrl = function(url) {
    var parser = document.createElement('a');
    parser.href = decodeURI(url);

    var res = {
        protocol: parser.protocol, // => "http:"
        hostname: parser.hostname, // => "example.com"
        port: parser.port,     // => "3000"
        pathname: parser.pathname, // => "/pathname/"
        search: parser.search,   // => "?search=test"
        hash: parser.hash,     // => "#hash"
        host: parser.host     // => "example.com:3000"
    };

    res.params = [];

    var paramstr = res.search.split('?')[1];
    var paramsarr = paramstr.split('&');
    for (var i = 0; i < paramsarr.length; i++) {
        var tmparr = paramsarr[i].split('=');
        res.params[decodeURIComponent(tmparr[0])] = decodeURIComponent(tmparr[1]);
    }

    return res;
};

main();
