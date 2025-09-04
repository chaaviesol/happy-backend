const express = require("express");
const { createprofit, viewprofit_distribution, getLastSettledDate,account_details, addsettle, settled_view } = require("./profit.controller");
const auth = require('../../middleware/Auth/auth')
const profitrouter = express.Router()


profitrouter.route('/createprofit').post(createprofit)
profitrouter.route('/viewdistribution').get(viewprofit_distribution)
profitrouter.route('/getlastsettledon').get(getLastSettledDate)
profitrouter.route('/account_details').post(account_details)
profitrouter.route('/addsettle').post(addsettle) 
profitrouter.route('/settledview').post(settled_view)

module.exports = profitrouter