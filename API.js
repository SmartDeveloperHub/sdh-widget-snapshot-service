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

const fs = require('fs');
const net = require('net');
const http = require('http');
const uuid = require('node-uuid');
const path = require('path');
const config = require('./config');

var app = require('express')();

var freeingStorageSpace = false;

var start = function(listen_port) {

    var bodyParser = require('body-parser');

    // Configure express
    app.use(bodyParser.json());       // to support JSON-encoded bodies

    // Endpoints
    app.get('/image', handleImageGetRequest);
    app.post('/persistent-image', handlePersistentImagePostRequest);
    app.get('/persistent-image/:id', handlePersistentImageGetRequest);

    // Start listening for requests
    app.listen(listen_port, function () {
        console.log('Service is now listening on port '+listen_port+'!');
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

                    var fileId = uuid.v4();
                    var fileName = config.persistence.prefix + fileId + ".png";
                    var newFilePath = path.join(
                        config.persistence.directory,
                        fileName
                    );

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

    redis.hgetall(fileId, function(err, fileInfo) {

        if(err || fileInfo == null) {
            error(err, res, 404);
            return;
        }

        var filePath = path.join(
            config.persistence.directory,
            fileInfo.name
        );

        redis.hset(fileId, 'lastAccess', new Date().getTime());

        // Set information about when this image was created
        res.header("Last-Modified", new Date(parseInt(fileInfo.creation)).toUTCString());

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

function error(err, res, status, msg) {
    console.error(err);
    if(msg) {
        res.status(status).send(msg);
    } else {
        res.status(status).end();
    }

}

//TODO: Refactor
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

module.exports = {
    start: start
    //TODO: stop
};