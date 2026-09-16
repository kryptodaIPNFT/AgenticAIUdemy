'use strict';

const serverless = require('serverless-http');
const store = require('../../lib/store');
const { app, bootstrap } = require('../../server');

const handle = serverless(app);

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  store.attachLambdaEvent(event);
  await bootstrap();
  return handle(event, context);
};
