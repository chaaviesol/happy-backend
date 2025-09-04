const express=require('express');
const { createcampaign,getcampaign,singlecampaign,allproducts,single_product,getDiscountByCoupon} = require('./campaign.controller');

const campaignRouter=express.Router()

campaignRouter.route('/createcampaign').post(createcampaign)
campaignRouter.route('/getcampaign').get(getcampaign)
campaignRouter.route('/singlecampaign').post(singlecampaign)
campaignRouter.route('/allproducts').get(allproducts)
campaignRouter.route('/singleproduct').post(single_product)
campaignRouter.route('/getdiscount').post(getDiscountByCoupon)





module.exports=campaignRouter