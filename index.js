'use strict';

var AWS = require('aws-sdk');
var mime = require('mime-types');
var _ = require('underscore');
var uuid = require('uuid');
var path = require('path');
var fs = require('fs');
var fsExt = require('fs-extra');
var Promise = require('bluebird');

function StreamUpload (options) {
    var self = this;

    self.settings = {
        allowedExt: [],
        allowedTypes: [],
        maxSize: null,
        baseFolder: '',
        storage: {}
    }

    var __parseExtensions = function () {
        self.settings.allowedExt.forEach(function (ext) {
            var fileType = mime.lookup(ext);
            self.settings.allowedTypes.push(fileType);
        });
        _.uniq(self.settings.allowedTypes);
    };

    var __setExtensions = function (extensions) {
        if (!Array.isArray(extensions)) {
            extensions = [extensions];
        }

        if (extensions.length) {
            self.settings.allowedExt = extensions;
            __parseExtensions();
        }

        return self.settings.allowedExt;
    };

    var __setTypes = function (types) {
        if (!Array.isArray(types)) {
            types = [types];
        }

        if (types.length) {
            self.settings.allowedTypes = self.settings.allowedTypes.concat(types);
            _.uniq(self.settings.allowedTypes);
        }

        return self.settings.allowedTypes;
    };

    var __setMaxSize = function (size) {
        if (_.isNumber(size) &&  size > -1) {
            self.settings.maxSize = size;
        }
        return self.settings.maxSize;
    };

    var __setBaseFolder = function (folder) {
        if(_.isString(folder)) {
            self.settings.baseFolder = path.normalize(folder);
        }
        return self.settings.baseFolder;
    };

    var __setStorage = function (params) {
        if (_.isObject(params)) {
            self.settings.storage = params;
        }
        return self.settings.storage;
    }

    var __init = function (options) {
        if (options.extensions) {
            __setExtensions(options.extensions);
        }
        if (options.types) {
            __setTypes(options.types);
        }
        __setMaxSize(options.maxSize);
        __setBaseFolder(options.baseFolder);
        __setStorage(options.storage);
    };

    if (options) {
        __init(options);
    }

    var __checkFileType = function (type) {
        if (self.settings.allowedTypes) {
            for (var i=0; i < self.settings.allowedTypes.length; i++) {
                var exp = new RegExp(self.settings.allowedTypes[i]);
                if (exp.test(type)) {
                    return true;
                }
            }
            return false;
        }
    };

    var __checkFileSize = function (size) {
        if (self.settings.maxSize) {
            return size <= self.settings.maxSize;
        }

        return true;
    };

    var __checkFile = function (fileParams) {
        if (!fileParams) {
            return false;
        }
        var fileSizeValid = __checkFileSize(fileParams.size);
        if (fileSizeValid === true) {
            var fileTypeValid = __checkFileType(fileParams.type);
            if (!fileTypeValid) {
                return new Error('File type is invalid');
            }

            return fileTypeValid;
        } else {
            return new Error('File size is invalid');
        }
    };

    var __uploadToS3 = function (inputStream, params) {
        var filename = params.filename || path.join(baseFolder, uuid.v4());

        AWS.config.update({accessKeyId: self.settings.storage.accessKeyId, secretAccessKey: self.settings.storage.secretAccessKey, region: self.settings.storage.region});
        var s3 = new AWS.S3({params: {Bucket: self.settings.storage.bucket}});

        return new Promise(function (resolve, reject) {
            return s3
                .upload({Key: filename, Body: inputStream, ACL: 'public-read'})
                .promise()
                .then(function (data) {
                    return resolve(data.Location);
                }).catch(function (err) {
                    return reject(err);
                });
        });
        

    };

    var _uploadToLocal = function (inputStream, params) {
        return new Promise(function (resolve, reject) {
            var filename = params.filename || path.join(self.settings.baseFolder, uuid.v4());
            // Make sure the output directory is there.
            fsExt.ensureDirSync(path.dirname(filename));

            var wr = fs.createWriteStream(filename);
            wr.on('error', function (err) {
                return reject(err);
            });
            wr.on('finish', function () {
                return resolve(filename);
            });

            inputStream.pipe(wr);
        });
    };

    var __upload = function (stream, params) {
        var checkValid = __checkFile(params);
        if (checkValid === true) {
            if (self.settings.storage.type && self.settings.storage.type.toLowerCase() === 's3') {
                return _uploadToS3(stream, params);
            } else {
                return _uploadToLocal(stream, params);
            }
        } else {
            return new Promise(function (resolve, reject) {
                return reject(checkValid);
            });
        }
    };
    return {
        upload: __upload,
        settings: self.settings,
        init: __init,
        setExtensions: __setExtensions,
        setTypes: __setTypes,
        setMaxSize: __setMaxSize,
        setStorage: __setStorage,
        checkFile: __checkFile,
        checkFileSize: __checkFileSize,
        checkFileType: __checkFileType
    }
};

module.exports = StreamUpload;
