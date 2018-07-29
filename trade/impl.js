var tradedb = require('./db');
var userdb = require('../user/db');
const url = require('url');
var Trade = require('./model');
var User = require('../user/model');
var bodyParser = require('body-parser');
var events = require('events');
var eventEmitter = new events.EventEmitter();
var urlencodedParser = bodyParser.urlencoded({
  extended: false
});
var multer = require('multer');
var Scheduler = require('mongo-scheduler');
var scheduler = new Scheduler("mongodb://localhost/db_name", {
  doNotFire: false
});

var buyerHash, sellerHash, buyerBankHash, sellerBankHash, shipperHash, tradeID;
var userHash, gasUsage;
var config = require('../config.js');

var Web3 = require('web3');
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider(config.web3Provider));

require('../build/ABI/order.js');
require('../build/ABI/letterOfCredit.js');

var orderContract = web3.eth.contract(orderABI);
var letterOfCreditContract = web3.eth.contract(letterOfCreditABI);

eventEmitter.on('paymentSuccess', function(status, id) {
  tradedb.findTradeByTradeID(id, req, res, onFindTradePaymentSuccess);
});

eventEmitter.on('checkBuyerinApprove', function(buyer) {
  userdb.findUserByUsername(buyer, req, res, onFindUserinApprove);
});

eventEmitter.on('checkSellerinApprove', function(seller) {
  userdb.findUserByUsername(seller, req, res, onFindUserinApprove);
});
eventEmitter.on('checkSellerBankinApprove', function(bank) {
  userdb.findUserByUsername(bank, req, res, onFindUserinApprove);
});

module.exports = {
  getTradeSession: function(req, res) {
    if (!req.session.sender) {
      res.redirect('/login');
    } else {
      tradedb.findTradeByTradeObjectID(req, res, onFindTradeSession.bind({
        'req': req,
        'res': res
      }));
    }
  },

  middleware1: function(req, res, next) {
    eventEmitter.once('SaveTrade', function() {
      tradedb.createNewTrade(req, res, onNewTradeSession.bind({
        'req': req,
        'res': res
      }));

    });

    eventEmitter.once('CheckShipper', function() {
      userdb.findUserByUsername(req.body.shipper_id, req, res, onFindShipper.bind({
        'req': req,
        'res': res
      }));
    });

    eventEmitter.once('CheckBuyerBank', function() {
      userdb.findUserByUsername(req.body.bank_id, req, res, onFindBuyerBank.bind({
        'req': req,
        'res': res
      }));
    });

    eventEmitter.once('CheckSellerBank', function() {
      userdb.findUserByUsername(req.body.sellerbank_id, req, res, onFindSellerBank.bind({
        'req': req,
        'res': res
      }));
    });

    eventEmitter.once('CheckSeller', function() {
      userdb.findUserByUsername(req.body.seller_id, req, res, onFindSeller.bind({
        'req': req,
        'res': res
      }));
    });

    eventEmitter.once('CheckBuyer', function() {
      userdb.findUserByUsername(req.body.buyer_id, req, res, onFindBuyer.bind({
        'req': req,
        'res': res
      }));

    });

    if (req.body.senderpage = "Bank") {
      eventEmitter.emit('CheckBuyer');
    } else {
      res.redirect('/profile');
    }
  },

  middleware2: function(req, res, next) {
    eventEmitter.once('setup', function(address) {
      setup(req.body.buyerHash, req.body.sellerHash, req.body.buyerBankHash, req.body.sellerBankHash, req.body.shipperHash, address);
    });
    eventEmitter.once('deploySuccess', function(address) {
      tradedb.findTradeByTradeID(req.body.tradeID, req, res, onFindTradeDeploySuccess.bind({
        'req': req,
        'res': res
      }));
    });
    eventEmitter.once('connectionSetup', function() {
      deployOrder();
    });
    eventEmitter.once('setupTxnSuccess', function() {
      tradedb.findTradeByTradeID(req.body.tradeID, req, res, onFindTrade.bind({
        'req': req,
        'res': res
      }));
    });
    eventEmitter.emit('connectionSetup');
  },

  resumetrade: function(req, res) {
    tradedb.findTradeByTradeID(req.body.trade_id, req, res, onFindTradeResume.bind({
      'req': req,
      'res': res
    }));
  },

  approvetrade: function(req, res) {
    tradedb.findTradeByTradeID(req.body.trade_id, req, res, onFindTradeApprove.bind({
      'req': req,
      'res': res
    }));
  },

  rejecttrade: function(req, res) {
    tradedb.findTradeByTradeID(req.body.trade_id, req, res, onFindTradeReject.bind({
      'req': req,
      'res': res
    }));
  }
};

