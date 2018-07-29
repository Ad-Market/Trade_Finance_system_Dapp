var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');

// define the schema for our trade model
var tradeSchema = mongoose.Schema({
  trade_id: String,
  contract_id: String,
  buyer_id: String,
  seller_id: String,
  sellerbank_id: String,
  bank_id: String,
  shipper_id: String,
  quotation: {
    hash: String,
    txnID: String
  },
  po: {
    hash: String,
    txnID: String
  },
  invoice: {
    hash: String,
    txnID: String
  },
  letterofcredit: {
    contract_id: String,
    No_of_days: Number,
    Credit_Amount: Number
  },
  billoflading: {
    hash: String,
    txnID: String
  },
  status: String,
  loctrig_thresh: Number
});


// create the model for trade and expose it to our app
module.exports = mongoose.model('Trade', tradeSchema);
