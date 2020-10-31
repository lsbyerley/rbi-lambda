'use strict';

// Require and init API router module
const app = require('lambda-api')({ version: 'v1.0', base: 'v1' });
const _get = require('lodash/get');
const cageSchedule = require('./lib/cageSchedule');
const sendEmail = require('./lib/piFormSubmit');

//----------------------------------------------------------------------------//
// Define Middleware
//----------------------------------------------------------------------------//

// Add CORS Middleware
app.use((req, res, next) => {
  // Add default CORS headers for every request
  res.cors();

  // Call next to continue processing
  next();
});

// Add Authorization Middleware
app.use((req, res, next) => {
  // Check for Authorization Bearer token
  if (req.auth.type === 'Bearer') {
    // Get the Bearer token value
    let token = req.auth.value;
    // Set the token in the request scope
    req.token = token;
    // Do some checking here to make sure it is valid (set an auth flag)
    req.auth = true;
  }

  // Call next to continue processing
  next();
});

//----------------------------------------------------------------------------//
// Build API routes
//----------------------------------------------------------------------------//

app.get('/cageSchedule', async (req, res) => {
  let cageRes = await cageSchedule();

  // Send the response
  res.status(200).json(cageRes);
});

app.post('/pi-form', async (req, res) => {
  try {
    //TODO: Data sanitization
    const data = _get(req, 'body');

    if (data.parentEmail && data.parentPhone && data.playerName) {
      const emailRes = await sendEmail(data);

      if (!emailRes.error) {
        res.status(200).json(emailRes);
      } else {
        res.status(500).json({ status: 'notsent' });
      }
    } else {
      res.status(500).json({ status: 'invalidata' });
    }
  } catch (error) {
    console.log('errorinroute', error);
    res.status(500).json({ status: 'notsent2' });
  }
});

// Default Options for CORS preflight
app.options('/*', (req, res) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Content-Length, X-Requested-With'
  );
  res.status(200).send({});
});

// Log routes to console for debugging
//app.routes(true)

//----------------------------------------------------------------------------//
// Main router handler
//----------------------------------------------------------------------------//
module.exports.router = (event, context, callback) => {
  // !!!IMPORTANT: Set this flag to false, otherwise the lambda function
  // won't quit until all DB connections are closed, which is not good
  // if you want to freeze and reuse these connections
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.source === 'serverless-plugin-warmup') {
    return 'Lambda is warm!';
  }

  // Run the request
  app.run(event, context, callback);
}; // end router handler
