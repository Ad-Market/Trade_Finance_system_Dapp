var fs = require("fs");
var ipfsApi = require('ipfs-api');
var ipfs = ipfsApi({
  host: '127.0.0.1',
  port: '5001',
  protocol: 'http'
});
// ipfs.setProvider(require('ipfs-api')('localhost', '5001'));
const bs58 = require('bs58');
const url = require('url');
var multer = require('multer');
var bodyParser = require('body-parser');
var events = require('events');
var urlencodedParser = bodyParser.urlencoded({
  extended: false
});
var Trade = require('../trade/model');
var tradedb = require('../trade/db');
var Registry = require('../app/models/Registry');
var Web3 = require('web3');
var buyerHash, sellerHash, buyerBankHash, sellerBankHash, shipperHash, docHash, dwnldDoc, dwnldDocHash, contractAddress, registryAddress;
var Scheduler = require('mongo-scheduler');
var scheduler = new Scheduler("mongodb://localhost/db_name", {
  doNotFire: false
});
var User = require('../user/model');
var userdb = require('../user/db');
var eventEmitter = new events.EventEmitter();
var web3 = new Web3();
var gasUsage;
const IPFS = require('ipfs-daemon')
const ipfsdaemon = new IPFS();

var config = require('../config.js');
registryAddress = config.registryAddress;

web3.setProvider(new web3.providers.HttpProvider(config.web3Provider));

var userHashReturned, index;
require('../build/ABI/registry.js');
var registryContract = web3.eth.contract(registryABI);
require('../build/ABI/order.js');
var orderContract = web3.eth.contract(orderABI);
require('../build/ABI/letterOfCredit.js');
var letterOfCreditContract = web3.eth.contract(letterOfCreditABI);


eventEmitter.on('pay', function(address, id, days, time) {
  scheduler.on('PaymentProcessor', function() {
    payToSeller(address, id);
  });
  var payEvent = {
    name: 'PaymentProcessor',
    after: new Date((time * 1000 + (days * 60 * 1000)))
  };

  scheduler.schedule(payEvent);
});


eventEmitter.once('deploySuccess', function(address) {
  var newRegistry = new Registry();
  newRegistry.deployed = 'Yes';
  newRegistry.contract_id = address;
  newRegistry.save(function(err) {
    if (err)
      throw err;
    console.log('Address of registry contract deployed:', address);
  });
});


/*Registry.findOne({ 'deployed' :  'Yes' }, function(err, Registry) {
	if (err)
		return err;
	eventEmitter.once('connectionSetup', function(){
		deployRegistry();
	});
	if(Registry) {
    console.log('Registry Contract Already Deployed; Fetchng from MONGO DB...');
    registryAddress = Registry.contract_id;
    eventEmitter.emit('connectionSetup');
  }
	else{
    console.log('Deploying Registry Contract....');
	  eventEmitter.emit('connectionSetup');
	}
});*/


