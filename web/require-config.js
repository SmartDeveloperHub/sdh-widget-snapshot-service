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

require.config({
    baseUrl: PUBLIC_PATH,
    //enforceDefine: true,
    map: {
        '*': {
            'css': 'require-css' // or whatever the path to require-css is
        }
    },
    paths: {
        'require-css': 'vendor/require-css/css',
        'framework': "vendor/sdh-framework/framework",
        'headerHandler': "assets/js/header/headerHandler",
        'widgetCommon': 'vendor/sdh-framework/framework.widget.common',
        'bootstrap': "vendor/bootstrap/dist/js/bootstrap.min",
        'backbone': 'vendor/backbone/backbone-min',
        'underscore': 'vendor/underscore/underscore-min',
        'd3': "vendor/d3/d3.min",
        'nvd3': "vendor/nvd3/build/nv.d3.min",
        'jquery': 'vendor/jquery/dist/jquery',
        'jquery-ui': 'vendor/jquery-ui/ui',
        'jquery-qtip': 'vendor/qtip2/jquery.qtip.min',
        'moment': "vendor/moment/moment",
        'datatables' : 'vendor/datatables/media/js/jquery.dataTables.min',
        'lodash': 'vendor/lodash/lodash.min',
        'gridstack': 'vendor/gridstack/dist/gridstack',
        'joint': 'vendor/dist/joint/joint.min',
        'cytoscape': 'vendor/cytoscape/dist/cytoscape',
        'cytoscape-qtip': 'vendor/cytoscape-qtip/cytoscape-qtip',
        'cola': 'vendor/cytoscape/lib/cola.v3.min'
    },
    shim : {
        'nvd3': {
            exports: 'nv',
            deps: ['d3', 'css!vendor/nvd3/build/nv.d3.min.css']
        },
        'headerHandler': {
            deps: ['jquery']
        },
        'cytoscape': {
            exports: 'cytoscape',
            deps: ['jquery']
        },
        'cytoscape-qtip': {
            exports: 'cytoscape-qtip',
            deps: ['jquery', 'jquery-qtip', 'cytoscape']
        },
        'cola': {
            exports: 'cola'
        },
        'bootstrap': {
            deps: ['jquery']
        }
    }
});