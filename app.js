/**
 * Module dependencies.
 */

var ejs = require('ejs');
var express = require('express');
var mongoose = require('mongoose');
var routes = require('./routes');
var url = require('url');

var app = module.exports = express();

const logTmpl = ejs.compile('<%= date %> (<%= response_time %>ms): ' +
                            '<%= status %> <%= method %> <%= url %>');

// Configuration

var mongo_url = 'mongodb://localhost/my_database';
if (process.env.VCAP_SERVICES) {
  var services = JSON.parse(process.env.VCAP_SERVICES);
  var mongo_data = services['mongodb-1.8'][0].credentials;
  var mongo_url = 'mongodb://' + mongo_data.username + ':' + mongo_data.password +
                  '@' + mongo_data.host + ':' + mongo_data.port + '/' + mongo_data.db;
}

mongoose.connect(mongo_url);

app.configure(function(){
  app.set('views', __dirname + '/www');
  app.engine('html', ejs.renderFile);
  app.use(function(req, res, next) {
    var rEnd = res.end;

    // To track response time
    req._rlStartTime = new Date();

    // Setup the key-value object of data to log and include some basic info
    req.kvLog = {
      date: req._rlStartTime.toISOString(),
      method: req.method,
      url: url.parse(req.originalUrl).pathname,
    };

    // Proxy the real end function
    res.end = function(chunk, encoding) {
      // Do the work expected
      res.end = rEnd;
      res.end(chunk, encoding);

      // And do the work we want now (logging!)

      // Save a few more variables that we can only get at the end
      req.kvLog.status = res.statusCode;
      req.kvLog.response_time = (new Date() - req._rlStartTime);

      // Print the log
      //if (res.statusCode != 200 && res.statusCode != 304)
        console.log(logTmpl(req.kvLog));
    };

    next();
  });
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/www'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.get('/', routes.index);

// Mockups.
app.get('/mockups/', routes.getMockups);
app.post('/mockups/', routes.postMockup);
app.get('/mockups/:mockup_id', routes.getMockup);

// Pages.
app.get('/mockups/:mockup_id/pages/', routes.getPages);
app.post('/pages/', routes.postPage);
app.get('/pages/:page_id', routes.getPage);
app.put('/pages/:page_id', routes.putPage);

// Bugs
app.get('/pages/:page_id/bugs/', routes.getBugs);
app.post('/bugs/', routes.postBug);
app.get('/bugs/:bug_id', routes.getBug);

const PORT = process.env.PORT || process.env.VCAP_APP_PORT || 3000;
const HOST = process.env.IP_ADDRESS || process.env.VCAP_APP_HOST || '127.0.0.1';

app.listen(PORT, HOST, function() {
  console.log("Listening on http://" + HOST + ":" + PORT + "/");
});