module.exports = {
  fileupload: function(req, res) {
    req.session.message = "";
    if (req.body.id) {
      var id = req.body.id;
    }
    var username = req.body.username;

    if (req.body.senderpage == "signuppage") {
      console.log('Signup Process - Generating IPFS Hash for KYC Docs....')
      for (var ind = 0; ind <= req.files.length - 1;) {
        eventEmitter.once('connection' + ind, function(i, account, hash) {
          console.log('Submitting IPFS hash to Registry Contract');
          submitKYC(i, account, hash);
        });
        ++ind;
      }
      eventEmitter.once('contDocUpload', function(i, username) {
        if (i <= req.files.length - 1) {
          fs.readFile(req.files[i].path, function(err, data) {
            ipfs.add(new Buffer(data), function(err, hash) {
              console.log('IPFS hash for KYC doc', i, ' has been generated');
              console.log(hash[0].hash);
              if (err) throw err;
              userdb.findUserByUsername(username, req, res, onFindUser);
            });
          });
        }
      });
      eventEmitter.once('txnSuccess', function(i) {
        if (userHashReturned == 'empty') res.render('signup.ejs', {
          message: "Sorry!!! Our servers are busy right now"
        });
        eventEmitter.emit('contDocUpload', i + 1, username);
      });
      eventEmitter.once('checkUser', function(i, username, hash) {
        userdb.findUserByUsername(username, req, res, onFindUser2.bind({
          'req': req,
          'res': res
        }));

      });
      eventEmitter.once('startDocUpload', function(i, username) {
        if (i <= req.files.length - 1) {
          fs.readFile(req.files[i].path, function(err, data) {
            ipfs.add(new Buffer(data), function(err, hash) {
              if (err) throw err;
              console.log('IPFS Hash of KYC Doc 0:', hash[0].hash);
              eventEmitter.emit('checkUser', i, username, hash[0].hash);
            });
          });
        }
      });
      eventEmitter.emit('startDocUpload', 0, username);
    } else {
      fs.readFile(req.files[0].path, function(err, data) {
        ipfs.add(new Buffer(data), function(err, hash) {
          if (err) throw err;
          if (req.body.senderpage == "quotation") {
            tradedb.findTradeByTradeID(id, req, res, onFindTradeQuotationUpload.bind({
              'req': req,
              'res': res
            }));
          }
          if (req.body.senderpage == "po") {
            tradedb.findTradeByTradeID(id, req, res, onFindTradeQuotationUpload.bind({
              'req': req,
              'res': res
            }));
          }
          if (req.body.senderpage == "invoice") {
            tradedb.findTradeByTradeID(id, req, res, onFindTradeInvoiceUpload.bind({
              'req': req,
              'res': res
            }));
          }
          if (req.body.senderpage == "loc") {
            tradedb.findTradeByTradeID(id, req, res, onFindTradeLOCUpload.bind({
              'req': req,
              'res': res
            }));
          }
          if (req.body.senderpage == "bol") {
            tradedb.findTradeByTradeID(id, req, res, onFindTradeBOLUpload.bind({
              'req': req,
              'res': res
            }));
          }
        });
      });
    }
  },
  filedownload: function(req, res) {
    ipfs.get(req.body.kychash, function(err, stream) {
      if (err) {
        throw err;
      }
      res.writeHead(200, {
        'Content-Disposition': 'attachment'
      });
      stream.on('data', (file) => {
        // write the file's path and contents to standard out
        file.content.pipe(res);
      });
    });
  },

  docdownload: function(req, res) {
    tradedb.findTradeByTradeID(req.body.trade_id, req, res, onFindTradeDocDownload.bind({
      'req': req,
      'res': res
    }));
  },

  docdownloadbc: function(req, res) {
    eventEmitter.once('getLatestDoc', function(address) {
      var order = orderContract.at(address);
      gasUsage = (order.getLatestDoc.estimateGas(dwnldDoc) < config.gasUsage) ? order.getLatestDoc.estimateGas(dwnldDoc) : config.gasUsage;
      order.getLatestDoc.sendTransaction(dwnldDoc, {
        gas: gasUsage,
        from: config.ethAddress
      }, function(err, result) {
        if (err) {
          console.error(err);
          res.send(err);
          return;
        }
        var myEvent = order.LogGetDoc();
        myEvent.watch(function(err, result) {
          if (err) {
            console.error(err);
            res.send(err);
            return;
          }
          myEvent.stopWatching();
          /* Read the parameters from the event */
          var dwnldDocHash = result.args.hash;
          ipfs.get(hexToString(dwnldDocHash), function(err, stream) {
            if (err) {
              throw err;
            }
            console.log(res);
            res.writeHead(200, {
              'Content-Disposition': 'attachment'
            });
            stream.on('data', (file) => {
              // write the file's path and contents to standard out
              file.content.pipe(res);
            });
          });
        });
      });
    });
    tradedb.findTradeByTradeID(req.body.trade_id, req, res, onFindTradeDocDownload2);
    switch (req.body.docname) {
      case "quotation":
        dwnldDoc = "Quotation";
        break;
      case "po":
        dwnldDoc = "PurchaseOrder";
        break;
      case "invoice":
        dwnldDoc = "Invoice";
        break;
      case "billoflading":
        dwnldDoc = "BillOfLading";
        break;
    }
  },

  getKYChash: function(req, res) {
    var usrHash = req.body.usrHash;
    var registry = registryContract.at(registryAddress);
    var i = 0;
    gasUsage = (registry.getKYChash.estimateGas(usrHash) < config.gasUsage) ? registry.getKYChash.estimateGas(usrHash) : config.gasUsage;
    console.log("Get KYC gas Usage=", gasUsage);
    registry.getKYChash.sendTransaction(usrHash, {
      gas: gasUsage,
      gasPrice: config.gasPrice,
      gasPrice: 5000000000,
      from: config.ethAddress
    }, function(err, result) {
      if (err) {
        res.send(err);
        return;
      }
      var myEvent = registry.LogGetKYChash();
      myEvent.watch(function(err, res) {
        if (err) {
          res.send(err);
          return;
        }
        console.log('Watching');

        ++i;
        if (i == req.body.indx) {
          console.log('Stop Listening');
          myEvent.stopWatching();
          /* Read the parameters from the event */
          var docHash = res.args.hash;
          console.log('KYC Hash retrieved from Blockchain', docHash);
          ipfs.get(hexToString(docHash), function(err, stream) {
            if (err) {
              throw err;
            }
            res.writeHead(200, {
              'Content-Disposition': 'attachment'
            });
            stream.on('data', (file) => {
              // write the file's path and contents to standard out
              console.log('Sending res from IPFS to client');
              file.content.pipe(res);
            });
          });
        }

      });
    });
  },

  letterOfCredit: function(req, res) {
    var id = req.body.trade_id;
    var buyer = req.body.buyer;
    var seller = req.body.seller;
    var buyerBank = req.body.buyerBank;
    var sellerBank = req.body.sellerBank;
    var timePeriod = req.body.timePeriod;
    var creditAmount = req.body.creditAmount;
    var Trade = require('../trade/model');
    eventEmitter.once('connection', function(address) {
      tradedb.findTradeByTradeID(id, req, res, onFindTradeConnection);
    });
    eventEmitter.once('deploySuccess', function(address, trade_id) {
      eventEmitter.emit('connection', address);
      tradedb.findTradeByTradeID(req.body.trade_id, req, res, onFindTradeDeploySuccess);
    });
    eventEmitter.once('connectionSetup1', function() {
      deployLOC(req.body.trade_id);
      Trade.findOne({
        'trade_id': req.body.trade_id
      }, function(err, trade) {
        trade.status = "Letter Of Credit Uploaded; Ethereum Txn Pending;";
        trade.save(function(err) {
          if (err)
            throw err;
          req.session.tradesession = req.body.trade_id;
          res.redirect('/tradesession');
          return;
        });
      });

    });

    eventEmitter.once('CheckSellerBank', function() {

      User.findOne({
        'local.username': sellerBank
      }, function(err, usr) {
        if (err)
          return done(err);
        sellerBankHash = usr.local.userHash;
        eventEmitter.emit('connectionSetup1');
      });
    });
    eventEmitter.once('CheckBuyerBank', function() {

      User.findOne({
        'local.username': buyerBank
      }, function(err, usr) {
        if (err)
          return done(err);
        buyerBankHash = usr.local.userHash;
        eventEmitter.emit('CheckSellerBank');
      });
    });
    eventEmitter.once('CheckSeller', function() {

      User.findOne({
        'local.username': seller
      }, function(err, usr) {
        if (err)
          return done(err);
        sellerHash = usr.local.userHash;
        eventEmitter.emit('CheckBuyerBank');
      });
    });
    eventEmitter.once('CheckBuyer', function() {
      User.findOne({
        'local.username': buyer
      }, function(err, usr) {
        if (err)
          return done(err);
        buyerHash = usr.local.userHash;
        eventEmitter.emit('CheckSeller');
      });
    });
    eventEmitter.emit('CheckBuyer');
    eventEmitter.once('paymentSuccess', function(status, id) {
      Trade.findOne({
        'trade_id': id
      }, function(err, trade) {
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
      });


    });

    eventEmitter.once('locTxnSuccess', function(time, id) {
      Trade.findOne({
        'trade_id': id
      }, function(err, trade) {
        // if there are any errs, return the err
        if (err)
          return done(err);
        trade.status = "Letter Of Credit Uploaded";
        trade.save(function(err) {
          if (err)
            throw err;

          eventEmitter.emit('pay', trade.letterofcredit.contract_id, id, trade.letterofcredit.No_of_days, time);
        });
      });
    });
  }


  /*app.post("/deploy", function(req, res) {
    var browser_untitled12_sol_registry = registryContract.new(
     {
       from: config.ethAddress,
       data: '0x60606040526000600155341561001457600080fd5b5b60008054600160a060020a03191633600160a060020a03161790555b5b61067c806100416000396000f300606060405263ffffffff7c01000000000000000000000000000000000000000000000000000000006000350416634dc928858114610069578063a080ecf51461009c578063d624fdb6146100bd578063f2b7afed146100f0578063f3c95c6014610163575b600080fd5b341561007457600080fd5b610088600160a060020a0360043516610196565b604051901515815260200160405180910390f35b34156100a757600080fd5b6100bb600160a060020a0360043516610231565b005b34156100c857600080fd5b610088600160a060020a0360043516610363565b604051901515815260200160405180910390f35b34156100fb57600080fd5b61008860048035600160a060020a03169060446024803590810190830135806020601f820181900481020160405190810160405281815292919060208401838380828437509496506103f395505050505050565b604051901515815260200160405180910390f35b341561016e57600080fd5b610088600160a060020a03600435166104d9565b604051901515815260200160405180910390f35b6000805433600160a060020a039081169116146101b257600080fd5b600160a060020a0382166000908152600860205260408120906101d5828261053a565b5060038101805460ff1916905560006004909101557f14e8b0701a0ce64781f7b3b6f908cacf59008ae7a2112e3bd11b5bcd1e5ef10682604051600160a060020a03909116815260200160405180910390a15060015b5b919050565b6000805433600160a060020a0390811691161461024d57600080fd5b610256826104d9565b1561035c575060005b600160a060020a03821660009081526008602052604090206004015481101561035c57600160a060020a03821660009081526008602052604090207f225186bab75fba659e34214506967f862b1fa6dcff4335714762bcd85e5080139082600381106102c757fe5b0160005b50604051602080825282546002600019610100600184161502019091160490820181905281906040820190849080156103455780601f1061031a57610100808354040283529160200191610345565b820191906000526020600020905b81548152906001019060200180831161032857829003601f168201915b50509250505060405180910390a15b60010161025f565b5b5b5b5050565b6000805433600160a060020a0390811691161461037f57600080fd5b600160a060020a038216600090815260086020526040902060030180546001919060ff191682805b02179055507f83938938672b119b6a597cb00c08e11e7c508110f1c49ef59f30ae4ab30f865d82604051600160a060020a03909116815260200160405180910390a15060015b5b919050565b600160a060020a038216600090815260086020526040812060048101548391906003811061041d57fe5b0160005b50908051610433929160200190610568565b50600160a060020a038316600090815260086020526040902060048101805460019081019091556003909101805460ff191682805b0217905550600160a060020a03831660009081526008602052604090819020600401547f33438763d426155c196efb01a0ffeeed8e4037d1c364437f33b8681cabdaaa0f9185919051600160a060020a03909216825260208201526040908101905180910390a15060015b92915050565b6000805433600160a060020a039081169116146104f557600080fd5b60015b600160a060020a03831660009081526008602052604090206003015460ff16600181111561052257fe5b14156105305750600161022b565b5060005b5b919050565b50600061054782826105e7565b50600101600061055782826105e7565b506105669060010160006105e7565b565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106105a957805160ff19168380011785556105d6565b828001600101855582156105d6579182015b828111156105d65782518255916020019190600101906105bb565b5b506105e392915061062f565b5090565b50805460018160011615610100020316600290046000825580601f1061060d575061062b565b601f01602090049060005260206000209081019061062b919061062f565b5b50565b61064d91905b808211156105e35760008155600101610635565b5090565b905600a165627a7a72305820ffdff4ed22a9db9be8dbef0fdf8e5ba5d566446ca6ee60a4f4f3927e762fcdfe0029',
       gas: '4300000'
     }, function (e, contract){
      if (typeof contract.address !== 'undefined') {
           eventEmitter.emit('deploySuccess', contract.address);
      }
   })
  });*/
  // });

};
// });

