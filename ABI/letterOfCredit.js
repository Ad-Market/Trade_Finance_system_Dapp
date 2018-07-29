letterOfCreditABI = [{"constant":false,"inputs":[],"name":"pay","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"sender","type":"address"},{"name":"reason","type":"string"}],"name":"reject","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"locdir","outputs":[{"name":"noOfDays","type":"uint256"},{"name":"creditAmount","type":"uint256"},{"name":"reason","type":"string"},{"name":"status","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"onRequestPay","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"shipped","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"deposit","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"sender","type":"address"}],"name":"approve","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_buyer","type":"address"},{"name":"_seller","type":"address"},{"name":"_buyerBank","type":"address"},{"name":"_sellerBank","type":"address"},{"name":"_invoiceAmount","type":"uint256"},{"name":"_noOfDays","type":"uint256"}],"name":"setup","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"getPendingAmount","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_buyer","type":"address"},{"indexed":false,"name":"time","type":"uint256"},{"indexed":false,"name":"_seller","type":"address"},{"indexed":false,"name":"_buyerBank","type":"address"},{"indexed":false,"name":"_sellerBank","type":"address"},{"indexed":false,"name":"_invoiceAmount","type":"uint256"},{"indexed":false,"name":"_noOfDays","type":"uint256"}],"name":"LogSetup","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"date","type":"uint256"}],"name":"LogShipped","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"s","type":"string"}],"name":"LogPayment","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"sender","type":"address"}],"name":"LogApprove","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"sender","type":"address"}],"name":"LogReject","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"s","type":"uint256"}],"name":"LogDeposit","type":"event"}];