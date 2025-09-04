const express = require("express");
const {
  viewInventory,
  generateBarcode,
  scanBarcode,
} = require("./inventory.controller");
const inventoryRouter = express.Router();

inventoryRouter.post("/", viewInventory);
inventoryRouter.post("/generatebarcode", generateBarcode);
inventoryRouter.post("/scanBarcode", scanBarcode);
module.exports = inventoryRouter;
