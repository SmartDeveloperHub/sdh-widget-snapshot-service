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

var childProcess = require('child_process');
var phantomjs = require('phantomjs-prebuilt');
var path = require('path');

//TODO: create a parent class for workers that contains the common methods
function PhantomWorker (port, workerPool, onReady, onKill) {
    this.port = port;
    this.currentJobs = 0;
    this.maxJobs = 0;
    this.timeout = null;
    this.jobs = {};
    this.workerPool = workerPool;
    this.onKill = onKill;

    this.workerPool.add(this);

    //Path to the PhantomJS executable
    var phantomJsExecutable = phantomjs.path;

    var childArgs = [
        "--web-security=false",
        path.join(__dirname, '..', 'phantomjs-service', 'phantomjs-service.js'),
        port,
        process.env.PHANTOM_EXECUTORS_PER_WORKER,
        process.env.PHANTOM_TIMEOUT,
        process.env.SDH_API_URL
    ];

    if(process.env.CACHE) {
        childArgs.unshift("--disk-cache=true");
        if(process.env.CACHE_LIMIT > 0) {
            childArgs.unshift("--max-disk-cache-size=" + parseInt(process.env.CACHE_LIMIT));
        }
    }

    var procOpts = {
        cwd: path.join(__dirname, '..', 'phantomjs-service')
    };

    // Spawn the worker process
    this.process = childProcess.execFile(phantomJsExecutable, childArgs, procOpts);

    this.process.stdout.on('data', function(data) {
        if(data.indexOf("Worker started in port " + port) != -1) { //TODO: improve this way os passing messages
            onReady(this);
        } else if(data.indexOf("Executor ready") != -1) {
            this.increaseMaxJobs(1);
            jobQueue.processJobs();
        }
        data = data.replace(/\n$/, ""); //Remove last new line (console.log adds one)
        console.log("[PhantomService]["+port+"]: " + data);
    }.bind(this));

    this.process.stderr.on('data', function(data) {
        data = data.replace(/\n$/, ""); //Remove last new line (console.log adds one)
        console.error("[PhantomService]["+port+"]: " + data);
    });

}

PhantomWorker.prototype = {
    constructor: PhantomWorker,

    kill: function () {

        // Abort all jobs
        for(var jid in this.jobs) {
            this.jobs[jid].job.abort(408, "Max execution time reached");
        }

        this.process.kill('SIGKILL');
        this.maxJobs = 0;
        this.currentJobs = 0;
        this.process = null;
        this.workerPool.remove(this);
        this.onKill(this);

    },

    setJobFinished: function(job) {
        if(this.currentJobs > 0) {

            this.currentJobs--;

            this.workerPool.setIdle(this);

            var jobInfo = this.jobs[job.id];
            delete this.jobs[job.id];

            clearTimeout(jobInfo.timeout);

        }
    },

    startJob: function(job) {
        if(this.currentJobs < this.maxJobs) {

            // Add the job to the list of jobs
            this.jobs[job.id] = {
                job: job,
                timeout: setTimeout(this.kill.bind(this), job.maxExecTime + 2000)
            };

            this.currentJobs++;

            // Run the job
            job.start(this);

        } else {
            throw new Error("This worker has reached the maximum of jobs");
        }
    },

    isCompletellyBusy: function() {
        return this.currentJobs >= this.maxJobs;
    },

    decreaseMaxJobs: function(amount) {
        if(amount > 0) {
            this.maxJobs -= amount;
            if (this.maxJobs < 0) {
                this.maxJobs = 0;
            }
            this.workerPool.refresh(this);
        }
    },

    increaseMaxJobs: function(amount) {
        if(amount > 0) {
            this.maxJobs += amount;
            this.workerPool.refresh(this);
        }
    }

};


module.exports = PhantomWorker;