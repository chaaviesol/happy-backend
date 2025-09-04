const express = require("express");
const {
  newPurchaseOrder,
  purchaseOrders,
  purchaselist,
  update_purchaseorder,
} = require("./purchase.controller");
const auth = require("../../middleware/Auth/auth");
const {
  upload,
  multipartUpload,
} = require("../../middleware/Image/Uploadfile.js");
const purchaseRoutes = express.Router();

purchaseRoutes.post("/newpurchase", upload.array("image"), newPurchaseOrder);
purchaseRoutes.route("/polist").post(purchaseOrders);
purchaseRoutes.route("/purchaselist").post(purchaselist);
purchaseRoutes.route("/update_po").post(update_purchaseorder);

module.exports = purchaseRoutes;
