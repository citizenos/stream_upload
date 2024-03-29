'use strict';;
//const AWS = require('aws-sdk');

const { Upload } = require('@aws-sdk/lib-storage');
const { DeleteObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const mime = require('mime-types');
const _ = require('underscore');
const uuid = require('uuid');
const path = require('path');
const fs = require('fs');
const fsExt = require('fs-extra');

class ValidationError extends Error {
    constructor(message, type) {
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
function StreamUpload(options) {

    const that = this;

    that.settings = {
        allowedExt: [],
        allowedTypes: [],
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
        __setBaseFolder(options.baseFolder);
        __setStorage(options.storage);
    };

    if (options) {
        __init(options);
    }

    const __checkFileType = function (type, name) {
        const fileType = mime.lookup(path.extname(name));
        if (fileType !== type) {
            return false;
        } else if (that.settings.allowedTypes && that.settings.allowedTypes.length) {
            for (let i = 0; i < that.settings.allowedTypes.length; i++) {
                const exp = new RegExp(that.settings.allowedTypes[i].replace('+', '\\+').replace('.', '\\.'));
                if (exp.test(type)) {
                    return true;
                }
            }

            return false;
        } else {
            return true;
        }
    };

    const __uploadToS3 = async function (inputStream) {
        const config = {
            credentials: {
                accessKeyId: that.settings.storage.accessKeyId,
                secretAccessKey: that.settings.storage.secretAccessKey
            },
            region: that.settings.storage.region
        };
        //  AWS.config.update(config);
        //  AWS.config.update(config);
        const params = { Key: that.filename, Bucket: that.settings.storage.bucket, Body: inputStream, ACL: 'public-read' };
        const s3Client = new S3Client(config);
        const upload = new Upload({
            client: s3Client,
            params
        });
        const data = await upload.done();

        return {
            size: that.size,
            filename: data.Location
        };
    };

    const __uploadToLocal = function (inputStream) {
        return new Promise((resolve, reject) => {
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
        });
    };

    const __deletePartials = function () {
        if (that.settings.storage.type && that.settings.storage.type.toLowerCase() === 's3') {
            const config = {
                credentials: {
                    accessKeyId: that.settings.storage.accessKeyId,
                    secretAccessKey: that.settings.storage.secretAccessKey
                },
                region: that.settings.storage.region
            };
            const s3Client = new S3Client(config);
            const deleteCommand = new DeleteObjectCommand({ Key: that.filename, Bucket: that.settings.storage.bucket });
            s3Client
                .send(deleteCommand);
        } else if (fs.existsSync(that.filename)) {
            fs.promises.unlink(that.filename);
        }
    };

    const __upload = async function (stream, params) {
        that.filename = params.filename || path.join(that.settings.baseFolder, uuid.v4());
        const isValid = __checkFileType(params.type, params.filename);
        if (isValid) {
            try {
                if (that.settings.storage.type && that.settings.storage.type.toLowerCase() === 's3') {
                    return await __uploadToS3(stream);
                } else {
                    return __uploadToLocal(stream);
                }
            } catch (err) {
                console.log('ERROR', err);
                stream.emit('error', err);
            }
        } else {
            stream.emit('error', new ValidationError('File type ' + params.type + ' is invalid', 'fileType'));
        }

    };

    return {
        upload: __upload,
        settings: that.settings,
        init: __init,
        setExtensions: __setExtensions,
        setTypes: __setTypes,
        setStorage: __setStorage,
        checkFileType: __checkFileType,
        deletePartials: __deletePartials
    };
}

module.exports = StreamUpload;
