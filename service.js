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
const PhantomWorker = require('./PhantomWorker');
const JobQueue = require('./JobQueue');
const JobStatusController = require('./JobStatusController');
const config = require('./config');
const uuid = require('node-uuid');
const Redis = require('redis');

var PORT_SEARCH_BEGIN = config.phantom.start_port; //Number of port to start looking for free ports
var LISTEN_PORT = config.port;
var NUMBER_WORKERS = config.phantom.workers;
var NUMBER_EXECUTORS_PER_WORKER = config.phantom.executors_per_worker;

var workerPool = null;
var jobQueue = null;
var app = express();
var redis = null;
var freeingStorageSpace = false;
var jobStatusController = new JobStatusController();

var start = function() {

    redis = Redis.createClient(config.persistence.redis.port, config.persistence.redis.host);

    redis.on('connect', function() {

        // First spawn the phantom processes that will serve the requests
        startPhantomWorkers( function() {

            // Create a job queue using the worker pool that has been created
            jobQueue = new JobQueue(workerPool);

            // Once all the workers are ready start the API service
            startApiService();

        } );

    });

    redis.on("error", function (err){
        console.log("Error " + err);
    });


};

var startPhantomWorkers = function(callback) {

    //Path to the PhantomJS executable
    var phantomJsExecutable = phantomjs.path;

    var workersReady = 0;
    workerPool = new WorkerPool();

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

            workerPool.add(new PhantomWorker(proc, port, NUMBER_EXECUTORS_PER_WORKER));

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

    var bodyParser = require('body-parser');

    // Configure express
    app.use(bodyParser.json());       // to support JSON-encoded bodies

    // Endpoints
    app.get('/image', handleImageGetRequest);
    app.post('/persistent-image', handlePersistentImagePostRequest);
    app.get('/persistent-image/:id', handlePersistentImageGetRequest);

    // Start listening for requests
    app.listen(LISTEN_PORT, function () {
        console.log('Service is now listening on port '+LISTEN_PORT+'!');
    });

};

var handlePersistentImagePostRequest = function(req, res) {

    var phantomServiceUrl = "/image" +
        "?chart=" + encodeURIComponent(req.body.chart) +
        "&metrics=" + encodeURIComponent(JSON.stringify(req.body.metrics)) +
        "&configuration=" + encodeURIComponent(JSON.stringify(req.body.configuration));

    if(req.body.height && !Number.isNaN(parseFloat(req.body.height))) {
        phantomServiceUrl += "&height="+encodeURIComponent(parseFloat(req.body.height));
    }

    if(req.body.width && !Number.isNaN(parseFloat(req.body.width))) {
        phantomServiceUrl += "&width="+encodeURIComponent(parseFloat(req.body.width));
    }

    var jobData = {
        imageUrl: phantomServiceUrl,
        callback: function(statusCode, body) {

            switch(statusCode) {
                case 200:

                    //TODO: return an url to retrieve the generated image
                    var fileId = uuid.v4();
                    var fileName = config.persistence.prefix + fileId + ".png";
                    var newFilePath = path.join(
                        config.persistence.directory,
                        fileName
                    );

                    //TODO: implement max size of files directory
                    //TODO: return information about the creation date

                    fs.rename(body, newFilePath, function(err) {

                        if (err) {
                            console.error("Error moving " + body + " to " + newFilePath, err);
                            error(err, res, 500);
                            fs.unlink(body); //Remove the temporal file

                        } else {
                            res.location(req.protocol + '://' + req.get('host') + '/persistent-image/' + fileId).end();

                            // Obtain the information about the file
                            fs.stat(newFilePath, function(err, stats) {

                                // Save the file information in redis
                                redis.hmset(fileId, {
                                    'name': fileName,
                                    'size': stats.size,
                                    'creation': new Date().getTime(),
                                    'lastAccess': new Date().getTime()
                                });

                                redis.sadd('fileIds', fileId);

                                // Increment the total space used
                                redis.incrby('totalSpace', stats.size, function(err, total) {
                                    if (err) return console.error(err);

                                    if(total > config.persistence.max_size) {
                                        freeStorageSpace();
                                    }
                                });

                            });

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


var handlePersistentImageGetRequest = function(req, res) {

    var fileId = req.params.id;

    redis.hgetall(fileId, function(err, object) {

        if(err || object == null) {
            error(err, res, 404);
            return;
        }

        var filePath = path.join(
            config.persistence.directory,
            object.name
        );

        redis.hset(fileId, 'lastAccess', new Date().getTime());

        res.sendFile(filePath, function (err) {

            if (err) {
                error(err, res, 410);
            }
        });

    });




};

var handleImageGetRequest = function(req, res) {

    var jobData = {
        imageUrl: req.originalUrl,
        callback: function(statusCode, body) {

            switch(statusCode) {
                case 200:

                    res.sendFile(body, function (err) {

                        if (err) {
                            error(err, res, 500);
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

function error(err, res, status, msg) {
    console.error(err);
    if(msg) {
        res.status(status).send(msg);
    } else {
        res.status(status).end();
    }

}

function freeStorageSpace() {

    if(!freeingStorageSpace) {
        freeingStorageSpace = true;

        redis.get("totalSpace", function(err, val) {

            if(err) {
                freeingStorageSpace = false;
                return console.error(err);
            }

            var currentSize = parseInt(val);

            var amountToFree = currentSize - (config.persistence.max_size * config.persistence.free_percentage / 100);
            var freedAmount = 0;
            //TODO: make sure the space is decremented before freeingStorageSpace is set to false

            redis.sort("fileIds", 'by', "*->lastAccess", 'get', '#', 'get', '*->size', 'get', '*->name', 'LIMIT', "0", "30", function(err, result) {
                for(var i = 0; i < result.length && freedAmount < amountToFree; i+=3) {
                    var id = result[i];
                    var size = parseInt(result[i+1]);
                    var name = result[i+2];

                    redis.del(id);
                    redis.srem('fileIds', id);
                    redis.decrby('totalSpace', size);

                    var filePath = path.join(
                        config.persistence.directory,
                        name
                    );

                    fs.unlink(filePath);

                    freedAmount += size;

                }

                freeingStorageSpace = false;
            });

        });


    }

}

start();