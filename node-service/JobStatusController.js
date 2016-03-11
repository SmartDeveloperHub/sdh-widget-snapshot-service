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

function JobStatusController () {
    this.nextId = 0;
    this.pending = {};
}

JobStatusController.prototype = {
    constructor: JobStatusController,

    watch: function(worker, job, timeout, onTimeout) {
        var id = this.nextId++;
        this.pending[id] = {
            worker: worker,
            job: job,
            onTimeout: onTimeout,
            timeoutId: setTimeout(onJobTimeoutController.bind(this, id), timeout)
        }
    },

    setFinished: function(id) {
        clearTimeout(this.pending[id].timeoutId);
        delete this.pending[id];
    }

};

var onJobTimeoutController = function(id) {

    var info = this.pending[id];

    clearTimeout(info.timeoutId);

    var next = true;
    if(typeof info.onTimeout === 'function') {
        next = info.onTimeout(info.worker, info.job) !== false;
    }

    if(next) {
        info.worker.kill();
    }

    delete this.pending[id];

};


module.exports = JobStatusController;