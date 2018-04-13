#Stream uploads

Package to stream uploads to desired locations.

Install
`npm install stream_upload`

##Usage


`var streamUpload = require('stream_upload');`
`streamUpload.init({
    extensions: [], // eg. ['jpeg', 'jpg', 'png']
    types: [], // ['image/jpeg']
    maxSize: 0, // 50000 -> max file size in bytes
    baseFolder: '', // 'myFolder'
    storage: {} // storage config variables
});`

default storage is local

currently supports only local and s3

S3 config 
`{
    storage: {
        type: 'S3',
        "accessKeyId": "MY_AWS_ACCESS_KEY",
        "secretAccessKey": "MY_AWS_ACCESS_SECRET",
        "region": "AWS_REGION",
        "bucket": "S3_BUCKET",
        "baseFolder": "myfolder" //optional
    }
}`
