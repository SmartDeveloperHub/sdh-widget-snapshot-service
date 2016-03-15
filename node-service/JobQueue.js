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

    queueJob: function(job, onTop) {
        // If it has priority, put it at the beginning of the queue
        if(onTop) {
            this.queue.unshift(job);

        } else {
            this.queue.push(job);
        }
    },

    processJobs: function() {

        do {
            var job = this.queue.shift();

            if(job != null) { // Try to execute job in an idle worker
                var worker = this.workerPool.executeJobInIdle(job);
                if(worker == null) { //Could not be executed, add it again to the queue
                    this.queue.unshift(job);
                }
            }
        } while(job != null && worker != null);

    },

    executeOrQueueJob: function(job, onTop) { //TODO: remove this method

        // Queue the job
        this.queueJob(job, onTop);

        this.processJobs();

    }


};

module.exports = JobQueue;