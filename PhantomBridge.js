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

function Bridge (id) {
    this.id = id;
    this.page = null;
    this.onReadyCallback = null;
    this.externalMessageHandler = null;
    this.widgetList = null;
    this.isReady = false;

}

Bridge.prototype = {
    constructor: Bridge

    /**
     * Initialize.
     * @param onReady
     */
    , initFramework: function(widgetList, externalMessageHandler, onReady) {

        if(!(widgetList instanceof Array)) {
            throw new Error(this.msg('The widgetList parameter must contain a list of objects {path: "path_to_widget", name: "name"}.'));
        }

        if(typeof onReady !== 'function') {
            throw new Error(this.msg('A callback function must be specified in "initFramework" method.'));
        }

        this.widgetList = widgetList;
        this.onReadyCallback = onReady;
        this.externalMessageHandler = externalMessageHandler;

        this.page = require('webpage').create();

        //TODO: create a debug option
        this.page.onConsoleMessage = function(msg, lineNum, sourceId) {
            console.log(this.msg('WEB-CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")'));
        }.bind(this);

        // Message handler (between Phantom and the WebExecutor)
        this.page.onCallback = messageHandler.bind(this);

        // Load the web executor where the charts will be rendered
        this.page.open('web/webExecutor.html', function(status) {
            if(status === 'fail') { //Failed to load the WebExecutor

                this.destroy();

                onReady(false);
            } else {
                this.page.navigationLocked = true; //Security: do not allow changes in location
            }
        }.bind(this));

    }

    , close: function() {

        this.isReady = false;
        this.page.onCallback = null;
        this.page.onConsoleMessage = null;
        this.page.close();
        this.page = null;
        this.onReadyCallback = null;

    }

    , isReady: function() {
        return this.isReady;
    }

    , getPage: function() {
        return this.page;
    }

    , msg: function(txt) {
        return 'PhantomBridge('+this.id+') ' + txt;
    }


};

/**
 * This method handles all the messages sent from the webExecutor to Phantom
 * @param data
 */
var messageHandler = function(data) {

    switch (data.type) {
        case "requireJsReady": onRequireJsReady.call(this, data.data); break;
        case "frameworkReady": onFrameworkReady.call(this, data.data); break;
        default:
            if(typeof this.externalMessageHandler === 'function') {
                this.externalMessageHandler(data);
            }
            break;
    }
};

var frameworkInitializationWebFunction = function(widgets) {

    $(window).on("FRAMEWORK_INITIALIZATION_ERROR", function(event, d) {
        Bridge.sendToPhantom("frameworkReady", {success: false, error: d});
    });

    require(widgets, function() {

        window.framework.ready(function() {
            Bridge.sendToPhantom("frameworkReady", {success: true});
        });

    }, function (err) {
        Bridge.sendToPhantom("frameworkReady", {success: false, error: err});
    });

};

/*
 *  ---------------------- EVENT HANDLERS --------------------------
 */
var onFrameworkReady = function(data) {

    if(data.success) {

        this.ready = true;

        this.onReadyCallback(true);

    } else {
        console.error("Error in framework initialization!", data.error);
        this.onReadyCallback(false);
    }

};

var onRequireJsReady = function(data) {

    if(data.success) {
        this.page.evaluate(frameworkInitializationWebFunction, this.widgetList);
    } else {
        console.error("Error in requireJs initialization!", data.error);
        this.onReadyCallback(false);
    }

};


module.exports = Bridge;
