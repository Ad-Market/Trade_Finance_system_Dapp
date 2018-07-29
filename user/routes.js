var session = require('express-session');
const MongoStore = require('connect-mongo')(session);
var user = require('./impl');

module.exports = function(app) {
  app.get('/', user.getAdminEntry);
  app.post('/', user.postAdminEntry);
  app.get('/login', user.getLogin);
  app.post('/login', user.postLogin);
  app.get('/profiledetails', user.getProfileDetails);
  app.get('/profile', user.getProfile);
  app.get('/signup', user.getSignup);
  app.get('/logout', user.logout);
};
