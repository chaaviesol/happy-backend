const express = require("express");
const {
  addCategory,
  viewCategory,
  addexpense,
  getexpenses,
  updatepayment,
} = require("./expense.controller");

const expenseRouter = express.Router();

expenseRouter.route("/addcategory").post(addCategory);
expenseRouter.route("/viewcategory").get(viewCategory);
expenseRouter.route("/addexpense").post(addexpense);
expenseRouter.route("/getexpenses").get(getexpenses);
expenseRouter.route("/updatepayment").post(updatepayment);

module.exports = expenseRouter;
