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

const express = require('express');
const path = require('path');
const childProcess = require('child_process');
const phantomjs = require('phantomjs-prebuilt');
const net = require('net');
const http = require('http');
const fs = require('fs');
const WorkerPool = require('./WorkerPool');
const Config = require('./config');

var PORT_SEARCH_BEGIN = Config.phantom.start_port; //Number of port to start looking for free ports
var LISTEN_PORT = Config.port;
var NUMBER_WORKERS = Config.phantom.workers;
var NUMBER_EXECUTORS_PER_WORKER = Config.phantom.executors_per_worker;

var workerPool = null;
var jobQueue = [];
var app = express();

var start = function() {

    //First spawn the phantom processes that will serve the requests
    //Once all the workers are ready start the API service
    startPhantomWorkers( startApiService );

};

var startPhantomWorkers = function(callback) {

    //Path to the PhantomJS executable
    var phantomJsExecutable = phantomjs.path;

    var workersReady = 0;
    workerPool = new WorkerPool(NUMBER_EXECUTORS_PER_WORKER);

    var launchWorker = function() {

        // Find a free port and spawn a phantom service in that port
        getPort(function(port) {

            var childArgs = [
                "--web-security=false",
                path.join(__dirname, 'PhantomService.js'),
                NUMBER_EXECUTORS_PER_WORKER,
                port
            ];

            // Spawn the worker process
            var proc = childProcess.execFile(phantomJsExecutable, childArgs);
            //TODO: handle case in which a worker dies

            proc.stdout.on('data', function(data) {
                    console.log("[PhantomService]["+port+"]: " + data);
            });

            proc.stderr.on('data', function(data) {
                console.error("[PhantomService]["+port+"]: " + data);
            });

            workerPool.add({
                process: proc,
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

    app.get('/image', handleImageRequest);

    app.listen(LISTEN_PORT, function () {
        console.log('Service is now listening on port '+LISTEN_PORT+'!');
    });

};

var handleImageRequest = function(req, res, fromQueue) {

    //Select the worker that will handle this request
    var worker = workerPool.getIdleAndAddJob();

    if(worker != null) {

        console.log("Request:" + req.originalUrl);
        console.log("Port: " + worker.port);

        http.get(
            {
                hostname: '127.0.0.1',
                port: worker.port,
                path: req.originalUrl
            },
            handlePhantomResponse.bind(null, worker, req, res)
        );

    } else { // No idle workers, queue request

        queueJob(req, res, fromQueue, handleImageRequest);

    }

};

var handlePhantomResponse = function(worker, apiRequest, apiResponse, workerResponse) {

    switch(workerResponse.statusCode) {

        case 200: // Image was generated without errors

            readResponseBody(workerResponse, function(body) {

                // Mark the worker as idle
                workerPool.setIdle(worker);

                // Send the file through the connection and then delete the file
                apiResponse.sendFile(body, function (err) {

                    if (err) {
                        console.log(err);
                        apiResponse.status(err.status).end();
                    } else {
                        fs.unlink(body); //Remove the temporal file
                    }
                });

                // Start next job
                nextJob();

            });

            break;

        case 503: // This case should not happen as the service keeps to count of jobs per worker

            console.error('The worker was not idle!!');

            // Try to reprocess it
            handleImageRequest(apiRequest, apiResponse, true);

            break;

        default: // Some error happened

            readResponseBody(workerResponse, function(body) {

                workerPool.setIdle(worker);

                if(body.length > 0) {
                    apiResponse.status(workerResponse.statusCode).send(body);
                } else {
                    apiResponse.status(workerResponse.statusCode).end();
                }

                //Start next job
                nextJob();

            });

            break;
    }

};

var readResponseBody = function(response, callback) {

    // Continuously update stream with data
    var body = '';
    response.on('data', function(d) {
        body += d;
    });
    response.on('end', function() {
        callback(body);
    });

};

var queueJob = function(req, res, onTop, method) {

    // If it has priority, put it at the beginning of the queue
    if(onTop) {
        jobQueue.unshift({
            req: req,
            res: res,
            method: method
        });

    } else {
        jobQueue.push({
            req: req,
            res: res,
            method: method
        });
    }
};

var nextJob = function() {

    var job = jobQueue.shift();

    if(job != null) {
        job.method(job.req, job.res, true);
    }

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