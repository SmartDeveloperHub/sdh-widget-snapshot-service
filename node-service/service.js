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

const net = require('net');
const fs = require('fs');
const WorkerPool = require('./../common/WorkerPool');
const PhantomWorker = require('./PhantomWorker');
const JobQueue = require('./JobQueue');
const Redis = require('redis');
const API = require('./API');

var PORT_SEARCH_BEGIN; //Number of port to start looking for free ports
var LISTEN_PORT;
var NUMBER_WORKERS;

// Globals
global.redis = null;
global.workerPool = null;
global.jobQueue = null;


var start = function() {

    var dotenv = require('dotenv');
    // Load environment variables, either from .env files (development)
    dotenv.load();

    PORT_SEARCH_BEGIN = parseInt(process.env.PHANTOM_START_PORT);
    LISTEN_PORT = parseInt(process.env.PORT);
    NUMBER_WORKERS = parseInt(process.env.PHANTOM_WORKERS);

    redis = Redis.createClient(parseInt(process.env.REDIS_PORT), process.env.REDIS_HOST);

    redis.on('connect', function() {

        workerPool = new WorkerPool();

        // Create a job queue using the worker pool that has been created
        jobQueue = new JobQueue(workerPool);

        // First spawn the phantom processes that will serve the requests
        startPhantomWorkers( function() {

            // Once all the workers are ready start the API service
            API.start(LISTEN_PORT);

        } );

    });

    redis.on("error", function (err){
        console.log("Error " + err);
    });


};

var startPhantomWorkers = function(callback) {

    var workersReady = 0;

    var launchWorker = function(oneLaunchedCb) {

        // Find a free port and spawn a phantom service in that port
        getPort(function(port) {

            // If a worker dies, launch another one and try to process pending jobs
            var onKill = function(worker) {

                console.log("Worker " + worker.port + " killed!");

                launchWorker(function() {
                    jobQueue.processJobs();
                });
            };

            new PhantomWorker(port, workerPool, function(worker) {

                if(typeof oneLaunchedCb === 'function') oneLaunchedCb();

                if(++workersReady === NUMBER_WORKERS) {
                    callback();
                }

            }, onKill);

        });
    };

    console.log('Spawning ' + NUMBER_WORKERS + ' workers...');

    for(var i = 0; i < NUMBER_WORKERS; i++) {
        launchWorker();
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