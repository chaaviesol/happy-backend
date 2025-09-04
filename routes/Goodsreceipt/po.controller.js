const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const winston = require('winston');
const fs = require('fs');
const { error } = require("console");

// Create a logs directory if it doesn't exist
const logDirectory = './logs';
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory);
}

// Configure the Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: `${logDirectory}/error.log`, level: 'error' }),
    new winston.transports.File({ filename: `${logDirectory}/combined.log` }),
  ],
});

const currentDate = new Date();
const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
const istDate = new Date(currentDate.getTime() + istOffset);



const goodsReceipt = async (req, res) => {
  console.log("requesttt", req.body);
  const usertype = req.user.userType;
  const logged_id = req.user.id;
  const po_num = req.body.po;
  const { received, lr_num, logistics_cost, handling_cost, type } = req.body;
  const modified_by = req.body.user;
  const u_date = istDate;

  if (usertype === "ADM" || usertype === "SU") {
    if (!po_num || !received || received.length === 0 || !lr_num || !logistics_cost || !handling_cost || !modified_by || !type) {
      res.status(400).json({
        error: true,
        message: "invalid body!!!",
      });
      return;
    }

    try {
      await prisma.$transaction(async (prisma) => {
        const purchaseList = await prisma.purchase_list.findMany({
          where: { po_num: po_num },
        });

        if (!purchaseList || purchaseList.length === 0) {
          throw new Error("Purchase list not found!");
        }

        const updatePurchaseList = async () => {
          const update_Pl_Queries = purchaseList.map(async (val) => {
            const matchedElem = received.find((item) => val.product_id === item.product_id);
            if (matchedElem) {
              const updatedRecQty = val.received_qty + matchedElem.received_qty;
              // if (updatedRecQty > val.order_qty) {
              //   throw new Error("Received quantity exceeds order quantity");
              // }

              await prisma.purchase_list.updateMany({
                where: {
                  po_num: po_num,
                  product_id: matchedElem.product_id,
                },
                data: {
                  received_qty: updatedRecQty,
                  modified_by: logged_id.toString(),
                  modified_date: istDate,
                  pricing_unit: matchedElem.pricing_unit,
                },
              });
            }
          });
          await Promise.all(update_Pl_Queries);
        };
        await updatePurchaseList();

        const updatedPurchaseList = await prisma.purchase_list.findMany({
          where: { po_num: po_num },
        });

        if (!updatedPurchaseList || updatedPurchaseList.length === 0) {
          throw new Error("Updated purchase list not found!");
        }

        const isAllClosed = updatedPurchaseList.every((val) => val.order_qty === val.received_qty);
        const status = isAllClosed ? "closed" : "receipt_wip";

        await prisma.purchase_order.updateMany({
          where: { po_number: po_num },
          data: {
            po_status: status,
            updated_by: logged_id.toString(),
            updated_date: u_date,
          },
        });

        let gr_pr_pl_arr = [];
        let inventory_data_arr = [];
        let total_inv = 0;
        const charges = {
          handling_cost: handling_cost,
          logistics_cost: logistics_cost,
        };
        const total_charge = parseInt(handling_cost) + parseInt(logistics_cost);

        for (let i = 0; i < received.length; i++) {
          if (received[i].invoice_amt) {
            total_inv += received[i].invoice_amt;
          }
        }

        const insertGrQueries = received.map(async (value) => {
          if (value.received_qty) {
            const p_cost = (total_charge * value.invoice_amt) / total_inv;
            const landing_price = parseInt(p_cost + value.invoice_amt);
            const unit_landing_price = landing_price / value.received_qty;
            const basePrice = parseInt(value.rate);
            const mrp = parseInt(value.mrp);
            const selling_price = Math.ceil(unit_landing_price * 1.1);
            let gr_batch_num = type === "bikes" ? "BK6456" : "TY4567";

            const createdGr = await prisma.goods_receipt.create({
              data: {
                created_date: u_date,
                purchase_order: po_num,
                created_by: logged_id.toString(),
                updated_date: istDate,
                lr_num: lr_num,
                batch_num: gr_batch_num,
                charges: charges,
                selling_price: selling_price,
                base_price: basePrice,
                mrp: mrp,
                product_id: value.product_id,
              },
            });

            const gr_pl_data = {
              gr_id: createdGr.goods_id,
              product_id: value.product_id,
              received_qty: value.received_qty,
              base_price: basePrice,
              landing_price: landing_price,
              max_retail_price: mrp,
            };

            gr_pr_pl_arr.push(gr_pl_data);

            const inventory_data = {
              prod_id: value.product_id,
              batch_id: createdGr.batch_num,
              received_qty: value.received_qty,
              mrp: parseInt(value.mrp),
              selling_price: selling_price,
              base_price: basePrice,
              charges: charges,
            };
            inventory_data_arr.push(inventory_data);
          }
        });

        await Promise.all(insertGrQueries);

        const gr_list_data = gr_pr_pl_arr.map((val) => ({
          gr_id: val.gr_id,
          product_id: val.product_id,
          received_qty: val.received_qty,
          created_by: logged_id.toString(),
          created_on: u_date,
          base_price: val.base_price,
          landing_price: val.landing_price,
          max_retail_price: val.max_retail_price,
        }));

        await prisma.gr_product_list.createMany({
          data: gr_list_data,
          skipDuplicates: true,
        });

        const insertInventoryQueries = inventory_data_arr.map((el) => prisma.inventory.create({
          data: {
            prod_id: el.prod_id,
            batch_id: el.batch_id,
            created_by: logged_id.toString(),
            created_date: istDate,
            po_num: po_num,
            base_price: el.base_price,
            selling_price: el.selling_price,
            mrp: el.mrp,
            charges: el.charges,
            total_quantity: el.received_qty,
          },
        }));

        await Promise.all(insertInventoryQueries);

        res.status(201).json({
          success: true,
          message: "Inventory updated",
        });

        const notification_text = `The purchase order ${po_num} has ${status} successfully`;
        const supplier = await prisma.purchase_order.findUnique({
          where: { po_number: po_num },
          select: { users: true },
        });

        await prisma.cus_notification.create({
          data: {
            text: notification_text,
            receiver: supplier.users.id,
            read: "N",
            type: "PO",
            created_date: istDate,
            verification_id: po_num,
            created_by: logged_id,
          },
        });
      });
    } catch (error) {
      logger.error(`Transaction failed in goodsReceipt API: ${error.message}`);
      res.status(500).json({
        error: true,
        message: "Transaction failed",
      });
    }finally {
      await prisma.$disconnect();
    }
  } else {
    logger.error(`Unauthorized in goodsReceipt API`);
    res.status(403).json({ message: "Unauthorized. You are not an admin" });
  }
};



const cancel_purchaseorder = async (request, response) => {
  const usertype = request.user.userType
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const po_num = request.body.po_num
      const po_status = request.body.po_status
      const confirm = await prisma.purchase_order.update({
        where: {
          po_number: po_num
        },
        data: {
          po_status: po_status
        }
      })
      const respText = `purchase order ${po_status} successfully`;
      response.status(201).json({
        success: true,
        message: respText,
      });
    }
    else {
      logger.error(`Unauthorized- in cancel_purchaseorder api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }

  }
  catch (error) {
    logger.error(`Error querying purchase list in cancel_purchaseorder api`)
  }finally {
    await prisma.$disconnect();
  }
}


module.exports = { goodsReceipt, cancel_purchaseorder }