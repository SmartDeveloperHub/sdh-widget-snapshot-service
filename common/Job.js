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

function Job (method, data, maxExecTime, onAbort) {
    this.method = method;
    this.data = data;
    this.maxExecTime = maxExecTime;
    this.id = Job.prototype.nextId++;
    this.worker = null;
    this.status = 0;
    this.onAbort = onAbort;
}

Job.prototype = {
    constructor: Job,
    nextId: 0,

    start: function(worker) {
        if(this.status === 0) {
            this.status = 1;
            this.worker = worker;
            this.method(this);
        }
    },

    setFinished: function() {
        if(this.status === 1) {
            this.status = 2;
            this.worker.setJobFinished(this);
        }
    },

    abort: function(status, msg) {
        if(this.status === 1) {
            this.worker.setJobFinished(this);
            if(typeof this.onAbort === 'function') this.onAbort(this, status, msg);
        }
    }

};

module.exports = Job;