function onFindTradeSession(err, trade) {
  if (err)
    return err;
  var req = this.req;
  var res = this.res;
  res.render('tradepage.ejs', {
    id: trade.trade_id,
    address: trade.contract_id,
    bank_id: trade.bank_id,
    seller_id: trade.seller_id,
    buyer_id: trade.buyer_id,
    sellerbank_id: trade.sellerbank_id,
    shipper_id: trade.shipper_id,
    quotation: trade.quotation,
    po: trade.po,
    invoice: trade.invoice,
    status: trade.status,
    letterofcredit: trade.letterofcredit,
    creditAmount: trade.letterofcredit.Credit_Amount,
    timePeriod: trade.letterofcredit.No_of_days,
    billoflading: trade.billoflading,
    senderpage: req.session.sender,
    username: req.query.username,
    userAddress: req.session.userAddress
  });
}

function deployOrder() {
  var order = orderContract.new({
    from: config.ethAddress,
    data: '0x6060604052341561000f57600080fd5b60058054600160a060020a03191633600160a060020a0316179055610c68806100396000396000f3006060604052600436106100825763ffffffff7c0100000000000000000000000000000000000000000000000000000000600035041663030e07e981146100875780630baaed18146100ee5780635cd2f4d31461012f5780636ddf0b6a146101515780637275e2e21461016a578063db631b08146101cf578063ebc27838146101e5575b600080fd5b341561009257600080fd5b6100ec60048035600160a060020a03169060248035919060649060443590810190830135806020601f8201819004810201604051908101604052818152929190602084018383808284375094965061021c95505050505050565b005b34156100f957600080fd5b610104600435610451565b6040518083600481111561011457fe5b60ff1681526020018281526020019250505060405180910390f35b341561013a57600080fd5b6100ec600160a060020a0360043516602435610473565b341561015c57600080fd5b6100ec600435602435610612565b341561017557600080fd5b6100ec60048035600160a060020a03169060248035919060649060443590810190830135806020601f820181900481020160405190810160405281815292919060208401838380828437509496506106f795505050505050565b34156101da57600080fd5b6100ec6004356108e7565b34156101f057600080fd5b6100ec600160a060020a03600435811690602435811690604435811690606435811690608435166109cf565b60055433600160a060020a0390811691161461023757600080fd5b600154600160a060020a03848116911614801561027357507f50757263686173654f726465720000000000000000000000000000000000000082145b806102cb5750600054600160a060020a0384811691161480156102cb57507f51756f746174696f6e00000000000000000000000000000000000000000000008214806102cb575060c860020a66496e766f6963650282145b806102fb5750600454600160a060020a0384811691161480156102fb5750600080516020610c1d83398151915282145b1561044c57600082815260066020908152604080832060038101548452909152902081805161032e929160200190610b81565b50600082815260066020818152604080842060028101805460ff19166001908117918290556003830180549091019081905580875291845282862095889052939092527f08326b617deaedb58623de37b06c732509a51bea9c38de6bf25e08a46fa30590938693909260ff909116915184815260208101604082018460048111156103b557fe5b60ff168152602081018490526040838203810183528654600260018216156101000260001901909116049082018190526060909101908690801561043a5780601f1061040f5761010080835404028352916020019161043a565b820191906000526020600020905b81548152906001019060200180831161041d57829003601f168201915b50509550505050505060405180910390a15b505050565b6006602052600090815260409020600281015460039091015460ff9091169082565b600154600160a060020a0383811691161480156104b3575060c860020a66496e766f696365028114806104b35750600080516020610c1d83398151915281145b156105225760008181526006602052604090206002908101805460ff19166001835b02179055507f7aeba1c474b275ad2299a73c38fc2d8d690e0903a9cd0f527e1b79762cfae7c78183604051918252600160a060020a031660208201526040908101905180910390a161060e565b600054600160a060020a03838116911614801561055e57507f50757263686173654f726465720000000000000000000000000000000000000081145b806105a45750600254600160a060020a0383811691161480156105a4575060c860020a66496e766f696365028114806105a45750600080516020610c1d83398151915281145b806105e65750600154600160a060020a0383811691161480156105e657507f51756f746174696f6e000000000000000000000000000000000000000000000081145b1561060e57600081815260066020526040902060020180546003919060ff19166001836104d5565b5050565b60055433600160a060020a0390811691161461062d57600080fd5b600082815260066020908152604080832060001985018452909152908190207f554cacc5e0fe49930e50b9d5dc80636cc4e366483412a50eba0f75b35714919e9151602080825282546002600019610100600184161502019091160490820181905281906040820190849080156106e55780601f106106ba576101008083540402835291602001916106e5565b820191906000526020600020905b8154815290600101906020018083116106c857829003601f168201915b50509250505060405180910390a15050565b600154600160a060020a03848116911614801561076157507f51756f746174696f6e0000000000000000000000000000000000000000000000821480610749575060c860020a66496e766f6963650282145b806107615750600080516020610c1d83398151915282145b806107a35750600054600160a060020a0384811691161480156107a357507f50757263686173654f726465720000000000000000000000000000000000000082145b806107e95750600254600160a060020a0384811691161480156107e9575060c860020a66496e766f696365028214806107e95750600080516020610c1d83398151915282145b1561044c57600082815260066020908152604080832060028101805460ff19166004179055600381015484529091529081902082916007919051808280546001816001161561010002031660029004801561087b5780601f1061085957610100808354040283529182019161087b565b820191906000526020600020905b815481529060010190602001808311610867575b50509283525050602001604051809103902090805161089e929160200190610b81565b507f6e521b5f62820c4e4db7772b710073c2ececdedd5a7424917ef729cb3d5d9dd18284604051918252600160a060020a031660208201526040908101905180910390a161044c565b60055433600160a060020a0390811691161461090257600080fd5b60008181526006602090815260408083206003810154600019018452909152908190207f554cacc5e0fe49930e50b9d5dc80636cc4e366483412a50eba0f75b35714919e9151602080825282546002600019610100600184161502019091160490820181905281906040820190849080156109be5780601f10610993576101008083540402835291602001916109be565b820191906000526020600020905b8154815290600101906020018083116109a157829003601f168201915b50509250505060405180910390a150565b60055433600160a060020a039081169116146109ea57600080fd5b6001805473ffffffffffffffffffffffffffffffffffffffff19908116600160a060020a038881169190911792839055600080548316888316178082556002805485168985161790819055600380548616898616179081905560048054909616888616179586905560066020527f98bd6dfa5f1ee7e12343c9cfd3a8ad88d68dadea767a8b11cf388ae2a78ec886805460ff199081169091557f03aa4a6180c2d738761b71dbcf581d565633d1cb0b935fe3934c8025fa0ed43c8054821690557f156755681a8036b9fce7c9fc81059f30250ba23b5c053e16d818401d45921563805482169055600080516020610c1d8339815191529094527fd6b9dd44b20d9dd9017ffce099d911b07646ddab228f47d069ded7ca2ce7079b80549094169093557f310897517cb4b376cd2b8464160f9b2a904cb1861d9d7cb86cd78c4f43513bc495841694918416939081169281169116604051600160a060020a039586168152938516602085015291841660408085019190915290841660608401529216608082015260a001905180910390a15050505050565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10610bc257805160ff1916838001178555610bef565b82800160010185558215610bef579182015b82811115610bef578251825591602001919060010190610bd4565b50610bfb929150610bff565b5090565b610c1991905b80821115610bfb5760008155600101610c05565b90560042696c6c4f664c6164696e670000000000000000000000000000000000000000a165627a7a72305820a6271b4dca9b54d6acfced70f43f8fe31c3ffd4f5de8afc626be45c47a292b260029',
    gas: '1000000',
    gasPrice: '4000000000'
  }, function(e, contract) {
    if (typeof contract.address !== 'undefined') {
      eventEmitter.emit('deploySuccess', contract.address);
    }
  });
}

