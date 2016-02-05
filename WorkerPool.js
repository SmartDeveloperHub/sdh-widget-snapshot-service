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

function WorkerPool (jobsPerWorker) {
    this.jobsPerWorker = jobsPerWorker || 1;
    this.busy = [];
    this.idle = [];
}

WorkerPool.prototype = {
    constructor: WorkerPool,

    add: function(worker) {
        this.idle.push({
            worker: worker,
            jobs: 0
        });
    },

    allBusy: function() {
        return this.idle.length === 0;
    },

    allIdle: function() {
        return this.busy.length === 0;
    },

    getIdleAndAddJob: function() {
        var worker = this.idle.pop();
        if(worker != null) {
            if(++worker.jobs < this.jobsPerWorker) { //Not all concurrent jobs reached so add it to the end of idle queue
                this.idle.push(worker);
            } else { // All concurrent jobs reached so add it to the busy queue
                this.busy.push(worker);
            }
        }
        return worker.worker;
    },

    setIdle: function(worker) {

        var index = indexOfWorkerInList(worker, this.idle);

        if(index >= 0) { //It is in the idle queue
            this.idle[index]['jobs']--;

        } else { //Try to find it in the busy queue

            index = indexOfWorkerInList(worker, this.busy);

            if(index != -1) {
                this.busy[index]['jobs']--;
                this.idle.push(this.busy.splice(index, 1)[0]);
            } else {
                throw new Error("Worker could not be found!");
            }
        }

    },

    isBusy: function(worker) {
        return indexOfWorkerInList(worker, this.busy) !== -1;
    }
};

var indexOfWorkerInList = function(worker, list) {
    for(var i = 0; i < list.length; i++) {
        if(list[i].worker === worker) {
            return i;
        }
    }
    return -1;
};

module.exports = WorkerPool;