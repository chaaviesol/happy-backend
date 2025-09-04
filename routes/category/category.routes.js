const express=require('express');
const { viewCategory, viewSubCatAndSpecs, viewSpecValues, addCategory, addSubCategory ,addSpec,manageSpecvalue,deleteCategory,deleteSpecs,Categorymaster} = require('./category.controller');

const categoryRouter=express.Router()

categoryRouter.route('/').post(viewCategory)
categoryRouter.route('/addcategory').post(addCategory)
categoryRouter.route('/subspec').post(viewSubCatAndSpecs)
categoryRouter.route('/viewspec').post(viewSpecValues)
categoryRouter.route('/addsubcat').post(addSubCategory)
categoryRouter.route('/addspec').post(addSpec)
categoryRouter.route('/managespec').post(manageSpecvalue)
categoryRouter.route('/deletecate').post(deleteCategory)
categoryRouter.route('/deletespec').post(deleteSpecs)
categoryRouter.route('/categorymasterview').post(Categorymaster)




module.exports=categoryRouter;