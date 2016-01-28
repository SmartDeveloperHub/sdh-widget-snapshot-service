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

    getIdleAndSetBusy: function() {
        var worker = this.idle.pop();
        if(worker != null) {
            this.busy.push(worker);
        }
        return worker;
    },

    setIdle: function(worker) {
        var index = this.busy.indexOf(worker);
        if(index != -1) {
            this.idle.push(this.busy.splice(index, 1)[0]);
        } else {
            throw new Error("Worker could not be found in the busy list!");
        }

    },

    isBusy: function(worker) {
        return this.busy.indexOf(worker) !== -1;
    }
};

module.exports = WorkerPool;