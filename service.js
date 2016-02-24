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
const JobQueue = require('./JobQueue');
const Config = require('./config');

var PORT_SEARCH_BEGIN = Config.phantom.start_port; //Number of port to start looking for free ports
var LISTEN_PORT = Config.port;
var NUMBER_WORKERS = Config.phantom.workers;
var NUMBER_EXECUTORS_PER_WORKER = Config.phantom.executors_per_worker;

var workerPool = null;
var jobQueue = null;
var app = express();

var start = function() {

    //First spawn the phantom processes that will serve the requests
    //Once all the workers are ready start the API service
    startPhantomWorkers( startApiService );

    // Create a job queue using the worker pool that has been created
    jobQueue = new JobQueue(workerPool);

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

    app.get('/image', handleImageGetRequest);
    app.post('/job/image', handleImageCreateJobPostRequest);
    app.get('/job/image/:id', handleImageJobGetRequest);

    app.listen(LISTEN_PORT, function () {
        console.log('Service is now listening on port '+LISTEN_PORT+'!');
    });

};

var handleImageCreateJobPostRequest = function(req, res) {

};


var handleImageJobGetRequest = function(req, res) {

};

var handleImageGetRequest = function(req, res) {

    var jobData = {
        imageUrl: req.originalUrl,
        callback: function(statusCode, body) {

            switch(statusCode) {
                case 200:

                    res.sendFile(body, function (err) {

                        if (err) {
                            console.log(err);
                            res.status(err.status).end();
                        } else {
                            fs.unlink(body); //Remove the temporal file
                        }
                    });

                    break;

                default:

                    if(body.length > 0) {
                        res.status(statusCode).send(body);
                    } else {
                        res.status(statusCode).end();
                    }

                    break;

            }

        }
    };

    jobQueue.executeOrQueueJob(makePhantomImageRequest, false, jobData);

};

var makePhantomImageRequest = function(worker, jobData) {

    console.log("Request:" + jobData.imageUrl);
    console.log("Port: " + worker.port);

    http.get(
        {
            hostname: '127.0.0.1',
            port: worker.port,
            path: jobData.imageUrl
        },
        handlePhantomImageResponse.bind(null, worker, jobData)
    );

};


var handlePhantomImageResponse = function(worker, jobData, response) {

    switch(response.statusCode) {

        case 200: // Image was generated without errors

            readResponseBody(response, function(body) {

                // Mark the worker as idle
                workerPool.setIdle(worker);

                jobData.callback(response.statusCode, body);

                // Start next job
                jobQueue.nextJob();

            });

            break;

        case 503: // This case should not happen as the service keeps to count of jobs per worker

            console.error('The worker was not idle!!');

            // Try to reprocess it
            jobQueue.executeOrQueueJob(makePhantomImageRequest, true, jobData);

            break;

        default: // Some error happened

            readResponseBody(response, function(body) {

                workerPool.setIdle(worker);

                jobData.callback(response.statusCode, body);

                //Start next job
                jobQueue.nextJob();

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