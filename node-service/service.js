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


const path = require('path');
const childProcess = require('child_process');
const phantomjs = require('phantomjs-prebuilt');
const net = require('net');
const fs = require('fs');
const WorkerPool = require('./../common/WorkerPool');
const PhantomWorker = require('./PhantomWorker');
const JobQueue = require('./JobQueue');
const config = require('./../config');
const Redis = require('redis');
const API = require('./API');

var PORT_SEARCH_BEGIN = config.phantom.start_port; //Number of port to start looking for free ports
var LISTEN_PORT = config.port;
var NUMBER_WORKERS = config.phantom.workers;
var NUMBER_EXECUTORS_PER_WORKER = config.phantom.executors_per_worker;

// Globals
global.redis = null;
global.workerPool = null;
global.jobQueue = null;


var start = function() {

    redis = Redis.createClient(config.persistence.redis.port, config.persistence.redis.host);

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

    //Path to the PhantomJS executable
    var phantomJsExecutable = phantomjs.path;

    var workersReady = 0;

    var launchWorker = function(oneLaunchedCb) {

        // Find a free port and spawn a phantom service in that port
        getPort(function(port) {

            var childArgs = [
                "--web-security=false",
                path.join(__dirname, '..', 'phantomjs-service', 'phantomjs-service.js'),
                port
            ];

            if(config.phantom.cache) {
                childArgs.unshift("--disk-cache=true");
                if(config.phantom.cache_limit > 0) {
                    childArgs.unshift("--max-disk-cache-size=" + parseInt(config.phantom.cache_limit));
                }
            }

            var procOpts = {
                cwd: path.join(__dirname, '..', 'phantomjs-service')
            };

            // Spawn the worker process
            var proc = childProcess.execFile(phantomJsExecutable, childArgs, procOpts);

            var onKill = function(worker) {
                launchWorker(function() {
                    jobQueue.processJobs();
                });
            };

            new PhantomWorker(proc, port, workerPool, function(worker) {

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