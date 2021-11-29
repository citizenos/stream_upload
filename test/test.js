'use strict';

const fs = require('fs'),
    assert = require('assert'),
    StreamUpload = require('../');
const testFileName = 'test.txt';
let streamUpload;
describe('Upload streams', function () {

    const deleteFile = function (filePath) {
        fs.unlinkSync(filePath);
    };

    this.timeout(10000);//10 seconds

    before(async function () {
        streamUpload = new StreamUpload({
            extensions: ['txt', 'pdf'],
            types: [],
            maxSize: 1000,
            baseFolder: 'test',
            storage: {}
        });
    });

    it('Upload to local', async function () {
        const fileParams = fs.statSync(__dirname + '/testfiles/test.txt');
        const file = fs.createReadStream(__dirname + '/testfiles/test.txt');
        const path = 'test/testRes.txt';

        const data = await streamUpload.upload(file, {size: fileParams.size, type: 'text/plain', filename: path});

        assert(path, data);
        if (fs.existsSync(path)) {
            deleteFile(path);
        }
    });

    it('Upload to local pdf', async function () {
        const fileParams = fs.statSync(__dirname + '/testfiles/test.pdf');
        const file = fs.createReadStream(__dirname + '/testfiles/test.pdf');
        const path = 'test/testRes.pdf';

        const data = await streamUpload.upload(file, {size: fileParams.size, type: 'application/pdf', filename: path});

        assert(path, data);
        if (fs.existsSync(path)) {
            deleteFile(path);
        }
    });

    it('Upload to local size mismatch error', async function () {
        const fileParams = fs.statSync(__dirname + '/testfiles/test.txt');
        const file = fs.createReadStream(__dirname + '/testfiles/test.txt');
        const path = 'test/testRes.txt';
        const expectedError = 'File size is invalid';
        streamUpload.setMaxSize(1);

        try {
            await streamUpload.upload(file, {size: fileParams.size, type: 'text/plain', filename: path})
        } catch(err) {
            assert(expectedError, err.message);
        }

        if (fs.existsSync(path)) {
            deleteFile(path);
        }
    });

    it('Upload to local type mismatch error pdf to txt', async function () {
        const fileParams = fs.statSync(__dirname + '/testfiles/test.pdf');
        const file = fs.createReadStream(__dirname + '/testfiles/test.pdf');
        const path = 'test/testRes.txt';
        const expectedError = 'File type is invalid';
        streamUpload.setMaxSize(1000);

        try {
            await streamUpload.upload(file, {size: fileParams.size, type: 'text/plain', filename: path})
        } catch (err) {
            assert(expectedError, err.message);
        }

        if (fs.existsSync(path)) {
            deleteFile(path);
        }
    });

    it('Upload to local type mismatch error .exe', async function () {
        const fileParams = fs.statSync(__dirname + '/testfiles/test.exe');
        const file = fs.createReadStream(__dirname + '/testfiles/test.exe');
        const path = 'test/testRes.exe';
        const expectedError = 'File type is invalid';
        streamUpload.setMaxSize(1000);

        try {
            await streamUpload.upload(file, {size: fileParams.size, type: 'text/plain', filename: path})
        } catch (err) {
            assert(expectedError, err.message);
        }

        if (fs.existsSync(path)) {
            deleteFile(path);
        }
    });

    it('Upload to local type not allowed .exe', async function () {
        const fileParams = fs.statSync(__dirname + '/testfiles/test.exe');
        const file = fs.createReadStream(__dirname + '/testfiles/test.exe');
        const path = 'test/testRes.exe';
        const expectedError = 'File type is invalid';
        streamUpload.setMaxSize(1000);

        try {
            await streamUpload.upload(file, {size: fileParams.size, type: 'application/x-msdos-program', filename: path})
        } catch (err) {
            assert(expectedError, err.message);
        }

        if (fs.existsSync(path)) {
            deleteFile(path);
        }
    });

});
