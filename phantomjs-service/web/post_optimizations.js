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

/**
 * The code for the optimizations that has to be executed after the framework has been loaded
 */
(function() {

    // For nvd3: overwrite the addGraph method to make sure that the CHART_READY event is triggered
    if(nv != null) {
        window._addGraph = window._addGraph || nv.addGraph;
        nv.addGraph = function(generator, callback) {
            window._addGraph(generator, function(c) {
                flushAnimationFrames();
                Bridge.sendToPhantom("CHART_READY", null);
                if (typeof callback === 'function') callback(c);
            })
        };
    }

    // Deactivate animations and wait for the animation to be completed
    if(Chart != null) {
        var count = 2; //We need to wait for the second one (the first one is the creaion of the chart)
        Chart.defaults.global.animation = false;
        Chart.defaults.global.onAnimationComplete = function() {
            if(--count === 0) {
                Bridge.sendToPhantom("CHART_READY", null);
            }
        }
    }

    // Deactivate common widget loading transition
    framework.widgets.CommonWidget.prototype.startLoading = function() { };
    framework.widgets.CommonWidget.prototype.endLoading = function(cb) {
        cb();
    };

    window.resetOptimizations = function resetOptimizations() {
        count = 2; //Reset counter for the ChartJs optimization
    }

})();
