var Trade = require('./model');
var session = require('express-session');
module.exports = {
  findTradeByTradeObjectID: function(req, res, callback) {
    Trade.findOne({
      '_id': req.session.tradesession
    }, callback);
  },

  createNewTrade: function(req, res, callback) {
    var newTrade = new Trade();
    // set the user's local credentials
    tradeID = newTrade._id;
    newTrade.trade_id = newTrade._id;
    newTrade.contract_id = "None";
    newTrade.bank_id = req.body.bank_id;
    newTrade.seller_id = req.body.seller_id;
    newTrade.buyer_id = req.body.buyer_id;
    newTrade.sellerbank_id = req.body.sellerbank_id;
    newTrade.shipper_id = req.body.shipper_id;
    newTrade.status = "Ethereum Transaction Pending!!! Check after 2 mins!!!";
    newTrade.save(callback);
  },

  findTradeByTradeID: function(trade_id, req, res, callback) {
    Trade.findOne({
      'trade_id': trade_id
    }, callback);
  }

};