function setup(buyer, seller, buyerBank, sellerBank, shipper, address) {
  var order = orderContract.at(address);
  var gasUsage = (order.setup.estimateGas(buyer, seller, buyerBank, sellerBank, shipper) < config.gasUsage) ? order.setup.estimateGas(buyer, seller, buyerBank, sellerBank, shipper) : config.gasUsage;
  order.setup.sendTransaction(buyer, seller, buyerBank, sellerBank, shipper, {
    gas: gasUsage,
    gasPrice: config.gasPrice,
    from: config.ethAddress
  }, function(error, result) {
    if (error) {
      console.error(error);
      response.send(error);
      return;
    }
    var myEvent = order.LogSetup();
    myEvent.watch(function(err, res) {
      if (err) {
        console.error(err);
        response.send(err);
        return;
      }
      myEvent.stopWatching();
      /* Read the parameters from the event */
      var res_buyer = res.args.Buyer;
      var res_seller = res.args.Seller;
      eventEmitter.emit('setupTxnSuccess');
    });
  });
}

function paymentInitiator(address) {
  var loc = letterOfCreditContract.at(address);
  gasUsage = (loc.shipped.estimateGas() < config.gasUsage) ? loc.shipped.estimateGas() : config.gasUsage;
  loc.shipped.sendTransaction({
    gas: gasUsage,
    gasPrice: config.gasPrice,
    from: config.ethAddress
  }, function(error, result) {
    if (error) {
      console.error(error);
      response.send(error);
      return;
    }

    var myEvent = loc.LogShipped();
    myEvent.watch(function(err, res) {
      if (err) {
        console.error(err);
        response.send(err);
        return;
      }
      myEvent.stopWatching();
      var time = res.args.date.c[0];
      /* Read the parameters from the event */
      eventEmitter.emit('shippingDateTxnSuccess', time, 'Payment Scheduled');
    });
  });
}