function deployRegistry() {
  console.log('reg');
  console.log(web3.eth.accounts);
  var browser_untitled12_sol_registry = registryContract.new({
    from: config.ethAddress,
    data: '0x60606040526000600155341561001457600080fd5b5b60008054600160a060020a03191633600160a060020a03161790555b5b61067c806100416000396000f300606060405263ffffffff7c01000000000000000000000000000000000000000000000000000000006000350416634dc928858114610069578063a080ecf51461009c578063d624fdb6146100bd578063f2b7afed146100f0578063f3c95c6014610163575b600080fd5b341561007457600080fd5b610088600160a060020a0360043516610196565b604051901515815260200160405180910390f35b34156100a757600080fd5b6100bb600160a060020a0360043516610231565b005b34156100c857600080fd5b610088600160a060020a0360043516610363565b604051901515815260200160405180910390f35b34156100fb57600080fd5b61008860048035600160a060020a03169060446024803590810190830135806020601f820181900481020160405190810160405281815292919060208401838380828437509496506103f395505050505050565b604051901515815260200160405180910390f35b341561016e57600080fd5b610088600160a060020a03600435166104d9565b604051901515815260200160405180910390f35b6000805433600160a060020a039081169116146101b257600080fd5b600160a060020a0382166000908152600860205260408120906101d5828261053a565b5060038101805460ff1916905560006004909101557f14e8b0701a0ce64781f7b3b6f908cacf59008ae7a2112e3bd11b5bcd1e5ef10682604051600160a060020a03909116815260200160405180910390a15060015b5b919050565b6000805433600160a060020a0390811691161461024d57600080fd5b610256826104d9565b1561035c575060005b600160a060020a03821660009081526008602052604090206004015481101561035c57600160a060020a03821660009081526008602052604090207f225186bab75fba659e34214506967f862b1fa6dcff4335714762bcd85e5080139082600381106102c757fe5b0160005b50604051602080825282546002600019610100600184161502019091160490820181905281906040820190849080156103455780601f1061031a57610100808354040283529160200191610345565b820191906000526020600020905b81548152906001019060200180831161032857829003601f168201915b50509250505060405180910390a15b60010161025f565b5b5b5b5050565b6000805433600160a060020a0390811691161461037f57600080fd5b600160a060020a038216600090815260086020526040902060030180546001919060ff191682805b02179055507f83938938672b119b6a597cb00c08e11e7c508110f1c49ef59f30ae4ab30f865d82604051600160a060020a03909116815260200160405180910390a15060015b5b919050565b600160a060020a038216600090815260086020526040812060048101548391906003811061041d57fe5b0160005b50908051610433929160200190610568565b50600160a060020a038316600090815260086020526040902060048101805460019081019091556003909101805460ff191682805b0217905550600160a060020a03831660009081526008602052604090819020600401547f33438763d426155c196efb01a0ffeeed8e4037d1c364437f33b8681cabdaaa0f9185919051600160a060020a03909216825260208201526040908101905180910390a15060015b92915050565b6000805433600160a060020a039081169116146104f557600080fd5b60015b600160a060020a03831660009081526008602052604090206003015460ff16600181111561052257fe5b14156105305750600161022b565b5060005b5b919050565b50600061054782826105e7565b50600101600061055782826105e7565b506105669060010160006105e7565b565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106105a957805160ff19168380011785556105d6565b828001600101855582156105d6579182015b828111156105d65782518255916020019190600101906105bb565b5b506105e392915061062f565b5090565b50805460018160011615610100020316600290046000825580601f1061060d575061062b565b601f01602090049060005260206000209081019061062b919061062f565b5b50565b61064d91905b808211156105e35760008155600101610635565b5090565b905600a165627a7a72305820ffdff4ed22a9db9be8dbef0fdf8e5ba5d566446ca6ee60a4f4f3927e762fcdfe0029',
    gas: '4300000'
  }, function(e, contract) {
    console.log(e);
    console.log(contract);
    if (typeof contract.address !== 'undefined') {
      console.log("Yo");
      eventEmitter.emit('deploySuccess', contract.address);
    }
  })
}

