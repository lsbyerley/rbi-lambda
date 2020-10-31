'use strict';

const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

let options = {
  apiVersion: '2012-08-10',
};

// connect to local DB if running offline
// TODO: add this back if/when local DB is added
if (process.env.IS_OFFLINE) {
  /*options = {
    region: 'localhost',
    endpoint: 'http://localhost:8000',
  };*/
}

const client = new AWS.DynamoDB.DocumentClient(options);

module.exports = client;
