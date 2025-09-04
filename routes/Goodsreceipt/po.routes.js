const express=require('express');
const { goodsReceipt ,cancel_purchaseorder} = require('./po.controller');

const poRouter=express.Router()



poRouter.post("/",goodsReceipt);
poRouter.post('/cancel_po',cancel_purchaseorder)



module.exports=poRouter;  