function submitKYC(i, account, KYChash) {
  console.log("SubmitKYC");
  var hashArr = str2bytearr(KYChash);
  var registry = registryContract.at(registryAddress);
  gasUsage = (registry.submitKYC.estimateGas(account, hashArr) < config.gasUsage) ? registry.submitKYC.estimateGas(account, hashArr) : config.gasUsage;
  registry.submitKYC.sendTransaction(account, hashArr, {
    gas: gasUsage,
    gasPrice: config.gasPrice,
    from: config.ethAddress
  }, function(err, result) {
    if (err) {
      console.error(err);
      return 'empty';
    }
    console.log("success");
    var myEvent = registry.LogSubmitted();
    myEvent.watch(function(err, res) {
      if (err) {
        console.error(err);
        return 'empty';
      }
      myEvent.stopWatching();
      /* Read the parameters from the event */
      userHashReturned = res.args.userHash;
      console.log('KYC Doc hash for', userHashReturned, 'is stored on Blockchain')
      eventEmitter.emit('txnSuccess', i);
    });
  });
}

function uploadDoc(address, sender, docName, docHash) {
  var order = orderContract.at(address);
  var hashArr2 = str2bytearr(docHash);
  console.log("Uploading Doc");
  gasUsage = (order.upload.estimateGas(sender, docName, hashArr2) < config.gasUsage) ? order.upload.estimateGas(sender, docName, hashArr2) : config.gasUsage;
  console.log(gasUsage);
  order.upload.sendTransaction(sender, docName, hashArr2, {
    gas: gasUsage,
    gasPrice: config.gasPrice,
    from: config.ethAddress
  }, function(err, result) {
    if (err) {
      console.error(err);
      return;
    }
    var myEvent = order.LogUpload();
    myEvent.watch(function(err, res) {
      if (err) {
        console.error(err);
        return;
      }
      console.log("Success");
      myEvent.stopWatching();
      /* Read the parameters from the event */
      var uploadedDocName = res.args.docName;
      eventEmitter.emit('docTxnSuccess', result);
    });
  });
}