function onFindShipper(err, usr) {
  if (err)
    return done(err);
  req = this.req;
  res = this.res;
  if (!usr) {
    req.session.message = "Not a registered user";
    res.redirect('/profile');
  } else if (usr.local.role != "Shipper") {
    req.session.message = "Not a shipper";
    res.redirect('/profile');
  } else {
    shipperHash = usr.local.userHash;
    eventEmitter.emit('SaveTrade');
  }
}

function onFindBuyer(err, usr) {
  if (err)
    return done(err);
  req = this.req;
  res = this.res;
  if (!usr) {
    req.session.message = "Not a registered user";
    res.redirect('/profile');
  } else if (usr.local.role != "Buyer") {
    req.session.message = "Not a buyer";
    res.redirect('/profile');
  } else {
    buyerHash = usr.local.userHash;
    eventEmitter.emit('CheckSeller');
  }
}

function onFindBuyerBank(err, usr) {
  if (err)
    return done(err);
  req = this.req;
  res = this.res;
  if (!usr) {
    req.session.message = "Not a registered user";
    res.redirect('/profile');
  } else if (usr.local.role != "Bank") {
    req.session.message = "Not a Bank";
    res.redirect('/profile');
  } else {
    buyerBankHash = usr.local.userHash;
    eventEmitter.emit('CheckShipper');
  }
}

function onFindSellerBank(err, usr) {
  if (err)
    return done(err);
  req = this.req;
  res = this.res;
  if (!usr) {
    req.session.message = "Not a registered user";
    res.redirect('/profile');
  } else if (usr.local.role != "Bank") {
    req.session.message = "Not a Bank";
    res.redirect('/profile');
  } else {
    sellerBankHash = usr.local.userHash;
    eventEmitter.emit('CheckBuyerBank');
  }
}

