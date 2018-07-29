var config = require('../config.js');
var Web3 = require('web3');
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider(config.web3Provider));
var session = require('express-session');
var userdb = require('./db');
module.exports = {

  getAdminEntry: function(req, res) {
    res.render('adminentry.ejs');
  },

  postAdminEntry: function(req, res) {
    req.session.adminpass = req.body.password;
    if (req.session.adminpass == "nishvish") {
      res.render('index.ejs');
    } else {
      res.redirect("/");
    }
  },

  getSignup: function(req, res) {
    res.render('signup.ejs', {
      message: req.session.message
    });
  },

  getLogin: function(req, res) {
    res.render('login.ejs', {
      message: ""
    });
  },

  postLogin: function(req, res) {
    userdb.findUserByUsername(req.body.username, req, res, onFindUserLogin.bind({
      'req': req,
      'res': res
    }));
  },

  getProfile: function(req, res) {
    var User = require('./model');
    if (!req.session.userId) {
      res.redirect('/login');
    } else {
      userdb.findUserByUserID(req, res, onFindUserProfile.bind({
        'req': req,
        'res': res
      }));
    }
  },

  getProfileDetails: function(req, res) {
    var User = require('./model');
    req.session.message = "";
    if (!req.session.userId) {
      res.redirect('/login');
    } else {
      userdb.findUserByUserID(req, res, onFindUserProfileDetails.bind({
        'req': req,
        'res': res
      }));
    }
  },

  logout: function(req, res) {
    req.session.destroy(function() {
      res.cookie("login.sess", "", {
        expires: new Date()
      });
      res.redirect('/login');
    });
  }
};

function getTradeIdarr(tradeList) {
  var arr = new Array();
  for (var i = 0; i < tradeList.length; ++i)
    arr[i] = tradeList[i]._id;
  return arr;
}

function getBuyerArr(tradeList) {
  var arr = new Array();
  for (var i = 0; i < tradeList.length; ++i)
    arr[i] = tradeList[i].buyer_id;
  return arr;
}

function getSellerArr(tradeList) {
  var arr = new Array();
  for (var i = 0; i < tradeList.length; ++i)
    arr[i] = tradeList[i].seller_id;
  return arr;
}

function getStatusArr(tradeList) {
  var arr = new Array();
  for (var i = 0; i < tradeList.length; ++i)
    arr[i] = tradeList[i].status;
  return arr;
}

function onFindUserLogin(err, user) {
  if (err)
    return err;
  var req = this.req;
  var res = this.res;
  if (!user) {
    res.render('login.ejs', {
      message: "No Such User exists!!!"
    });
  } // if the user is found but the password is wrong
  else if (!user.validPassword(req.body.password)) {
    res.render('login.ejs', {
      message: "Wrong Password!!!"
    }); // create the loginMessage and save it to session as flashdata
  } // all is well, return successful user
  else {
    req.session.userId = user._id;
    req.session.message = "";
    res.redirect('/profile');
  }
}

