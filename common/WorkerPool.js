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

function WorkerPool () {
    this.busy = [];
    this.idle = [];
}

WorkerPool.prototype = {
    constructor: WorkerPool,

    add: function(worker) {
        this.idle.push(worker);
    },

    allBusy: function() {
        return this.idle.length === 0;
    },

    allIdle: function() {
        return this.busy.length === 0;
    },

    getIdleAndAddJob: function() {
        var worker = this.idle.shift();
        if(worker != null) {
            worker.incrementJobCount();
            if(!worker.isCompletellyBusy()) { //Not all concurrent jobs reached so add it to the end of idle queue
                this.idle.push(worker);
            } else { // All concurrent jobs reached so add it to the busy queue
                this.busy.push(worker);
            }
            return worker;
        }

        return null; //Null in case there are no idle workers

    },

    setIdle: function(worker) {

        var index = this.idle.indexOf(worker);

        if(index >= 0) { //It is in the idle queue
            this.idle[index].decrementJobCount();

        } else { //Try to find it in the busy queue

            index = this.busy.indexOf(worker);

            if(index != -1) {
                this.busy[index].decrementJobCount();
                this.idle.push(this.busy.splice(index, 1)[0]);
            } else {
                throw new Error("Worker could not be found!");
            }
        }

    }
};

module.exports = WorkerPool;