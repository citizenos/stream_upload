var fs = require('fs'),
    assert = require('assert'),
    StreamUpload = require('../');
var testFileName = 'test.txt';
var streamUpload;
describe('Upload streams', function () {

    var deleteFile = function(filePath, callback) {
        fs.unlink(filePath, callback);
    };

    this.timeout(10000);//10 seconds
  
    before(function(done){
        var file = fs.createWriteStream(testFileName);
        file.write('TEST TEXT is another test TEXTs');
        file.close();
        streamUpload = new StreamUpload({
            extensions: ['txt'],
            types: [],
            maxSize: 1000,
            baseFolder: 'test',
            storage: {}
        });
        done();
    });

    after(function(done){
        fs.unlink(testFileName);
        done();
    });  

    it('Upload to local', function (done) {
        var fileParams = fs.statSync('test.txt');
        var file = fs.createReadStream('test.txt');
        var path = 'test/testRes.txt';
        streamUpload
            .upload(file, {size: fileParams.size, type: 'text/plain', filename: path})
            .then(function (data) {
                assert.equal(path, data);
                if (fs.existsSync(path)) {
                    fs.unlink(path);
                    return done();
                }            
            })
            .catch(function (err) {
                return done(err);
            })
    });

    it('Upload to local size mismatch error', function (done) {
        var fileParams = fs.statSync('test.txt');
        var file = fs.createReadStream('test.txt');
        var path = 'test/testRes.txt';
        var expectedError = 'File size is invalid';
        streamUpload.setMaxSize(1);

        streamUpload
            .upload(file, {size: fileParams.size, type: 'text/plain', filename: path})
            .then(function (data) {
                return done(data);
            })
            .catch(function (err) {
                assert.equal(expectedError, err.message);
                return done();
            })
    });

    it('Upload to local type mismatch error', function (done) {
        var fileParams = fs.statSync('test.txt');
        var file = fs.createReadStream('test.txt');
        var path = 'test/testRes.txt';
        var expectedError = 'File type is invalid';
        streamUpload.setMaxSize(1000);
        
        streamUpload
            .upload(file, {size: fileParams.size, type: 'image/jpeg', filename: path})
            .then(function(data) {
                return done(data);
            })
            .catch(function (err) {
                assert.equal(expectedError, err.message);
                return done();
            })
    });

});
