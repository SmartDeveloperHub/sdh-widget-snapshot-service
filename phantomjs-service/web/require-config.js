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
    packages: [
        {
            name: 'sdh-framework',
            location: 'vendor/sdh-framework',
            main: 'framework'
        },
        {
            name: 'datatables',
            location: 'vendor/datatables',
            main: 'media/js/jquery.dataTables.min'
        },
        {
            name: 'jquery-qtip',
            location: 'vendor/qtip2',
            main: 'jquery.qtip.min'
        }
    ],
    paths: {
        'require-css': 'vendor/require-css/css',
        'dashboard-controller': "assets/js/dashboardController",
        'headerHandler': "assets/js/header/headerHandler",
        'bootstrap': "vendor/bootstrap/dist/js/bootstrap.min",
        'bootstrap-css': "vendor/bootstrap/dist/css/bootstrap.min",
        'backbone': 'vendor/backbone/backbone-min',
        'underscore': 'vendor/underscore/underscore-min',
        'd3': "vendor/d3/d3",
        'nvd3': "vendor/nvd3/build/nv.d3",
        'jquery': 'vendor/jquery/dist/jquery',
        'jquery-ui': 'vendor/jquery-ui/ui',
        'moment': "vendor/moment/moment",
        'lodash': 'vendor/lodash/lodash',
        'gridstack': 'vendor/gridstack/dist/gridstack',
        'joint': 'vendor/joint/dist/joint.min',
        'cytoscape': 'vendor/cytoscape/dist/cytoscape',
        'cytoscape-qtip': 'vendor/cytoscape-qtip/cytoscape-qtip',
        'cola': 'vendor/cytoscape/lib/cola.v3.min',
        'chartjs': 'vendor/Chart.js/Chart.min',
        'roboto-fontface': 'vendor/roboto-fontface'
    },
    shim : {
        'nvd3': {
            exports: 'nv',
            deps: ['d3']
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