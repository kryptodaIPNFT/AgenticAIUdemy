'use strict';

const serverless = require('serverless-http');
const { app, bootstrap } = require('../../server');

const handle = serverless(app);

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await bootstrap();
  return handle(event, context);
};
