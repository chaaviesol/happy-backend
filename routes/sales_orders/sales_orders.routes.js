const express = require('express')
const { fitting, packing,fitted ,packed,dispatch,dispatched, dispatched_list,history} = require('./sales_orders.controller')
const auth = require('../../middleware/Auth/auth')
const salesordersRouter = express.Router()


///////////////////////
salesordersRouter.route('/fitting',auth).get(fitting)
salesordersRouter.route('/fitted').post(fitted)
salesordersRouter.route('/packing').get(packing)
salesordersRouter.route('/packed').post(packed)
salesordersRouter.route('/dispatch').get(dispatch)
salesordersRouter.route('/dispatched').post(dispatched)
salesordersRouter.route('/dispatched_list').get(dispatched_list)
salesordersRouter.route('/history').post(history)









module.exports = salesordersRouter