const express = require("express");
require("dotenv").config();
const PORT = process.env.PORT;
const HOST = process.env.HOST;
const userRouter = require("./routes/users/users.routes");
const server = express();
var bodyParser = require("body-parser");
const logisticsRouter = require("./routes/logistics/logistics.routes");
const cors = require("cors");
const productrouter = require("./routes/products/product.routes");
const helmet = require("helmet");
const purchaseRoutes = require("./routes/purchase/purchase.routes");
const categoryRouter = require("./routes/category/category.routes");
const customerRouter = require("./routes/customer/customer.routes");
const poRouter = require("./routes/Goodsreceipt/po.routes");
const inventoryRouter = require("./routes/inventory/inventory.routes");
const salesRouter = require("./routes/sales/sales.routes");
const staffRouter = require("./routes/staff/staff.routes");
const paymentRouter = require("./routes/payment/payment.routes");
const orderRouter = require("./routes/past_orders/orders.routes");
const notificationRouter = require("./routes/notification/notification.routes");
const authRouter = require("./routes/Auth/authRouters");
const auth = require("./middleware/Auth/auth");
const useraccessRouter = require("./routes/user_access/user_access.routes");
const salesordersRouter = require("./routes/sales_orders/sales_orders.routes");
const campaignRouter = require("./routes/campaign/campaign.routes");
const profitrouter = require("./routes/profit/profit.routes");

server.use(
  cors({
    origin: "*",
    allowedHeaders: "X-Requested-With,Content-Type,auth-token,Authorization",
    credentials: true,
  })
);

server.use(express.json());

server.use(express.static("./public"));
server.use(express.urlencoded({ extended: true }));
server.use(bodyParser.json());
server.use("/customer", auth, customerRouter);
server.use("/category", auth, categoryRouter);
server.use("/user", userRouter);
server.use("/logistics", auth, logisticsRouter);
server.use("/product", auth, productrouter);
server.use("/purchase", auth, purchaseRoutes);
server.use("/goodsreceipt", auth, poRouter);
server.use("/inventory",auth, inventoryRouter);
server.use("/sales", auth, salesRouter);
server.use("/staff", auth, staffRouter);
server.use("/payment", auth, paymentRouter);
server.use("/order", auth, orderRouter);
server.use("/notification", auth, notificationRouter);
server.use("/auth", authRouter);
server.use("/useraccess", auth, useraccessRouter);
server.use("/salesorders", auth, salesordersRouter);
server.use("/campaign", auth, campaignRouter);
server.use("/profit", auth, profitrouter);
server.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

if (process.env.NODE_ENV === "development") {
  server.listen(PORT, () => {
    console.log(`server started at ${HOST}:${PORT}`);
  });
}
