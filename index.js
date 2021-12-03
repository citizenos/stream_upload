'use strict';

const AWS = require('aws-sdk');
const mime = require('mime-types');
const _ = require('underscore');
const uuid = require('uuid');
const path = require('path');
const fs = require('fs');
const fsExt = require('fs-extra');
const {PassThrough, finished} = require('stream');
const { on } = require('events');

class ValidationError extends Error {
    constructor (message, type) {
        super(message);

        // assign the error class name in your custom error (as a shortcut)
        this.name = this.constructor.name;
        this.type = type;
        this.statusCode = 403;

        // capturing the stack trace keeps the reference to your error class
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 *
 * @param {object} options settings for upload
 * @returns {object} Instance of StreamUpload
 */
function StreamUpload (options) {

    const that = this;

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
            if (fileType) {
                that.settings.allowedTypes.push(fileType);
            }
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

    const __checkFileType = function (type, name, stream) {
        const fileType = mime.lookup(path.extname(name));
        if (fileType !== type) {
            stream.unpipe();

            stream.emit('error', new ValidationError('File type ' + type + ' is invalid', 'fileType'));
        }
        if (that.settings.allowedTypes && that.settings.allowedTypes.length) {
            for (let i = 0; i < that.settings.allowedTypes.length; i++) {
                const exp = new RegExp(that.settings.allowedTypes[i].replace('+', '\\+').replace('.', '\\.'));
                if (exp.test(type)) {
                    return true;
                }
            }

            stream.unpipe();

            stream.emit('error', new ValidationError('File type ' + type + ' is invalid', 'fileType'));
        } else {
            return true;
        }
    };

    const __checkFileSize = function () {
        if (that.settings.maxSize) {
            return that.size <= that.settings.maxSize;
        }

        return true;
    };

    const __uploadToS3 = async function (inputStream, resolve, reject) {
        const config = {accessKeyId: that.settings.storage.accessKeyId, secretAccessKey: that.settings.storage.secretAccessKey, region: that.settings.storage.region};
        AWS.config.update(config);
        const s3 = new AWS.S3({params: {Bucket: that.settings.storage.bucket}});
        const s3Upload = s3.upload({Key: that.filename, Body: inputStream, ACL: 'public-read'});
        inputStream.on('error', function (err) {
            s3Upload.abort();

            return reject(err);
        });
        const uploadPromise = await s3Upload.promise();
        const link = uploadPromise.Location;

        return resolve({
            size: that.size,
            filename: link
        });
    };

    const __uploadToLocal = function (inputStream, resolve, reject) {
        // Make sure the output directory is there.
        fsExt.ensureDirSync(path.dirname(that.filename));

        const wr = fs.createWriteStream(that.filename);
        inputStream
            .pipe(wr)
            .on('error', reject)
            .on('finish', function () {
                return resolve({
                    size: that.size,
                    filename: that.filename
                });
            });

    };

    const __deletePartials = function () {
        if (that.settings.storage.type && that.settings.storage.type.toLowerCase() === 's3') {
            const config = {accessKeyId: that.settings.storage.accessKeyId, secretAccessKey: that.settings.storage.secretAccessKey, region: that.settings.storage.region};
            AWS.config.update(config);
            const s3 = new AWS.S3({params: {Bucket: that.settings.storage.bucket}});
            s3
                .deleteObject({Key: that.filename});
        } else if (fs.existsSync(that.filename)) {
            fs.promises.unlink(that.filename);
        }
    };

    const __upload = function (stream, params) {
        return new Promise((resolve, reject) => {
            that.filename = params.filename || path.join(that.settings.baseFolder, uuid.v4());

            stream.on('error', reject);
            stream.on('finish', resolve);
            stream.on('data', function (data) {
                that.size += data.length;
                const fileSizeValid = __checkFileSize();
                if (fileSizeValid === true) {
                    return fileSizeValid;
                } else {
                    stream.emit('error', new ValidationError('File size: ' + that.size + ' is invalid'));
                }
            });
            const checkValid = __checkFileType(params.type, params.filename, stream);

            if (checkValid === true) {
                if (that.settings.storage.type && that.settings.storage.type.toLowerCase() === 's3') {
                    return __uploadToS3(stream, resolve, reject);
                } else {
                    return __uploadToLocal(stream, resolve, reject);
                }
            } else {
                __deletePartials(params);

                return stream.emit('error', checkValid);
            }
        });
    };

    return {
        upload: __upload,
        settings: that.settings,
        init: __init,
        setExtensions: __setExtensions,
        setTypes: __setTypes,
        setMaxSize: __setMaxSize,
        setStorage: __setStorage,
        checkFileSize: __checkFileSize,
        checkFileType: __checkFileType,
        deletePartials: __deletePartials
    };
}

module.exports = StreamUpload;
