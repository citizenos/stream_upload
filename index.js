'use strict';

const AWS = require('aws-sdk');
const mime = require('mime-types');
const _ = require('underscore');
const uuid = require('uuid');
const path = require('path');
const fs = require('fs');
const fsExt = require('fs-extra');
const {finished} = require('stream');

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

    const __checkFileType = function (type, name) {
        const error = new Error('File type ' + type + ' is invalid');
        error.type = 'fileType';
        error.statusCode = 403;

        const fileType = mime.lookup(path.extname(name));
        if (fileType !== type) {
            throw error;
        }
        if (that.settings.allowedTypes && that.settings.allowedTypes.length) {
            for (let i = 0; i < that.settings.allowedTypes.length; i++) {
                const exp = new RegExp(that.settings.allowedTypes[i].replace('+', '\\+').replace('.', '\\.'));
                if (exp.test(type)) {
                    return true;
                }
            }


            throw error;
        }

        return true;
    };

    const __checkFileSize = function () {
        if (that.settings.maxSize) {
            return that.size <= that.settings.maxSize;
        }

        return true;
    };

    const __checkSize = function (stream, outstream) {
        stream.on('data', function (data) {
            that.size += data.length;
            const fileSizeValid = __checkFileSize();
            if (fileSizeValid === true) {
                return fileSizeValid;
            } else {
                const error = new Error('File size: ' + that.size + ' is invalid');
                error.type = 'fileSize';
                error.statusCode = 403;
                stream.emit('error', error);
                if (outstream) {
                    outstream.emit('error', error);
                }

                return error;
            }
        });
    };

    const __uploadToS3 = async function (inputStream) {
        const config = {accessKeyId: that.settings.storage.accessKeyId, secretAccessKey: that.settings.storage.secretAccessKey, region: that.settings.storage.region};
        AWS.config.update(config);
        const s3 = new AWS.S3({params: {Bucket: that.settings.storage.bucket}});

        const link = (await s3.upload({Key: that.filename, Body: inputStream, ACL: 'public-read'}).promise()).Location;

        return {
            size: that.size,
            filename: link
        };
    };

    const __uploadToLocal = function (inputStream) {
        return new Promise(function (resolve, reject) {
            // Make sure the output directory is there.
            fsExt.ensureDirSync(path.dirname(that.filename));

            const wr = fs.createWriteStream(that.filename);

            __checkSize(inputStream, wr);
            wr.on('error', function (err) {
                return reject(err);
            });

            wr.on('finish', function () {
                return resolve({
                    size: that.size,
                    filename: that.filename
                });
            });

            inputStream.pipe(wr);
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
        try {
            __checkFileType(params.type, params.filename);
            that.filename = params.filename || path.join(that.settings.baseFolder, uuid.v4());
            finished(stream, (err) => {
                if (err) {
                    __deletePartials(params);

                    return Promise.reject(err);
                }
            });
            that.size = 0;
            if (that.settings.storage.type && that.settings.storage.type.toLowerCase() === 's3') {
                return __uploadToS3(stream, params);
            }

            return __uploadToLocal(stream, params);
        } catch (err) {
            __deletePartials(params);

            return Promise.reject(err);
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
        checkFileSize: __checkFileSize,
        checkFileType: __checkFileType,
        deletePartials: __deletePartials
    };
}

module.exports = StreamUpload;
