#Stream uploads

Package to stream uploads to desired locations.

Install
`npm install stream_upload`

##Usage

```javascript
var StreamUpload = require('stream_upload');
streamUpload = new StreamUpload({
    extensions: [], // eg. ['jpeg', 'jpg', 'png']
    types: [], // ['image/jpeg']
    maxSize: 0, // 50000 -> max file size in bytes
    baseFolder: '', // 'myFolder'
    storage: {} // storage config variables
});
/**/
var params = {
    size: {filesize in bytes},
    type: {file mime-type}, filename}
    filename: {my desired filename} // can also be path /path/to/filename.ext
streamUpload.upload(ReadStream, params);
```

default storage is local

currently supports only local and s3

###S3 config sample 
```javascript
{
    storage: {
        type: 'S3',
        "accessKeyId": "MY_AWS_ACCESS_KEY",
        "secretAccessKey": "MY_AWS_ACCESS_SECRET",
        "region": "AWS_REGION",
        "bucket": "S3_BUCKET",
        "baseFolder": "myfolder" //optional
    }
}
```