function onFindSeller(err, usr) {
  if (err)
    return done(err);
  req = this.req;
  res = this.res;
  if (!usr) {
    req.session.message = "Not a registered user";
    res.redirect('/profile');
  } else if (usr.local.role != "Seller") {
    req.session.message = "Not a seller";
    res.redirect('/profile');
  } else {
    sellerHash = usr.local.userHash;
    eventEmitter.emit('CheckSellerBank');
  }
}

function payToSeller(address) {
  var loc = letterOfCreditContract.at(address);
  gasUsage = (loc.pay.estimateGas() < config.gasUsage) ? loc.pay.estimateGas() : config.gasUsage;
  loc.pay.sendTransaction({
    gas: gasUsage,
    gasPrice: config.gasPrice,
    from: config.ethAddress
  }, function(error, result) {
    if (error) {
      console.error(error);
      response.send(error);
      return;
    }

    var myEvent = loc.LogPayment();
    myEvent.watch(function(err, res) {
      if (err) {
        console.error(err);
        response.send(err);
        return;
      }
      myEvent.stopWatching();
      /* Read the parameters from the event */
      if (res.args.s == "True") eventEmitter.emit('paymentSuccess', 'Payment Successful');
      if (res.args.s == "False") eventEmitter.emit('paymentSuccess', 'Payment Declined');
    });
  });
}

function approve(address, sender, docName) {
  var order = orderContract.at(address);
  gasUsage = (order.approve.estimateGas(sender, docName) < config.gasUsage) ? order.approve.estimateGas(sender, docName) : config.gasUsage;
  order.approve.sendTransaction(sender, docName, {
    gas: gasUsage,
    from: config.ethAddress
  }, function(error, result) {
    if (error) {
      console.error(error);
      response.send(error);
      return;
    }

    var myEvent = order.LogApprove();
    myEvent.watch(function(err, res) {
      if (err) {
        console.error(err);
        response.send(err);
        return;
      }
      myEvent.stopWatching();
      /* Read the parameters from the event */
      var docHash = res.args.docName;
      eventEmitter.emit('uploadDocTxnSuccess');
    });
  });
}

function reject(address, sender, docName, reason) {
  var order = orderContract.at(address);
  gasUsage = (order.reject.estimateGas(sender, docName, reason) < config.gasUsage) ? order.reject.estimateGas(sender, docName, reason) : config.gasUsage;
  order.reject.sendTransaction(sender, docName, reason, {
    gas: gasUsage,
    from: config.ethAddress
  }, function(error, result) {
    if (error) {
      console.error(error);
      response.send(error);
      return;
    }
    var myEvent = order.LogReject();
    myEvent.watch(function(err, res) {
      if (err) {
        console.error(err);
        response.send(err);
        return;
      }
      myEvent.stopWatching();
      /* Read the parameters from the event */
      var docHash = res.args.docName;
      eventEmitter.emit('uploadDocTxnSuccess');
    });
  });
}

function locapprove(address, sender) {
  var loc = letterOfCreditContract.at(address);
  gasUsage = (loc.approve.estimateGas(sender) < config.gasUsage) ? loc.approve.estimateGas(sender) : config.gasUsage;
  loc.approve.sendTransaction(sender, {
    gas: gasUsage,
    from: config.ethAddress
  }, function(error, result) {
    if (error) {
      console.error(error);
      response.send(error);
      return;
    }

    var myEvent = loc.LogApprove();
    myEvent.watch(function(err, res) {
      if (err) {
        console.error(err);
        response.send(err);
        return;
      }
      myEvent.stopWatching();
      /* Read the parameters from the event */
      eventEmitter.emit('uploadDocTxnSuccess');
    });
  });
}


function locreject(address, sender, reason) {
  var loc = letterOfCreditContract.at(address);
  gasUsage = (loc.reject.estimateGas(sender, reason) < config.gasUsage) ? loc.reject.estimateGas(sender, reason) : config.gasUsage;
  loc.reject.sendTransaction(sender, reason, {
    gas: gasUsage,
    from: config.ethAddress
  }, function(error, result) {
    if (error) {
      console.error(error);
      response.send(error);
      return;
    }

    var myEvent = loc.LogReject();
    myEvent.watch(function(err, res) {
      if (err) {
        console.error(err);
        response.send(err);
        return;
      }
      myEvent.stopWatching();
      /* Read the parameters from the event */
      eventEmitter.emit('uploadDocTxnSuccess');
    });
  });
}

