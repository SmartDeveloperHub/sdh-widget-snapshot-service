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

const uuid = require('node-uuid');
const fs = require('fs');
const path = require('path');

var freeingStorageSpace = false;


var persistFile = function(tmp_file, mime, cb) {

    var fileId = uuid.v4();
    var fileName = process.env.PERSISTENCE_PREFIX + fileId;
    var newFilePath = path.join(
        process.env.PERSISTENCE_DIRECTORY,
        fileName
    );

    fs.rename(tmp_file, newFilePath, function(err) {

        if (err) {
            return cb(err);
        }

        // Obtain the information about the file
        fs.stat(newFilePath, function (err, stats) {

            // Save the file information in redis
            redis.hmset(fileId, {
                'name': fileName,
                'size': stats.size,
                'creation': new Date().getTime(),
                'lastAccess': new Date().getTime(),
                'mime': mime
            });

            redis.sadd('fileIds', fileId);

            // Increment the total space used
            redis.incrby('totalSpace', stats.size, function (err, total) {
                if (err) return console.error(err);

                if (total > process.env.PERSISTENCE_MAX_SIZE) {
                    freeStorageSpace();
                }
            });

        });

        //For performance we are supposing that no problems will happen while storing the info in redis
        cb(null, fileId);

    });

};


var getPersistedFile = function(fileId, cb) {


    redis.hgetall(fileId, function(err, fileInfo) {

        if(err) {
            return cb(err);
        }

        if(fileInfo == null) {
            return cb(new Error("The file could not be found"))
        }

        var filePath = path.join(
            process.env.PERSISTENCE_DIRECTORY,
            fileInfo.name
        );

        // Update last access timestamp
        redis.hset(fileId, 'lastAccess', new Date().getTime());

        cb(null, filePath, fileInfo);

    });

};

//TODO: Refactor
var freeStorageSpace = function () {

    if(!freeingStorageSpace) {
        freeingStorageSpace = true;

        redis.get("totalSpace", function(err, val) {

            if(err) {
                freeingStorageSpace = false;
                return console.error(err);
            }

            var currentSize = parseInt(val);

            var amountToFree = currentSize - (process.env.PERSISTENCE_MAX_SIZE * process.env.PERSISTENCE_FREE_PERCENTAGE / 100);
            var freedAmount = 0;
            //TODO: make sure the space is decremented before freeingStorageSpace is set to false

            redis.sort("fileIds", 'by', "*->lastAccess", 'get', '#', 'get', '*->size', 'get', '*->name', 'LIMIT', "0", "30", function(err, result) {
                for(var i = 0; i < result.length && freedAmount < amountToFree; i+=3) {
                    var id = result[i];
                    var size = parseInt(result[i+1]);
                    var name = result[i+2];

                    redis.del(id);
                    redis.srem('fileIds', id);
                    redis.decrby('totalSpace', size);

                    var filePath = path.join(
                        process.env.PERSISTENCE_DIRECTORY,
                        name
                    );

                    fs.unlink(filePath);

                    freedAmount += size;

                }

                freeingStorageSpace = false;
            });

        });


    }

};

module.exports = {
    persistFile: persistFile,
    getPersistedFile: getPersistedFile
};