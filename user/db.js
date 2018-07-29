var User = require('./model');
var session = require('express-session');
module.exports = {

  findUserByUsername: function(username, req, res, callback) {
    User.findOne({
      'local.username': username
    }, callback);
  },
  findUserByUserID: function(req, res, callback) {
    User.findOne({
      '_id': req.session.userId
    }, callback);
  }
};