function onFindUserProfile(err, user) {
  if (err)
    return err;
  var req = this.req;
  var res = this.res;
  req.session.userAddress = user.local.userHash;
  var Trade = require('../trade/model');
  var tradeIdArr, buyerIdList, sellerIdList, statusList;
  switch (user.local.role) {
    case "Bank":
      Trade.find({
        'bank_id': user.local.username
      }, function(err, tradeList) {
        if (err)
          return err;

        if (tradeList[0]) {
          tradeIdArr = getTradeIdarr(tradeList);
          buyerIdList = getBuyerArr(tradeList);
          sellerIdList = getSellerArr(tradeList);
          statusList = getStatusArr(tradeList);
          res.render('profile.ejs', {
            message: req.session.message,
            role: user.local.role,
            ethAddress: user.local.userHash,
            ethBalance: web3.eth.getBalance(user.local.userHash),
            username: user.local.username,
            kychash: user.local.kychash,
            user: user._id,
            trade_id: tradeIdArr,
            buyerList: buyerIdList,
            sellerList: sellerIdList,
            statusList: statusList
          });
        } else {
          Trade.find({
            'sellerbank_id': user.local.username
          }, function(err, tradeList) {
            if (err)
              return err;
            if (tradeList[0]) {
              tradeIdArr = getTradeIdarr(tradeList);
              buyerIdList = getBuyerArr(tradeList);
              sellerIdList = getSellerArr(tradeList);
              statusList = getStatusArr(tradeList);
            } else {
              tradeIdArr = ['No Trades Yet'];
              buyerIdList = [];
              sellerIdList = [];
              statusList = [];
            }
            res.render('profile.ejs', {
              message: req.session.message,
              role: user.local.role,
              ethAddress: user.local.userHash,
              ethBalance: web3.eth.getBalance(user.local.userHash),
              username: user.local.username,
              kychash: user.local.kychash,
              user: user._id,
              trade_id: tradeIdArr,
              buyerList: buyerIdList,
              sellerList: sellerIdList,
              statusList: statusList
            });
          });
        }

      });
      break;
    case "Seller":
      Trade.find({
        'seller_id': user.local.username
      }, function(err, tradeList) {
        if (err)
          return err;
        if (tradeList[0]) {
          tradeIdArr = getTradeIdarr(tradeList);
          buyerIdList = getBuyerArr(tradeList);
          sellerIdList = getSellerArr(tradeList);
          statusList = getStatusArr(tradeList);
        } else {
          tradeIdArr = ['No Trades Yet'];
          buyerIdList = [];
          sellerIdList = [];
          statusList = [];
        }
        res.render('profile.ejs', {
          message: req.session.message,
          role: user.local.role,
          ethAddress: user.local.userHash,
          ethBalance: web3.eth.getBalance(user.local.userHash),
          username: user.local.username,
          kychash: user.local.kychash,
          user: user._id,
          trade_id: tradeIdArr,
          buyerList: buyerIdList,
          sellerList: sellerIdList,
          statusList: statusList
        });
      });
      break;
    case "Buyer":
      Trade.find({
        'buyer_id': user.local.username
      }, function(err, tradeList) {
        if (err)
          return err;
        if (tradeList[0]) {
          tradeIdArr = getTradeIdarr(tradeList);
          buyerIdList = getBuyerArr(tradeList);
          sellerIdList = getSellerArr(tradeList);
          statusList = getStatusArr(tradeList);
        } else {
          tradeIdArr = ['No Trades Yet'];
          buyerIdList = [];
          sellerIdList = [];
          statusList = [];
        }
        res.render('profile.ejs', {
          message: req.session.message,
          role: user.local.role,
          ethAddress: user.local.userHash,
          ethBalance: web3.eth.getBalance(user.local.userHash),
          username: user.local.username,
          kychash: user.local.kychash,
          user: user._id,
          trade_id: tradeIdArr,
          buyerList: buyerIdList,
          sellerList: sellerIdList,
          statusList: statusList
        });
      });
      break;
    case "Shipper":
      Trade.find({
        'shipper_id': user.local.username
      }, function(err, tradeList) {
        if (err)
          return err;
        if (tradeList[0]) {
          tradeIdArr = getTradeIdarr(tradeList);
          buyerIdList = getBuyerArr(tradeList);
          sellerIdList = getSellerArr(tradeList);
          statusList = getStatusArr(tradeList);
        } else {
          tradeIdArr = ['No Trades Yet'];
          buyerIdList = [];
          sellerIdList = [];
          statusList = [];
        }
        res.render('profile.ejs', {
          message: req.session.message,
          role: user.local.role,
          ethAddress: user.local.userHash,
          ethBalance: web3.eth.getBalance(user.local.userHash),
          username: user.local.username,
          kychash: user.local.kychash,
          user: user._id,
          trade_id: tradeIdArr,
          buyerList: buyerIdList,
          sellerList: sellerIdList,
          statusList: statusList
        });
      });
      break;
  }
}

function onFindUserProfileDetails(err, user) {
  if (err)
    return err;
  var req = this.req;
  var res = this.res;
  res.render('profiledetails.ejs', {
    role: user.local.role,
    ethAddress: user.local.userHash,
    ethBalance: web3.eth.getBalance(user.local.userHash),
    username: user.local.username,
    kychash: user.local.kychash,
    user: user._id
  });
}
