const express = require("express");
const { po_payment, po_paymentlist, po_paymentdetails, so_payment, so_paymentdetails, sodirect_payment } = require("./payment.controller");
const paymentRouter = express.Router()

paymentRouter.route('/po_payment').post(po_payment)
paymentRouter.route('/paymentlist').post(po_paymentlist)
paymentRouter.route('/po_paymentdetails').post(po_paymentdetails)

///////////////////////////////
paymentRouter.route('/so_payment').post(so_payment)
paymentRouter.route('/so_paymentdetails').post(so_paymentdetails)
paymentRouter.route('/sodirect_payment').post(sodirect_payment)

module.exports = paymentRouter  