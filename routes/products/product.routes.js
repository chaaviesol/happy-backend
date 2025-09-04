const express = require("express");
const {
  manageBrand,
  viewbrands,
  productmgmt,
  getspec,
  tagParentProduct,
  type_prodlist,
  getProductList,
  updatedProduct,
  getProductDetails,
  getCategories,
  addCategories,
  categoryMasterview,
  updateSpecs,
  manageCategories,
  deleteproduct,
  productapprove,
  productapprovelist,
  productadd,
  prod_typelist,
  productvarient,
  uploadFile,
  importProductMaster,
  importFromLocalExcel,
} = require("./product.controller");
const multer = require("multer");
const auth = require("../../middleware/Auth/auth");
const {
  upload,
  multipartUpload,
  compressImage,
} = require("../../middleware/Image/Uploadimage");
const productrouter = express.Router();
// Set up multer


productrouter.get("/importFromLocalExcel", importFromLocalExcel);

productrouter.post(
  "/productmgmt",
  upload.array("image"),
  compressImage,
  productmgmt
);

productrouter.route("/brand").post(manageBrand);
productrouter.route("/viewBrands").post(viewbrands);

productrouter.route("/update").post(updatedProduct);
productrouter.route("/productlist").post(getProductList);
productrouter.route("/proddetails").post(getProductDetails);
productrouter.route("/categorymaster").post(categoryMasterview);
productrouter.route("/categories").post(getCategories);
productrouter.route("/addCategories").post(addCategories);
productrouter.route("/specupdate").post(updateSpecs);
productrouter.route("/managecategories").post(manageCategories);
productrouter.route("/deleteprod").post(deleteproduct);
productrouter.route("/getspec").post(getspec);
productrouter.route("/tagparent").post(tagParentProduct);
productrouter.route("/upload").post(uploadFile);

///////////////supplier/////////////////////////////

productrouter.route("/productapprovelist").get(productapprovelist);
productrouter.route("/productapprove").post(productapprove);
productrouter.route("/productadd").post(productadd);
productrouter.route("/prodlist").post(type_prodlist);
productrouter.route("/typelist").post(prod_typelist);

productrouter.route("/varient").post(productvarient);

module.exports = productrouter;
