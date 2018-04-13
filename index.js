'use strict';

var AWS = require('aws-sdk');
var mime = require('mime-types');
var _ = require('underscore');
var uuid = require('uuid');
var path = require('path');
var fs = require('fs');
var fsExt = require('fs-extra');
var Promise = require('bluebird');

/**
 * 
 * @param {object} options settings for upload 
 * @returns {object} Instance of StreamUpload
 */
function StreamUpload (options) {
    var that = this;

    that.settings = {
        allowedExt: [],
        allowedTypes: [],
        maxSize: null,
        baseFolder: '',
        storage: {}
    };

    var __parseExtensions = function () {
        that.settings.allowedExt.forEach(function (ext) {
            var fileType = mime.lookup(ext);
            that.settings.allowedTypes.push(fileType);
        });
        _.uniq(that.settings.allowedTypes);
    };

    var __setExtensions = function (extensions) {
        if (!Array.isArray(extensions)) {
            extensions = [extensions];
        }

        if (extensions.length) {
            that.settings.allowedExt = extensions;
            __parseExtensions();
        }

        return that.settings.allowedExt;
    };

    var __setTypes = function (types) {
        if (!Array.isArray(types)) {
            types = [types];
        }

        if (types.length) {
            that.settings.allowedTypes = that.settings.allowedTypes.concat(types);
            _.uniq(that.settings.allowedTypes);
        }

        return that.settings.allowedTypes;
    };

    var __setMaxSize = function (size) {
        if (_.isNumber(size) && size > -1) {
            that.settings.maxSize = size;
        }

        return that.settings.maxSize;
    };

    var __setBaseFolder = function (folder) {
        if (_.isString(folder)) {
            that.settings.baseFolder = path.normalize(folder);
        }

        return that.settings.baseFolder;
    };

    var __setStorage = function (params) {
        if (_.isObject(params)) {
            that.settings.storage = params;
        }

        return that.settings.storage;
    };

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
        if (that.settings.allowedTypes) {
            for (var i = 0; i < that.settings.allowedTypes.length; i++) {
                var exp = new RegExp(that.settings.allowedTypes[i]);
                if (exp.test(type)) {
                    return true;
                }
            }

            return false;
        }
    };

    var __checkFileSize = function (size) {
        if (that.settings.maxSize) {
            return size <= that.settings.maxSize;
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
        var filename = params.filename || path.join(that.settings.baseFolder, uuid.v4());

        AWS.config.update({accessKeyId: that.settings.storage.accessKeyId, secretAccessKey: that.settings.storage.secretAccessKey, region: that.settings.storage.region});
        var s3 = new AWS.S3({params: {Bucket: that.settings.storage.bucket}});

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

    var __uploadToLocal = function (inputStream, params) {
        return new Promise(function (resolve, reject) {
            var filename = params.filename || path.join(that.settings.baseFolder, uuid.v4());
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
            if (that.settings.storage.type && that.settings.storage.type.toLowerCase() === 's3') {
                return __uploadToS3(stream, params);
            } else {
                return __uploadToLocal(stream, params);
            }
        } else {
            return new Promise(function (resolve, reject) {
                return reject(checkValid);
            });
        }
    };

    return {
        upload: __upload,
        settings: that.settings,
        init: __init,
        setExtensions: __setExtensions,
        setTypes: __setTypes,
        setMaxSize: __setMaxSize,
        setStorage: __setStorage,
        checkFile: __checkFile,
        checkFileSize: __checkFileSize,
        checkFileType: __checkFileType
    };
}

module.exports = StreamUpload;