function deployLOC(trade_id) {
  var loc = letterOfCreditContract.new({
    from: config.ethAddress,
    data: '0x6060604052341561000f57600080fd5b5b33600860006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505b5b6110ad806100626000396000f30060606040523615610097576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff1680631b9265b81461009c578063227d0291146100c9578063332616b314610145578063aa91ea4714610221578063ba446ae91461024e578063d0e30db014610263578063daea85c51461026d578063e54f83f4146102a6578063e81ab3ff1461034e575b600080fd5b34156100a757600080fd5b6100af61037b565b604051808215151515815260200191505060405180910390f35b34156100d457600080fd5b610143600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843782019150505050505091905050610596565b005b341561015057600080fd5b6101666004808035906020019091905050610722565b604051808581526020018481526020018060200183600481111561018657fe5b60ff16815260200182810382528481815460018160011615610100020316600290048152602001915080546001816001161561010002031660029004801561020f5780601f106101e45761010080835404028352916020019161020f565b820191906000526020600020905b8154815290600101906020018083116101f257829003601f168201915b50509550505050505060405180910390f35b341561022c57600080fd5b61023461075e565b604051808215151515815260200191505060405180910390f35b341561025957600080fd5b6102616108a0565b005b61026b610940565b005b341561027857600080fd5b6102a4600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091905050610a18565b005b34156102b157600080fd5b61034c600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803573ffffffffffffffffffffffffffffffffffffffff16906020019091908035906020019091908035906020019091905050610b73565b005b341561035957600080fd5b610361610f40565b604051808215151515815260200191505060405180910390f35b6000600860009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415156103d957600080fd5b60006005541415801561040d5750603c60096000600160075403815260200190815260200160002060000154026004540142115b801561043c5750603c600960006001600754038152602001908152602001600020600001540260045401600554105b1561052557600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166108fc600960006001600754038152602001908152602001600020600101549081150290604051600060405180830381858888f19350505050507f4db5a085745851523b55a9f7f93043cfd4c1d59a1a4848e393bc0d01d95fb2f06040518080602001828103825260048152602001807f547275650000000000000000000000000000000000000000000000000000000081525060200191505060405180910390a160019050610592565b7f4db5a085745851523b55a9f7f93043cfd4c1d59a1a4848e393bc0d01d95fb2f06040518080602001828103825260058152602001807f46616c736500000000000000000000000000000000000000000000000000000081525060200191505060405180910390a1600090505b5b90565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16148061063e5750600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16145b1561071857600460096000600160075403815260200190815260200160002060030160006101000a81548160ff0219169083600481111561067b57fe5b02179055508060096000600160075403815260200190815260200160002060020190805190602001906106af929190610fdc565b507fb9c19165559b04a56731cfaee3ca1bbada1580ba9eb21e95cb2bdf55c94bc89c82604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390a161071e565b600080fd5b5b5050565b600960205280600052604060002060009150905080600001549080600101549080600201908060030160009054906101000a900460ff16905084565b6000600860009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415156107bc57600080fd5b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166108fc600960006001600754038152602001908152602001600020600101549081150290604051600060405180830381858888f19350505050507f4db5a085745851523b55a9f7f93043cfd4c1d59a1a4848e393bc0d01d95fb2f06040518080602001828103825260048152602001807f547275650000000000000000000000000000000000000000000000000000000081525060200191505060405180910390a1600190505b5b90565b600860009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415156108fc57600080fd5b426005819055507feaf695929fec8154f0eafe7248c0e16855eb9ad09e623be92f669e544d53e8566005546040518082815260200191505060405180910390a15b5b565b600260009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614156109de57346006600082825403925050819055507ff641ad64267ca71156d13749ad746155df3095d9afeb604fe3b53016ce5fc8ba346040518082815260200191505060405180910390a15b7ff641ad64267ca71156d13749ad746155df3095d9afeb604fe3b53016ce5fc8ba346040518082815260200191505060405180910390a15b565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff161480610ac05750600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16145b15610b6a57600360096000600160075403815260200190815260200160002060030160006101000a81548160ff02191690836004811115610afd57fe5b02179055507f1d21a2aefa79cd2ac1e468605be84400dfc4e6d4cc5711f67c7abac80c85fd7781604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390a1610b70565b600080fd5b5b50565b600860009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141515610bcf57600080fd5b856000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055504260048190555084600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555083600260006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555082600360006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550816009600060075481526020019081526020016000206001018190555081600681905550600160096000600754815260200190815260200160002060030160006101000a81548160ff02191690836004811115610d3257fe5b021790555080600960006007548152602001908152602001600020600001819055507fc9ee3309319b207c80a4328dce12ca78f1ffcb96ab23b3daeeed29370aeb26c06000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff16600454600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16600260009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff166009600060075481526020019081526020016000206001015460096000600754815260200190815260200160002060000154604051808873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018781526020018673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200183815260200182815260200197505050505050505060405180910390a16007600081548092919060010191905055505b5b505050505050565b6000600860009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141515610f9e57600080fd5b7ff641ad64267ca71156d13749ad746155df3095d9afeb604fe3b53016ce5fc8ba6006546040518082815260200191505060405180910390a15b5b90565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061101d57805160ff191683800117855561104b565b8280016001018555821561104b579182015b8281111561104a57825182559160200191906001019061102f565b5b509050611058919061105c565b5090565b61107e91905b8082111561107a576000816000905550600101611062565b5090565b905600a165627a7a7230582061aa73808de64e4efe0cedda508bea06a7c4014a32e36362bf9c679226516afa0029',
    gas: '1500000',
    gasPrice: '4000000000'
  }, function(e, contract) {
    if (typeof contract.address !== 'undefined') {
      eventEmitter.emit('deploySuccess', contract.address, trade_id);
    }
  })
}

