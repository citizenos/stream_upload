'use strict';

const fs = require('fs');
const assert = require('assert');
const StreamUpload = require('../');
const path = require('path');

let streamUpload;
describe('Upload streams', function () {

    const deleteFile = function (filePath) {
        fs.unlinkSync(filePath);
    };

    this.timeout(10000);//10 seconds

    before(function () {
        streamUpload = new StreamUpload({
            extensions: ['txt', 'pdf'],
            types: [],
            maxSize: 15000,
            baseFolder: 'test',
            storage: {}
        });
    });

    it('Upload to local', async function () {
        const fileParams = fs.statSync(path.join(__dirname, '/testfiles/test.txt'));
        const file = fs.createReadStream(path.join(__dirname, '/testfiles/test.txt'));
        const filename = 'test/testRes.txt';

        const data = await streamUpload.upload(file, {size: fileParams.size, type: 'text/plain', filename: filename});

        assert(filename, data);
        if (fs.existsSync(filename)) {
            deleteFile(filename);
        }
    });

    it('Upload to local pdf', async function () {
        const fileParams = fs.statSync(path.join(__dirname, '/testfiles/test.pdf'));
        const file = fs.createReadStream(path.join(__dirname, '/testfiles/test.pdf'));
        const filename = 'test/testRes.pdf';

        const data = await streamUpload.upload(file, {size: fileParams.size, type: 'application/pdf', filename: filename});

        assert(filename, data);
        if (fs.existsSync(filename)) {
            deleteFile(filename);
        }
    });

    it('Upload to local size mismatch error', async function () {
        const fileParams = fs.statSync(path.join(__dirname, '/testfiles/test.txt'));
        const file = fs.createReadStream(path.join(__dirname, '/testfiles/test.txt'));
        const filename = 'test/testRes.txt';
        const expectedError = 'File size is invalid';
        streamUpload.setMaxSize(1);

        try {
            await streamUpload.upload(file, {size: fileParams.size, type: 'text/plain', filename: filename});
        } catch (err) {
            assert(expectedError, err.message);

            return;
        }

        if (fs.existsSync(filename)) {
            deleteFile(filename);
        }
        assert.fail('Did not reject with an error');
    });

    it('Upload to local type mismatch error pdf to txt', async function () {
        const fileParams = fs.statSync(path.join(__dirname, '/testfiles/test.pdf'));
        const file = fs.createReadStream(path.join(__dirname, '/testfiles/test.pdf'));
        const filename = 'test/testRes.txt';
        const expectedError = 'File type is invalid';
        streamUpload.setMaxSize(1000);

        try {
            await streamUpload.upload(file, {size: fileParams.size, type: 'text/plain', filename: filename});
        } catch (err) {
            assert(expectedError, err.message);

            return;
        }

        if (fs.existsSync(filename)) {
            deleteFile(filename);
        }
        assert.fail('Did not reject with an error');
    });

    it('Upload to local type mismatch error .exe', async function () {
        const fileParams = fs.statSync(path.join(__dirname, '/testfiles/test.exe'));
        const file = fs.createReadStream(path.join(__dirname, '/testfiles/test.exe'));
        const filename = 'test/testRes.exe';
        const expectedError = 'File type is invalid';
        streamUpload.setMaxSize(1000);

        try {
            await streamUpload.upload(file, {size: fileParams.size, type: 'text/plain', filename: filename});
        } catch (err) {
            assert(expectedError, err.message);

            return;
        }

        if (fs.existsSync(filename)) {
            deleteFile(filename);
        }
        assert.fail('Did not reject with an error');
    });

    it('Upload to local type not allowed .exe', async function () {
        const fileParams = fs.statSync(path.join(__dirname, '/testfiles/test.exe'));
        const file = fs.createReadStream(path.join(__dirname, '/testfiles/test.exe'));
        const filename = 'test/testRes.exe';
        const expectedError = 'File type is invalid';
        streamUpload.setMaxSize(1000);

        try {
            await streamUpload.upload(file, {size: fileParams.size, type: 'application/x-msdos-program', filename: filename});
        } catch (err) {
            assert(expectedError, err.message);

            return;
        }

        if (fs.existsSync(filename)) {
            deleteFile(filename);
        }
        assert.fail('Did not reject with an error');
    });

});
