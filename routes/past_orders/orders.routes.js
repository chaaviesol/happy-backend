const express = require("express");
const { servicerequest ,sales_listorders,service_reqlist,service_requestdetails, customer_servicereqlist,return_request,customer_returnreq,return_accept,req_confirm,refund_amt,wallet} = require("./orders.controller");
const orderRouter=express.Router()


orderRouter.route('/servicerequest').post(servicerequest)//create sr
orderRouter.route('/sales_list').post(sales_listorders)
orderRouter.route('/service_reqlist').post(service_reqlist)//requtlist
orderRouter.route('/cus_servicereq').post(customer_servicereqlist)//servicereqlist based on customer
orderRouter.route('/return_request').post(return_request)//create rt
orderRouter.route('/cus_return_request').post(customer_returnreq)//rtreqlist based on customer
orderRouter.route('/service_requestdetails').post(service_requestdetails)//singledetailss
orderRouter.route('/request_confirm').post(req_confirm)//////confirm/reject
orderRouter.route('/return_accept').post(return_accept)
orderRouter.route('/refund').post(refund_amt)
orderRouter.route('/wallet').post(wallet)

module.exports=orderRouter