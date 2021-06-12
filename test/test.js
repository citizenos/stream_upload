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
        const file = fs.createWriteStream(testFileName);
        file.write('TEST TEXT is another test TEXTs');
        file.close();
        streamUpload = new StreamUpload({
            extensions: ['txt'],
            types: [],
            maxSize: 1000,
            baseFolder: 'test',
            storage: {}
        });
    });

    after(async function(){
        fs.unlinkSync(testFileName);
    });

    it('Upload to local', async function () {
        const fileParams = fs.statSync('test.txt');
        const file = fs.createReadStream('test.txt');
        const path = 'test/testRes.txt';

        const data = await streamUpload.upload(file, {size: fileParams.size, type: 'text/plain', filename: path});

        assert(path, data);
        if (fs.existsSync(path)) {
            deleteFile(path);
        }
    });

    it('Upload to local size mismatch error', async function () {
        const fileParams = fs.statSync('test.txt');
        const file = fs.createReadStream('test.txt');
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

    it('Upload to local type mismatch error', async function () {
        const fileParams = fs.statSync('test.txt');
        const file = fs.createReadStream('test.txt');
        const path = 'test/testRes.txt';
        const expectedError = 'File type is invalid';
        streamUpload.setMaxSize(1000);

        try {
            await streamUpload.upload(file, {size: fileParams.size, type: 'image/jpeg', filename: path})
        } catch (err) {
            assert(expectedError, err.message);
        }

        if (fs.existsSync(path)) {
            deleteFile(path);
        }
    });

});
