const express = require("express");
const {
  goodsReceipt,
  cancel_purchaseorder,
  closed_purchasedetails,
} = require("./po.controller");

const poRouter = express.Router();

poRouter.post("/", goodsReceipt);
poRouter.post("/cancel_po", cancel_purchaseorder);
poRouter.post("/closed_purchasedetails", closed_purchasedetails);

module.exports = poRouter;
