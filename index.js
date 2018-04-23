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
    that.size = 0;

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
        var error;

        var fileSizeValid = __checkFileSize(that.size);
        if (fileSizeValid === true) {
            var fileTypeValid = __checkFileType(fileParams.type);
            if (!fileTypeValid) {
                error = new Error('File type is invalid');
                error.type = 'fileType';
                error.statusCode = 403;
                return error;
            }

            return fileTypeValid;
        } else {
            error = new Error('File size is invalid');
            error.type = 'fileSize';
            error.statusCode = 403;
            return error;
        }
    };

    var __uploadToS3 = function (inputStream, params) {
        var config = {accessKeyId: that.settings.storage.accessKeyId, secretAccessKey: that.settings.storage.secretAccessKey, region: that.settings.storage.region};
        AWS.config.update(config);
        var s3 = new AWS.S3({params: {Bucket: that.settings.storage.bucket}});

        return new Promise(function (resolve, reject) {
            var uploader = s3
                .upload({Key: that.filename, Body: inputStream, ACL: 'public-read'})
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
            // Make sure the output directory is there.
            fsExt.ensureDirSync(path.dirname(that.filename));

            var wr = fs.createWriteStream(that.filename);
            wr.on('error', function (err) {
                return reject(err);
            });
            wr.on('finish', function () {
                return resolve(that.filename);
            });

            inputStream.pipe(wr);
        });
    };

    var __sizeGetter = function (data) {
        that.size += data.length;
    }
    var __deletePartials = function () {
        if (that.settings.storage.type && that.settings.storage.type.toLowerCase() === 's3') {
            var config = {accessKeyId: that.settings.storage.accessKeyId, secretAccessKey: that.settings.storage.secretAccessKey, region: that.settings.storage.region};
            AWS.config.update(config);
            var s3 = new AWS.S3({params: {Bucket: that.settings.storage.bucket}});
            s3
                .deleteObject({Key: that.filename})
        } else {
            fs.unlink(that.filename);
        }
    }
    var __upload = function (stream, params) {
        var checkValid;
        that.filename = params.filename || path.join(that.settings.baseFolder, uuid.v4());
        if (that.settings.storage.type && that.settings.storage.type.toLowerCase() === 's3') {
            stream.on('data', __sizeGetter);
            checkValid = __checkFile(params);
            stream.removeListener('data', __sizeGetter);
        } else {
            checkValid = __checkFile(params);
        }
        
        if (checkValid === true) {
            if (that.settings.storage.type && that.settings.storage.type.toLowerCase() === 's3') {
                return __uploadToS3(stream, params);
            } else {
                return __uploadToLocal(stream, params);
            }
        } else {
            __deletePartials(params)
            return stream.emit('error', checkValid);
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
        checkFileType: __checkFileType,
        deletePartials: __deletePartials
    };
}

module.exports = StreamUpload;
