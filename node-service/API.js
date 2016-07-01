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

const http = require('http');
const PersistenceController = require('./PersistenceController');
const Job = require('./../common/Job');
const fs = require('fs');

var app = require('express')();

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

                    PersistenceController.persistFile(body, 'image/png', function(err, fileId) {
                        if (err) {
                            console.error("Error persisting " + body, err);
                            error(err, res, 500);
                            fs.unlink(body); //Remove the temporal file
                        } else {
                            res.location(req.protocol + '://' + req.get('host') + '/persistent-image/' + fileId).end();
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

    var onAbort = function(job, status, msg) {
        if(job.data.httpRequest != null) {
            job.data.httpRequest.abort();
        }
        res.status(status).send(msg);
    };

    var job = new Job(makePhantomImageRequest, jobData, parseInt(process.env.PHANTOM_TIMEOUT), onAbort);

    jobQueue.executeOrQueueJob(job, false);

};


var handlePersistentImageGetRequest = function(req, res) {

    var fileId = req.params.id;

    PersistenceController.getPersistedFile(fileId, function(err, filePath, fileInfo) {

        if(err || fileInfo == null) {
            error(err, res, 404);
            return;
        }

        // Set information about when this image was created
        res.header("Last-Modified", new Date(parseInt(fileInfo.creation)).toUTCString());

        // Set the content type (this is needed because sendFile can not infer it because the file has no extension)
        res.setHeader('Content-type', fileInfo.mime);

        // Send the file (this does not use the sendfile system call)
        //TODO: improve send file performance using a serve static middleware
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

    var onAbort = function(job, status, msg) {
        if(job.data.httpRequest != null) {
            job.data.httpRequest.abort();
        }
        res.status(status).send(msg);
    };

    var job = new Job(makePhantomImageRequest, jobData, parseInt(process.env.PHANTOM_TIMEOUT), onAbort);

    jobQueue.executeOrQueueJob(job, false);

};

var makePhantomImageRequest = function(job) {

    console.log("Request:" + job.data.imageUrl);
    console.log("Port: " + job.worker.port);

    job.data.httpRequest = http.get(
        {
            hostname: '127.0.0.1',
            port: job.worker.port,
            path: job.data.imageUrl
        },
        handlePhantomImageResponse.bind(null, job)
    ).on('error', function(e) {
        console.log("Conection error: " + e.message);
    });

};


var handlePhantomImageResponse = function(job, response) {

    switch(response.statusCode) {

        case 200: // Image was generated without errors

            readResponseBody(response, function(body) {

                // Mark the job as finished
                job.setFinished();

                job.data.callback(response.statusCode, body);

                // Start next job
                jobQueue.processJobs();

            });

            break;

        case 503: // This case should not happen as the service keeps to count of jobs per worker

            console.error('The worker was not idle!!');

            var worker = job.worker;

            // Set as finished and clone the job
            var newJob = new Job(job.method, job.data, job.maxExecTime, job.onAbort);
            job.setFinished();

            // We have to temporally decrease the number of jobs that the worker can handle
            worker.decreaseMaxJobs(1);

            // Try to reprocess it
            jobQueue.executeOrQueueJob(newJob, true);

            break;

        default: // Some error happened

            readResponseBody(response, function(body) {

                // Mark the job as finished
                job.setFinished();

                job.data.callback(response.statusCode, body);

                //Start next job
                jobQueue.processJobs();

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

module.exports = {
    start: start
    //TODO: stop
};