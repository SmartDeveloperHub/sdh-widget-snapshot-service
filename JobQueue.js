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

function JobQueue (workerPool) {
    this.queue = [];
    this.workerPool = workerPool;
}

JobQueue.prototype = {
    constructor: JobQueue,

    queueJob: function(method, onTop, data) {

        // If it has priority, put it at the beginning of the queue
        if(onTop) {
            this.queue.unshift({
                data: data,
                method: method
            });

        } else {
            this.queue.push({
                data: data,
                method: method
            });
        }
    },

    nextJob: function(worker) {

        var job = this.queue.shift();

        if(job != null) {
            job.method(worker, job.data);
        }

    },
    executeOrQueueJob: function(method, onTop, data) {

        //Select the worker that will handle this request
        var worker = this.workerPool.getIdleAndAddJob();

        if(worker != null && this.queue.length === 0) { //If an idle worker is found and this is the only job
            method(worker, data);

        } else if(worker != null) { // If there are jobs pending, queue this one and execute the next one

            this.queueJob(method, onTop, data);
            this.nextJob(worker);

        } else { // No idle workers, queue request

            this.queueJob(method, onTop, data);

        }

    }


};

module.exports = JobQueue;