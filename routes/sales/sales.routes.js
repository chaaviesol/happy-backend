const express = require("express");
const { newsalesOrder, salesOrders,viewcustomers,viewaccessories,productsale_list,getsalesProductDetails ,viewquotation,sendquotation, placed_details,quoted_details,quoted_salesorder,cus_quotation_response,respond_details,confirm_salesorder, placed,order_fulfilled, closed_salesorder,update_salesorder} = require("./sales.controller");

const salesRouter=express.Router()


salesRouter.route('/newsales').post(newsalesOrder)
salesRouter.route('/solist').post(salesOrders)//opt
salesRouter.route('/viewcustomers').post(viewcustomers)
salesRouter.route('/viewaccessories').get(viewaccessories)
salesRouter.route('/product_list').post(productsale_list)
salesRouter.route('/productdetails').post(getsalesProductDetails)
salesRouter.route('/viewquotation').get(viewquotation)
salesRouter.route('/sendquotation').post(sendquotation)
salesRouter.route('/quoted_details').post(quoted_details)
salesRouter.route('/quoted_salesorder').post(quoted_salesorder)
salesRouter.route('/quotation_response').post(cus_quotation_response)
salesRouter.route('/respond_details').post(respond_details)
salesRouter.route('/confirm_salesorder').post(confirm_salesorder)
salesRouter.route('/placed_details').post(placed_details)
salesRouter.route('/placed').post(placed)
salesRouter.route('/closed_salesorder').post(closed_salesorder)
salesRouter.route('/order_fulfilled').get(order_fulfilled)
salesRouter.route('/update_salesorder').post(update_salesorder)//so_draft


module.exports=salesRouter  