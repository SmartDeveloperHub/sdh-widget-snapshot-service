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

function PhantomWorker (process, port, maxJobs) {
    this.process = process;
    this.port = port;
    this.currentJobs = 0;
    this.maxJobs = maxJobs;

    process.stdout.on('data', function(data) {
        console.log("[PhantomService]["+port+"]: " + data);
    });

    process.stderr.on('data', function(data) {
        console.error("[PhantomService]["+port+"]: " + data);
    });
}

PhantomWorker.prototype = {
    constructor: PhantomWorker,

    kill: function () {
        this.process.exit(0);
        this.maxJobs = 0;
        this.currentJobs = 0;
        this.process = null;
    },

    decrementJobCount: function() {
        if(this.currentJobs > 0) {
            this.currentJobs--;
        }
    },

    incrementJobCount: function() {
        if(this.currentJobs < this.maxJobs) {
            this.currentJobs++;
        } else {
            throw new Error("This worker has reached the maximum of jobs");
        }
    },

    isCompletellyBusy: function() {
        return this.currentJobs >= this.maxJobs;
    }

};


module.exports = PhantomWorker;