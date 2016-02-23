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

(function() {

    var __loader = (function() {

        var Bridge = {

            sendToPhantom: function sendToPhantom(type, data) {
                window.callPhantom({type: type, data: data});
            },

            transmitEvent: function(obj, event, sendArgs) {
                this.transmitEventAndExecute(obj, event, sendArgs);
            },

            transmitEventAndExecute: function(obj, event, sendArgs, func) {
                $(obj).on(event, function(e) {

                    var data = null;
                    if(sendArgs === true) {
                        data = [];
                        for(var i = 1; i < arguments.length; i++) {
                            data.push(arguments[i]);
                        }
                    }

                    if(typeof func === 'function') func();
                    Bridge.sendToPhantom(event, data);
                });
            },

            stopEventTransmission: function(obj, event) {
                $(obj).off(event);
            }
        };

        window.Bridge = Bridge;
        return Bridge;

    });

    // AMD compliant
    if ( typeof define === "function" && define.amd) {
        define( [
            'jquery'
        ], function () {
            return __loader();
        } );
    } else {
        __loader();
    }

})();



