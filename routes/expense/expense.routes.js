const express = require("express");
const {
  addCategory,
  viewCategory,
  addexpense,
  getexpenses
} = require("./expense.controller");

const expenseRouter = express.Router();

expenseRouter.route("/addcategory").post(addCategory);
expenseRouter.route("/viewcategory").get(viewCategory);
expenseRouter.route("/addexpense").post(addexpense);
expenseRouter.route("/getexpenses").get(getexpenses)

module.exports = expenseRouter;
