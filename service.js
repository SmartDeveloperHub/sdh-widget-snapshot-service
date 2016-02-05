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

var express = require('express');
var app = express();
var path = require('path');
var childProcess = require('child_process');
var phantomjs = require('phantomjs-prebuilt');
var net = require('net');
var http = require('http');
var WorkerPool = require('./WorkerPool');

var PORT_SEARCH_BEGIN = 45032; //Number of port to start looking for free ports
var LISTEN_PORT = 0;
var NUMBER_WORKERS = 0;
var NUMBER_WORKERS_PER_WORKER = 0;
var workerPool = null;

var start = function() {

    // Check arguments
    if(process.argv.length == 5 ) {
        NUMBER_WORKERS = parseInt(process.argv[2]);
        NUMBER_WORKERS_PER_WORKER = parseInt(process.argv[3]);
        LISTEN_PORT = parseInt(process.argv[4]);
    } else {
        console.log("Usage: node service.js  NUMBER_WORKERS  NUMBER_WORKERS_PER_WORKER  LISTEN_PORT");
    }

    //First spawn the phantom processes that will serve the requests
    //Once all the workers are ready start the API service
    startPhantomWorkers( startApiService );

};

var startPhantomWorkers = function(callback) {

    //Path to the PhantomJS executable
    var phantomJsExecutable = phantomjs.path;

    var workersReady = 0;
    workerPool = new WorkerPool(NUMBER_WORKERS_PER_WORKER);

    var launchWorker = function() {

        // Find a free port and spawn a phantom service in that port
        getPort(function(port) {

            var childArgs = [
                "--web-security=false",
                path.join(__dirname, 'PhantomService.js'),
                NUMBER_WORKERS_PER_WORKER,
                port
            ];

            //Spawn the worker process
            var res = childProcess.execFile(phantomJsExecutable, childArgs);
            //TODO: handle case in which a worker dies

            res.stdout.on('data', function(data) {
                    console.log("[PhantomService]["+port+"]: " + data);
            });

            workerPool.add({
                process: res,
                port: port
            });

            if(++workersReady === NUMBER_WORKERS) {
                callback();
            }

        });
    };

    console.log('Spawning ' + NUMBER_WORKERS + ' workers...');

    for(var i = 0; i < NUMBER_WORKERS; i++) {
        launchWorker();
    }

};

var startApiService = function() {

    app.get('/image', function (req, res) {

        //Select the worker that will handle this request
        var worker = workerPool.getIdleAndAddJob();

        console.log(req.originalUrl);
        console.log("Port: " + worker.port);

        http.get({
            hostname: '127.0.0.1',
            port: worker.port,
            path: req.originalUrl
        }, function(response) {
            // Continuously update stream with data
            var body = '';
            response.on('data', function(d) {
                body += d;
            });
            response.on('end', function() {

                workerPool.setIdle(worker);

                console.log("Sending file: " + body);
                res.sendFile(body);

            });
        });

    });

    app.listen(LISTEN_PORT, function () {
        console.log('Service is now listening on port '+LISTEN_PORT+'!');
    });

};



function getPort (cb) {
    var port = PORT_SEARCH_BEGIN;
    PORT_SEARCH_BEGIN += 1;

    var server = net.createServer();
    server.listen(port, function (err) {
        server.once('close', function () {
            cb(port)
        });
        server.close()
    });
    server.on('error', function (err) {
        getPort(cb)
    })
}

start();