function str2bytearr(str) {
  var data = [];
  for (var i = 0; i < str.length; i++) {
    data.push(str.charCodeAt(i));
  }
  return data;
}

function hexToString(hex) {
  var string = '';
  hex = hex.slice(2);
  for (var i = 0; i < hex.length; i += 2) {
    string += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  var list = string.slice(1, string.length - 1).split(',');
  var result = "";
  for (var i = 0; i < list.length; i++) {
    result += String.fromCharCode(parseInt(list[i]));
  }
  return result;
}

function onNewTradeSession(err) {
  if (err)
    throw err;
  req = this.req;
  res = this.res;
  res.send({
    tradeID: tradeID,
    buyer: newTrade.buyer_id,
    seller: newTrade.seller_id,
    status: newTrade.status,
    buyerHash: buyerHash,
    sellerHash: sellerHash,
    buyerBankHash: buyerBankHash,
    sellerBankHash: sellerBankHash,
    shipperHash: shipperHash
  });
}

function onFindTrade(err, trade) {
  if (err)
    throw err;
  req = this.req;
  res = this.res;
  trade.quotation.hash = "No quotation till now";
  trade.quotation.txnID = "None";
  trade.po.hash = "No Purchase Order till now";
  trade.po.txnID = "None";
  trade.invoice.hash = "No Invoice till now";
  trade.invoice.txnID = "None";
  trade.letterofcredit.No_of_days = 0;
  trade.letterofcredit.contract_id = "None";
  trade.letterofcredit.Credit_Amount = 0;
  trade.billoflading.hash = "No Bill of lading till now";
  trade.billoflading.txnID = "None";
  trade.status = "Quotation Not Uploaded";
  trade.save(function(err) {
    if (err)
      throw err;
    res.send();
  });
}

function onFindTradeResume(err, trade) {
  if (err)
    return err;
  req = this.req;
  res = this.res;
  req.session.tradesession = trade._id;
  if (req.body.username == trade.sellerbank_id) {
    req.session.sender = "Seller Bank";
  } else {
    req.session.sender = req.body.senderpage;
  }
  res.redirect('/tradesession');
}

function onFindTradeApprove(err, trade) {
  if (err)
    return err;
  req = this.req;
  res = this.res;
  eventEmitter.once('uploadDocTxnSuccess', function() {
    var list = trade.status.split(';');
    if (trade.status == "Invoice Approved By Seller Bank; Ethereum Txn Pending;") trade.status = "Invoice Approved";
    else {
      if (trade.status == "Bill Of Lading Approved; Ethereum Txn Pending;") paymentInitiator(trade.letterofcredit.contract_id);
      else trade.status = list[0];
    }
    trade.save(function(err) {
      if (err)
        throw err;
      return;
    });

  });
  eventEmitter.once('shippingDateTxnSuccess', function(time, status) {
    trade.status = status;
    trade.save(function(err) {
      if (err)
        throw err;
      payToSeller(trade.letterofcredit);
      return;
    });
  });

  switch (req.body.approvaltype) {
    case "Q":
      trade.status = "Quotation Approved; Ethereum Txn Pending;";

      eventEmitter.once('ConnectionuploadDoc', function() {
        approve(trade.contract_id, userHash, 'Quotation');
      });

      eventEmitter.emit('checkBuyerinApprove', trade.buyer_id);
      break;
    case "P":
      trade.status = "Purchase Order Approved; Ethereum Txn Pending;";

      eventEmitter.emit('checkSellerinApprove', trade.seller_id);

      eventEmitter.once('ConnectionuploadDoc', function() {
        approve(trade.contract_id, userHash, 'PurchaseOrder');
      });
      break;
    case "I":
      trade.status = "Invoice Approved by Buyer; Ethereum Txn Pending;";

      eventEmitter.once('ConnectionuploadDoc', function() {
        approve(trade.contract_id, userHash, 'Invoice');
      });

      eventEmitter.emit('checkBuyerinApprove', trade.buyer_id);
      break;
    case "IA":
      trade.status = "Invoice Approved By Seller Bank; Ethereum Txn Pending;";
      eventEmitter.once('ConnectionuploadDoc', function() {
        approve(trade.contract_id, userHash, 'Invoice');
      });

      eventEmitter.emit('checkSellerBankinApprove', trade.bank_id);
      break;
    case "L":
      eventEmitter.once('ConnectionuploadDoc', function() {
        trade.status = "Letter Of Credit Approved by Buyer; Ethereum Txn Pending;";
        trade.save(function(err) {
          if (err)
            throw err;
          locapprove(trade.letterofcredit.contract_id, userHash);
          return;
        });
      });

      eventEmitter.once('ConnectionuploadDoc1', function() {
        trade.status = "Letter Of Credit Approved; Ethereum Txn Pending;";
        trade.save(function(err) {
          if (err)
            throw err;
          locapprove(trade.letterofcredit.contract_id, userHash);
          return;
        });
      });

      eventEmitter.on('CheckSeller1', function(seller) {
        userdb.findUserByUsername(seller, req, res, onFindUserinApprove1);
      });

      if (req.body.senderpage == "Buyer") eventEmitter.emit('checkBuyerinApprove', trade.buyer_id);
      if (req.body.senderpage == "Seller") eventEmitter.emit('CheckSeller1', trade.seller_id);
      break;
    case "B":
      eventEmitter.once('ConnectionuploadDoc', function() {
        trade.status = "Bill Of Lading Approved by Buyer; Ethereum Txn Pending;";
        trade.save(function(err) {
          if (err)
            throw err;
          approve(trade.contract_id, userHash, 'BillOfLading');
          return;
        });
      });

      eventEmitter.once('ConnectionuploadDoc1', function() {
        trade.status = "Bill Of Lading Approved; Ethereum Txn Pending;";
        trade.save(function(err) {
          if (err)
            throw err;
          approve(trade.contract_id, userHash, 'BillOfLading');
          //payToSeller(trade.letterofcredit);
          return;
        });
      });

      eventEmitter.once('checkBuyerBankinApprove', function() {
        userdb.findUserByUsername(trade.bank_id, req, res, onFindUserinApprove1);
      });

      if (req.body.senderpage == "Buyer") eventEmitter.emit('checkBuyerinApprove', trade.buyer_id);
      if (req.body.senderpage == "Bank") eventEmitter.emit('checkBuyerBankinApprove');
      break;
  }
  trade.save(function(err) {
    if (err)
      throw err;
    return;
  });
  req.session.tradesession = trade._id;
  req.session.sender = req.body.senderpage;
  res.redirect('/tradesession');
}

function onFindTradeDeploySuccess(err, trade) {
  req = this.req;
  res = this.res;
  trade.contract_id = address;
  trade.save(function(err) {
    if (err)
      throw err;
    eventEmitter.emit('setup', address);
  });
}

function onFindTradeReject(err, trade) {
  if (err)
    return err;
  req = this.req;
  res = this.res;
  eventEmitter.once('uploadDocTxnSuccess', function() {
    var list = trade.status.split(';');
    if (trade.status == "Invoice Rejected By Seller Bank; Ethereum Txn Pending;") trade.status = "Invoice Rejected";
    else trade.status = list[0];
    trade.save(function(err) {
      if (err)
        throw err;
      return;
    });
  });

  switch (req.body.approvaltype) {
    case "Q":
      trade.status = "Quotation Rejected; Ethereum Txn Pending;";

      eventEmitter.once('ConnectionuploadDoc', function() {
        reject(trade.contract_id, userHash, 'Quotation', req.body.reason);
      });

      eventEmitter.emit('checkBuyerinApprove', trade.buyer_id);
      break;
    case "P":
      trade.status = "Purchase Order Rejected; Ethereum Txn Pending;";
      eventEmitter.emit('checkSellerinApprove', trade.seller_id);

      eventEmitter.once('ConnectionuploadDoc', function() {
        reject(trade.contract_id, userHash, 'PurchaseOrder', req.body.reason);
      });
      break;
    case "I":
      trade.status = "Invoice Rejected; Ethereum Txn Pending;";

      eventEmitter.once('ConnectionuploadDoc', function() {
        reject(trade.contract_id, userHash, 'Invoice', req.body.reason);
      });

      eventEmitter.emit('checkBuyerinApprove', trade.buyer_id);
      break;
    case "IA":
      trade.status = "Invoice Rejected; Ethereum Txn Pending;";
      eventEmitter.once('ConnectionuploadDoc', function() {
        reject(trade.contract_id, userHash, 'Invoice', req.body.reason);
      });

      eventEmitter.emit('checkSellerBankinApprove', trade.bank_id);
      break;
    case "L":
      eventEmitter.once('ConnectionuploadDoc', function() {
        trade.status = "Letter Of Credit Rejected; Ethereum Txn Pending;";
        trade.save(function(err) {
          if (err)
            throw err;
          locreject(trade.letterofcredit.contract_id, userHash, req.body.reason);
          return;
        });
      });

      eventEmitter.once('ConnectionuploadDoc2', function() {
        trade.status = "Letter Of Credit Rejected; Ethereum Txn Pending;";
        trade.save(function(err) {
          if (err)
            throw err;
          locreject(trade.letterofcredit.contract_id, userHash, req.body.reason);
          return;
        });
      });

      eventEmitter.on('CheckSeller2', function(seller) {
        userdb.findUserByUsername(seller, req, res, onFindUserinApprove2);
      });

      if (req.body.senderpage == "Buyer") eventEmitter.emit('checkBuyerinApprove', trade.buyer_id);
      if (req.body.senderpage == "Seller") eventEmitter.emit('CheckSeller2', trade.seller_id);
      break;
    case "B":
      eventEmitter.once('ConnectionuploadDoc', function() {
        trade.status = "Bill Of Lading Rejected by Buyer; Ethereum Txn Pending;";
        trade.save(function(err) {
          if (err)
            throw err;
          reject(trade.contract_id, userHash, 'BillOfLading', req.body.reason);
          return;
        });
      });

      eventEmitter.once('ConnectionuploadDoc1', function() {
        trade.status = "Bill Of Lading Rejected; Ethereum Txn Pending;";
        trade.save(function(err) {
          if (err)
            throw err;
          reject(trade.contract_id, userHash, 'BillOfLading', req.body.reason);
          return;
        });
      });

      eventEmitter.once('checkBuyerBankinApprove', function() {
        userdb.findUserByUsername(trade.bank_id, req, res, onFindUserinApprove1);
      });

      if (req.body.senderpage == "Buyer") eventEmitter.emit('checkBuyerinApprove', trade.buyer_id);
      if (req.body.senderpage == "Bank") eventEmitter.emit('checkBuyerBankinApprove');
      break;
  }
  trade.save(function(err) {
    if (err)
      throw err;
    return;
  });
  req.session.tradesession = trade._id;
  req.session.sender = req.body.senderpage;
  res.redirect('/tradesession');
}

function onFindTradePaymentSuccess(err, trade) {
  if (status == 'Payment Successful') web3.eth.sendTransaction({
    from: config.ethAddress,
    to: "0xc563ecbb71c4258539cd09c85dd5669a2a201a51",
    value: trade.letterofcredit.Credit_Amount
  });
  trade.status = status;
  trade.save(function(err) {
    if (err)
      throw err;
    return;
  });
}

function onFindUserinApprove(err, usr) {
  if (err)
    return done(err);
  userHash = usr.local.userHash;
  eventEmitter.emit('ConnectionuploadDoc');

}

function onFindUserinApprove1(err, usr) {
  if (err)
    return done(err);
  userHash = usr.local.userHash;
  eventEmitter.emit('ConnectionuploadDoc1');
}

function onFindUserinApprove2(err, usr) {
  if (err)
    return done(err);
  userHash = usr.local.userHash;
  eventEmitter.emit('ConnectionuploadDoc2');

}