function locUpload(id, address, buyer, seller, buyerBank, sellerBank, creditAmount, timePeriod) {
  var loc = letterOfCreditContract.at(address);
  gasUsage = (loc.setup.estimateGas(buyer, seller, buyerBank, sellerBank, creditAmount, timePeriod) < config.gasUsage) ? loc.setup.estimateGas(buyer, seller, buyerBank, sellerBank, creditAmount, timePeriod) : config.gasUsage;
  loc.setup.sendTransaction(buyer, seller, buyerBank, sellerBank, creditAmount, timePeriod, {
    gas: gasUsage,
    gasPrice: config.gasPrice,
    from: config.ethAddress
  }, function(err, result) {
    if (err) {
      console.error(err);
      res.send(err);
      return;
    }
    var myEvent = loc.LogSetup();
    myEvent.watch(function(err, res) {
      if (err) {
        console.error(err);
        res.send(err);
        return;
      }
      myEvent.stopWatching();
      /* Read the parameters from the event */
      eventEmitter.emit('locTxnSuccess', res.args.time.c[0], id);
      payLOC(address, creditAmount);
    });
  });
}

function payLOC(address, creditAmount) {
  var loc = letterOfCreditContract.at(address);
  gasUsage = loc.deposit.estimateGas();
  web3.personal.unlockAccount('0xca2995b06cbda040c548b2bcba52d6d53960c186', 'Financer');
  loc.deposit.sendTransaction({
    gas: gasUsage,
    value: creditAmount + 2000000000,
    from: '0xca2995b06cbda040c548b2bcba52d6d53960c186'
  }, function(err, result) {
    if (err) {
      console.error(err);
      res.send(err);
      return;
    }
    var myEvent = loc.LogDeposit();
    myEvent.watch(function(err, res) {
      if (err) {
        console.error(err);
        res.send(err);
        return;
      }
      myEvent.stopWatching();
      /* Read the parameters from the event */
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

function payToSeller(address, id) {
  var loc = letterOfCreditContract.at(address);
  gasUsage = loc.pay.estimateGas();
  loc.pay.sendTransaction({
    gas: gasUsage,
    gasPrice: config.gasPrice,
    from: config.ethAddress
  }, function(err, result) {
    if (err) {
      console.error(err);
      res.send(err);
      return;
    }
    var myEvent = loc.LogPayment();
    myEvent.watch(function(err, res) {
      if (err) {
        console.error(err);
        res.send(err);
        return;
      }
      myEvent.stopWatching();
      /* Read the parameters from the event */
      if (res.args.s == "True") eventEmitter.emit('paymentSuccess', 'Payment Successful', id);
      if (res.args.s == "False") eventEmitter.emit('paymentSuccess', 'Payment Declined', id);
    });
  });
}

function checkAdminEntry(req, res, next) {
  if (req.session.adminpass == "nishvish") {
    next();
  } else {
    res.redirect('/');
  }
}

function onFindUser(err, user) {
  user.local.kychash.push(hash[0].hash);
  user.save(function(err) {
    if (err)
      throw err;
    console.log('Generated IPFS Hash stored on MONGO DB');
  });
  eventEmitter.emit('connection' + i, i, user.local.userHash, hash[0].hash);
}

function onFindUser2(err, user) {
  // if there are any errs, return the err
  if (err)
    return err;
  req = this.req;
  res = this.res;
  // check to see if theres already a user with that username
  if (user) {
    req.session.message = "User Already Exists!!!";
    res.redirect('/signup');
  } else {
    // if there is no user with that username
    // create the user
    var password = req.body.password;
    var role = req.body.role;
    var newUser = new User();
    // set the user's local credentials
    var account = web3.personal.newAccount(password);
    newUser.local.username = username;
    newUser.local.password = newUser.generateHash(password);
    newUser.local.role = role;
    newUser.local.userHash = account;
    newUser.local.kychash[i] = hash;
    newUser.save(function(err) {
      if (err)
        throw err;
      if (i == 0) eventEmitter.emit('connection0', i, account, hash);
      req.session.userId = newUser._id;
      res.redirect('/profile');
    });
  }
}

function onFindTradeQuotationUpload(err, trade) {
  // if there are any errs, return the err
  if (err)
    return done(err);
  req = this.req;
  res = this.res;
  trade.quotation.hash = hash[0].hash;
  trade.status = "Quotation Uploaded; Ethereum Txn Pending;";
  trade.save(function(err) {
    if (err)
      throw err;
    return;
  });
  req.session.tradesession = trade._id;
  req.session.sender = "Seller";
  res.redirect('/tradesession');
  eventEmitter.once('ConnectionuploadDoc', function() {
    uploadDoc(trade.contract_id, sellerHash, 'Quotation', hash[0].hash);
  });
  eventEmitter.once('docTxnSuccess', function(txnID) {
    trade.status = "Quotation Uploaded";
    trade.quotation.txnID = txnID;
    trade.save(function(err) {
      if (err)
        throw err;
      return;
    });
  });
  eventEmitter.once('CheckSeller', function() {

    User.findOne({
      'local.username': trade.seller_id
    }, function(err, usr) {
      if (err)
        return done(err);
      sellerHash = usr.local.userHash;
      eventEmitter.emit('ConnectionuploadDoc');

    });
  });
  eventEmitter.emit('CheckSeller');
  //new changes
}

function onFindTradePOUpload(err, trade) {
  // if there are any errs, return the err
  if (err)
    return done(err);
  req = this.req;
  res = this.res;
  trade.po.hash = hash[0].hash;
  //
  trade.status = "Purchase Order Uploaded; Ethereum Txn Pending;";
  trade.save(function(err) {
    if (err)
      throw err;
    return;
  });
  req.session.tradesession = trade._id;
  req.session.sender = "Buyer";
  res.redirect('/tradesession');
  //new changes
  eventEmitter.once('ConnectionuploadDoc', function() {
    uploadDoc(trade.contract_id, buyerHash, 'PurchaseOrder', hash[0].hash);
  });
  eventEmitter.once('docTxnSuccess', function(txnID) {
    trade.po.txnID = txnID;
    trade.status = "Purchase Order Uploaded";
    trade.save(function(err) {
      if (err)
        throw err;
      return;
    });
  });
  eventEmitter.once('CheckBuyer', function() {
    User.findOne({
      'local.username': trade.buyer_id
    }, function(err, usr) {
      if (err)
        return done(err);
      buyerHash = usr.local.userHash;
      eventEmitter.emit('ConnectionuploadDoc');

    });
  });
  eventEmitter.emit('CheckBuyer');
}

function onFindTradeInvoiceUpload(err, trade) {
  // if there are any errs, return the err
  if (err)
    return done(err);
  req = this.req;
  res = this.res;
  trade.invoice.hash = hash[0].hash;
  //
  trade.status = "Invoice Uploaded; Ethereum Txn Pending;";
  trade.save(function(err) {
    if (err)
      throw err;
    return;
  });
  req.session.tradesession = trade._id;
  req.session.sender = "Seller";
  res.redirect('/tradesession');
  //new changes
  eventEmitter.once('ConnectionuploadDoc', function() {
    uploadDoc(trade.contract_id, sellerHash, 'Invoice', hash[0].hash);
  });
  eventEmitter.once('docTxnSuccess', function(txnID) {
    trade.invoice.txnID = txnID;
    console.log('File Uploaded', trade.status);
    trade.status = "Invoice Uploaded";
    trade.save(function(err) {
      if (err)
        throw err;
      return;
    });
  });
  eventEmitter.once('CheckSeller', function() {
    User.findOne({
      'local.username': trade.seller_id
    }, function(err, usr) {
      if (err)
        return done(err);
      sellerHash = usr.local.userHash;
      eventEmitter.emit('ConnectionuploadDoc');

    });
  });
  eventEmitter.emit('CheckSeller');
}

function onFindTradeLOCUpload(err, trade) {
  // if there are any errs, return the err
  if (err)
    return done(err);
  req = this.req;
  res = this.res;
  trade.letterofcredit = hash[0].hash;
  trade.status = "Letter Of Credit Uploaded";
  trade.save(function(err) {
    if (err)
      throw err;
    return;
  });
  req.session.tradesession = trade._id;
  req.session.sender = "Bank";
  res.redirect('/tradesession');
}

function onFindTradeBOLUpload(err, trade) {
  // if there are any errs, return the err
  if (err)
    return done(err);
  req = this.req;
  res = this.res;
  trade.billoflading.hash = hash[0].hash;
  trade.status = "Bill Of Lading Uploaded; Ethereum Txn Pending;";
  trade.save(function(err) {
    if (err)
      throw err;
    return;
  });
  req.session.tradesession = trade._id;
  req.session.sender = "Shipper";
  res.redirect('/tradesession');
  eventEmitter.once('ConnectionuploadDoc', function() {
    uploadDoc(trade.contract_id, shipperHash, 'BillOfLading', hash[0].hash);
  });
  eventEmitter.once('docTxnSuccess', function(txnID) {
    trade.billoflading.txnID = txnID;
    trade.status = "Bill Of Lading Uploaded";
    trade.save(function(err) {
      if (err)
        throw err;
      return;
    });
  });
  eventEmitter.once('CheckShipper', function() {
    User.findOne({
      'local.username': trade.shipper_id
    }, function(err, usr) {
      if (err)
        return done(err);
      shipperHash = usr.local.userHash;
      eventEmitter.emit('ConnectionuploadDoc');

    });
  });
  eventEmitter.emit('CheckShipper');
  //eventEmitter.emit('ConnectionuploadDoc');
  //new changes
}

function onFindTradeDocDownload(err, trade) {
  // if there are any errs, return the err
  if (err)
    return done(err);
  req = this.req;
  res = this.res;
  switch (req.body.docname) {
    case "quotation":
      docHash = trade.quotation.hash;
      break;
    case "po":
      docHash = trade.po.hash;
      break;
    case "invoice":
      docHash = trade.invoice.hash;
      break;
    case "billoflading":
      docHash = trade.billoflading.hash;
      break;
  }
  console.log('Hash of ', req.body.docname, ': ', docHash);
  ipfs.get(docHash, function(err, stream) {
    if (err) {
      throw err;
    }
    res.writeHead(200, {
      'Content-Disposition': 'attachment'
    });
    stream.on('data', (file) => {
      // write the file's path and contents to standard out
      console.log('Sending res from IPFS to client');
      file.content.pipe(res);
    });
  });
}

function onFindTradeDocDownload2(err, trade) {
  // if there are any errs, return the err
  if (err)
    return done(err);
  contractAddress = trade.contract_id;
  eventEmitter.emit('getLatestDoc', contractAddress);
}

function onFindTradeConnection(err, trade) {
  trade.letterofcredit.contract_id = address;
  trade.letterofcredit.No_of_days = timePeriod;
  trade.letterofcredit.Credit_Amount = creditAmount;
  trade.save(function(err) {
    if (err)
      throw err;
  });

  locUpload(id, address, buyerHash, sellerHash, buyerBankHash, sellerBankHash, creditAmount, timePeriod);
}

function onFindTradeDeploySuccess(err, trade) {
  //trade.status = "Letter Of Credit Uploaded";
  trade.letterofcredit.contract_id = address;
  trade.save(function(err) {
    if (err)
      throw err;
  });
}
