const express=require('express');
const { managelogistics, viewlogistics, viewSupplierandLogistics } = require('./logistics.controller');

const logisticsRouter=express.Router()


logisticsRouter.post('/managelogistics',managelogistics)
logisticsRouter.post('/viewlogistics',viewlogistics)///////n
logisticsRouter.post('/suppliersandlogistics',viewSupplierandLogistics)





module.exports=logisticsRouter;