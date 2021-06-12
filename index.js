'use strict';

const AWS = require('aws-sdk');
const mime = require('mime-types');
const _ = require('underscore');
const uuid = require('uuid');
const path = require('path');
const fs = require('fs');
const fsExt = require('fs-extra');

/**
 *
 * @param {object} options settings for upload
 * @returns {object} Instance of StreamUpload
 */
function StreamUpload (options) {
    let that = this;

    that.settings = {
        allowedExt: [],
        allowedTypes: [],
        maxSize: null,
        baseFolder: '',
        storage: {}
    };
    that.size = 0;

    const __parseExtensions = function () {
        that.settings.allowedExt.forEach(function (ext) {
            const fileType = mime.lookup(ext);
            that.settings.allowedTypes.push(fileType);
        });
        _.uniq(that.settings.allowedTypes);
    };

    const __setExtensions = function (extensions) {
        if (!Array.isArray(extensions)) {
            extensions = [extensions];
        }

        if (extensions.length) {
            that.settings.allowedExt = extensions;
            __parseExtensions();
        }

        return that.settings.allowedExt;
    };

    const __setTypes = function (types) {
        if (!Array.isArray(types)) {
            types = [types];
        }

        if (types.length) {
            that.settings.allowedTypes = that.settings.allowedTypes.concat(types);
            _.uniq(that.settings.allowedTypes);
        }

        return that.settings.allowedTypes;
    };

    const __setMaxSize = function (size) {
        if (_.isNumber(size) && size > -1) {
            that.settings.maxSize = size;
        }

        return that.settings.maxSize;
    };

    const __setBaseFolder = function (folder) {
        if (_.isString(folder)) {
            that.settings.baseFolder = path.normalize(folder);
        }

        return that.settings.baseFolder;
    };

    const __setStorage = function (params) {
        if (_.isObject(params)) {
            that.settings.storage = params;
        }

        return that.settings.storage;
    };

    const __init = function (options) {
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

    const __checkFileType = function (type) {
        if (that.settings.allowedTypes && that.settings.allowedTypes.length) {
            for (let i = 0; i < that.settings.allowedTypes.length; i++) {
                const exp = new RegExp(that.settings.allowedTypes[i]);
                if (exp.test(type)) {
                    return true;
                }
            }

            return false;
        }

        return true;
    };

    const __checkFileSize = function (size) {
        if (that.settings.maxSize) {
            return size <= that.settings.maxSize;
        }

        return true;
    };

    const __checkFile = function (fileParams) {
        let error;

        const fileSizeValid = __checkFileSize(that.size);
        if (fileSizeValid === true) {
            const fileTypeValid = __checkFileType(fileParams.type);
            if (!fileTypeValid) {
                error = new Error('File type ' + fileParams.type + ' is invalid');
                error.type = 'fileType';
                error.statusCode = 403;
                return error;
            }

            return fileTypeValid;
        } else {
            error = new Error('File size: ' + that.size + ' is invalid');
            error.type = 'fileSize';
            error.statusCode = 403;
            return error;
        }
    };

    const __uploadToS3 = async function (inputStream) {
        const config = {accessKeyId: that.settings.storage.accessKeyId, secretAccessKey: that.settings.storage.secretAccessKey, region: that.settings.storage.region};
        AWS.config.update(config);
        const s3 = new AWS.S3({params: {Bucket: that.settings.storage.bucket}});

        return (await s3.upload({Key: that.filename, Body: inputStream, ACL: 'public-read'}).promise()).Location;
    };

    const __uploadToLocal = async function (inputStream, params) {
        return new Promise(function (resolve, reject) {
            // Make sure the output directory is there.
            fsExt.ensureDirSync(path.dirname(that.filename));

            const wr = fs.createWriteStream(that.filename);
            wr.on('error', function (err) {
                return reject(err);
            });
            wr.on('finish', function () {
                return resolve(that.filename);
            });

            inputStream.pipe(wr);
        });
    };

    const __sizeGetter = function (data) {
        that.size += data.length;
    }

    const __deletePartials = function () {
        if (that.settings.storage.type && that.settings.storage.type.toLowerCase() === 's3') {
            const config = {accessKeyId: that.settings.storage.accessKeyId, secretAccessKey: that.settings.storage.secretAccessKey, region: that.settings.storage.region};
            AWS.config.update(config);
            const s3 = new AWS.S3({params: {Bucket: that.settings.storage.bucket}});
            s3
                .deleteObject({Key: that.filename})
        } else {
            fs.unlink(that.filename);
        }
    }

    const __upload = function (stream, params) {
        let checkValid;
        that.filename = params.filename || path.join(that.settings.baseFolder, uuid.v4());
        if (that.settings.storage.type && that.settings.storage.type.toLowerCase() === 's3') {
            checkValid = __checkFile(params);
        } else {
            stream.on('data', __sizeGetter);
            checkValid = __checkFile(params);
            stream.removeListener('data', __sizeGetter);
        }

        if (checkValid === true) {
            if (that.settings.storage.type && that.settings.storage.type.toLowerCase() === 's3') {
                return __uploadToS3(stream, params);
            } else {
                return __uploadToLocal(stream, params);
            }
        } else {
            __deletePartials(params);

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

