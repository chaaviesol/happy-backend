const express=require('express');
const {customerWishList,getCustomerWishList ,removeFromWishList ,addToCart,getCart,removeFromCart,profile,profileedit,removecartitems}= require('./customer.controller');

const customerRouter=express.Router()

customerRouter.post('/wishlist',customerWishList)
customerRouter.get("/getwishlist",getCustomerWishList);
customerRouter.post("/removewishlist",removeFromWishList);
customerRouter.post("/addtocart",addToCart);
customerRouter.get("/getcart",getCart);
customerRouter.post("/removefromcart",removeFromCart);
customerRouter.post('/customerprofile',profile)
customerRouter.post('/customerprofileedit',profileedit)
customerRouter.post('/removecartitems',removecartitems)

module.exports=customerRouter;