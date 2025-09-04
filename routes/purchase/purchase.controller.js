const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const winston = require("winston");
const fs = require("fs");

// Create a logs directory if it doesn't exist
const logDirectory = "./logs";
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory);
}

// Configure the Winston logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: `${logDirectory}/error.log`,
      level: "error",
    }),
    new winston.transports.File({ filename: `${logDirectory}/combined.log` }),
  ],
});

const newPurchaseOrder = async (request, response) => {
  const usertype = request.user.userType;
  console.log("request data is newpurchase>", JSON.parse(request.body.data));
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const data = JSON.parse(request.body.data);
      const product_imageLink = request.files;

      let po_file = {};

      for (let i = 0; i < product_imageLink?.length; i++) {
        let keyName = `image${i + 1}`;
        const file = product_imageLink[i];
        if (file.size > 1024 * 1024 * 1) {
          // If file is larger than 5 MB
          const fileUrl = file.location; // S3 URL
          const buffer = await downloadFileFromS3(fileUrl);
          const s3Key = `${Date.now()}-${file.originalname}`;
          const contentType = file.mimetype;
          const uploadResult = await multipartUpload(
            buffer,
            s3Key,
            contentType
          );
          po_file[keyName] = uploadResult.Location;
        } else {
          po_file[keyName] = file.location;
        }
      }

      const sup_name = data.trade_name;
      if (sup_name) {
        const user = await prisma.users.findFirst({
          where: {
            trade_name: sup_name,
          },
          select: {
            id: true,
            user_id: true,
            sup_code: true,
          },
        });

        if (!user) {
          response.status(404).json({ error: "Supplier not found" });
          return;
        }

        const { user_id, sup_code } = user;
        const sup_code_lower = sup_code?.substring(0, 4).toLowerCase();
        const today = new Date();
        const po_num = sup_code_lower?.toUpperCase() + today.getFullYear();

        const existingPurchaseOrders = await prisma.purchase_order.findMany({
          where: { supplier_id: user_id },
        });

        const newid = existingPurchaseOrders.length + 1;
        const formattedNewId = ("0000" + newid).slice(-4);
        const po_number = po_num + formattedNewId;

        const logistics = await prisma.logistics_master.findFirst({
          where: {
            logistics_name: data?.logistics_name,
          },
          select: {
            logistics_id: true,
          },
        });
        const logistics_id = logistics.logistics_id;
        const total_amt = data?.total;
        const quotation_link = data?.doclink;
        const po_status = data?.postatus;
        const remarks = data?.remarks;
        const created_by = data?.user;
        const po_notes = po_file;
        const prod_list = data?.products;
        const prod_name_array = prod_list.map((prod) => prod.prod_id);
        const products = await prisma.product_master.findMany({
          where: {
            product_id: { in: prod_name_array },
          },
          select: {
            product_id: true,
            product_name: true,
          },
        });

        const prod_final_array = prod_list.map((prod) => {
          const matchedProduct = products.find(
            (p) => p.product_id === prod.prod_id
          );

          return {
            prod_id: matchedProduct.product_id,
            qty: prod.qty,
            amt: prod.amt,
            receivedqty: 0,
            pricing_unit: prod.pricing_unit,
            // pendingqty: prod.qty,
            // pendingqty:pending_qty
          };
        });

        await prisma.purchase_order.create({
          data: {
            po_number: po_number,
            total_amount: total_amt,
            quote_document_link1: quotation_link,
            po_status,
            remarks,
            created_by,
            created_date: today,
            updated_date: today,
            supplier_id: user_id,
            logistics_id,
            po_notes,
          },
        });

        // Create rows in the purchase_list table for each product in the products array
        await Promise.all(
          prod_final_array.map((prod) =>
            prisma.purchase_list.create({
              data: {
                po_num: po_number,
                product_id: prod.prod_id,
                order_qty: parseInt(prod.qty),
                received_qty: 0,
                unit_price: parseInt(prod.amt),
                created_by: created_by,
                created_date: today,
                pricing_unit: prod.pricing_unit,
              },
            })
          )
        );

        const respText =
          po_status === "placed" || po_status === "draft" ? po_number : "";
        response.status(201).json(respText);
        const notification_text = `The  supplier ${sup_name} has ${po_status} purchase order successfully`;
        const notification = await prisma.cus_notification.create({
          data: {
            text: notification_text,
            receiver: user.id,
            read: "N",
            type: "PO",
            created_date: today,
            verification_id: po_number,
          },
        });
      } else {
        logger.error(`sup_name is undefined in newPurchaseOrder api`);
      }
    } else {
      logger.error(`Unauthorized- in newPurchaseOrder api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in newPurchaseOrder api`
    );
    response.status(500).json({ error: "Internal server error" });
  }
};

const update_purchaseorder = async (request, response) => {
  const usertype = request.user.userType;
  console.log("request data>", JSON.stringify(request.body));
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const po_number = request.body.po_number;
      const total_amt = request.body.total;
      const quotation_link = request.body.doclink;
      const po_status = request.body.postatus;
      const remarks = request.body.remarks;
      const created_by = request.body.user;
      const po_notes = request.body.notes;
      const prod_list = request.body.products;
      const today = new Date();
      const sup_name = request.body.trade_name;
      const user = await prisma.users.findFirst({
        where: {
          trade_name: sup_name,
        },
        select: {
          id: true,
          user_id: true,
          sup_code: true,
        },
      });

      const prod_name_array = prod_list.map((prod) => prod.prod_id);

      const products = await prisma.product_master.findMany({
        where: { product_id: { in: prod_name_array } },
        select: {
          product_id: true,
          product_name: true,
        },
      });

      const logistics = await prisma.logistics_master.findFirst({
        where: {
          logistics_name: request.body.logistics_name,
        },
        select: {
          logistics_id: true,
        },
      });
      const prod_final_array = prod_list.map((prod) => {
        const matchedProduct = products.find(
          (p) => p.product_id === prod.prod_id
        );
        return {
          prod_id: matchedProduct.product_id,
          qty: prod.qty,
          amt: prod.amt,
          receivedqty: 0,
          pricing_unit: prod.pricing_unit,
          // pendingqty: prod.qty,
          // pendingqty:pending_qty
        };
      });

      await prisma.purchase_order.updateMany({
        where: {
          po_number: po_number,
        },
        data: {
          total_amount: total_amt,
          quote_document_link1: quotation_link,
          po_status,
          remarks,
          created_by,
          updated_date: today,
          // supplier_id: user_id,
          logistics_id: logistics.logistics_id,
          po_notes,
          // products: { set: prod_final_array },
        },
      });

      await prisma.purchase_list.deleteMany({
        where: {
          po_num: po_number,
        },
      });

      // Create rows in the purchase_list table for each product in the products array
      await Promise.all(
        prod_final_array.map((prod) =>
          prisma.purchase_list.createMany({
            data: {
              po_num: po_number,
              product_id: prod.prod_id,
              order_qty: parseInt(prod.qty),
              received_qty: 0,
              unit_price: parseInt(prod.amt),
              created_by: created_by,
              created_date: today,
              pricing_unit: prod.pricing_unit,
              // modified_by: created_by,
              // modified_date: today,
            },
          })
        )
      );

      const respText =
        po_status === "placed" || po_status === "draft" ? po_number : "";
      const notification_text = `The supplier ${sup_name} has ${po_status} purchase order successfully`;

      const notification = await prisma.cus_notification.create({
        data: {
          text: notification_text,
          receiver: user.id,
          read: "N",
          type: "PO",
          created_date: today,
          verification_id: po_number,
          // created_by:customer_id
        },
      });
      response.status(201).json(respText);
    } else {
      logger.error(`Unauthorized- in update_purchaseorder api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in update_purchaseorder api`
    );
  } finally {
    await prisma.$disconnect();
  }
};

const purchaselist = async (request, response) => {
  const usertype = request.user.userType;
  console.log("request", request.body);
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const po_num = request.body.po_number;

      if (po_num) {
        const purchaselistt = await prisma.purchase_list.findMany({
          where: {
            po_num: po_num,
          },
          select: {
            product_id: true,
            po_num: true,
            order_qty: true,
            received_qty: true,
            unit_price: true,
            pricing_unit: true,
            product_master: {
              select: {
                product_name: true,
                manufacturer_code: true,
              },
            },
          },
        });

        // Calculate pending_qty for each object in the response array
        const responseArray = purchaselistt.map((item) => {
          const pending_qty = item.order_qty - item.received_qty;
          return {
            pending_qty,
            order_qty: item.order_qty,
            received_qty: item.received_qty,
            product_id: item.product_id,
            product_name: item.product_master.product_name,
            unit_price: item.unit_price,
            po_num: item.po_num,
            manufacturer_code: item.product_master.manufacturer_code,
            pricing_unit: item.pricing_unit,
          };
        });
        response.status(200).json(responseArray);
      }
    } else {
      logger.error(`Unauthorized- in purchaselist api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in purchaselist api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const purchaseOrders = async (request, response) => {
  const usertype = request.user.userType;
  console.log("reee", request.body);
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const po_num = request.body.po;
      const sup_name = request.body.trade_name;
      const division = request.body.division;

      if (po_num) {
        const purchaselistt = await prisma.purchase_list.findMany({
          where: {
            po_num: po_num,
          },
          include: {
            product_master: {
              select: {
                product_id: true,
                product_name: true,
                manufacturer_code: true,
                color_family: true,
                no_of_items: true,
                package: true,
              },
            },
          },
        });
        // Calculate pending_qty for each object in the response array
        const responseArray = purchaselistt.map((item) => {
          const pending_qty = item.order_qty - item.received_qty;
          const balance_qty = item.order_qty - item.received_qty;
          return {
            pending_qty,
            balance_qty,
            qty: item.order_qty,
            received_qty: 0,
            product_id: item.product_id,
            prod_name: item.product_master.product_name,
            manufacturer_code: item.product_master.manufacturer_code,
            color_family: item.product_master.color_family,
            rate: item.unit_price,
            po_num: item.po_num,
            purchase_id: item.purchase_id,
            no_of_items: item.product_master.no_of_items,
            p_package: item.product_master.package,
            pricing_unit: item.pricing_unit,
            // total_amount:purchase.total_amount
          };
        });

        const purchaseOrderData = await prisma.purchase_order.findMany({
          where: {
            po_number: po_num,
          },
          include: {
            users: {
              select: {
                trade_name: true,
                address: true,
              },
            },
            logistics_master: {
              select: {
                logistics_name: true,
              },
            },
          },
          orderBy: {
            purchase_id: "desc",
          },
        });

        if (purchaseOrderData.length === 0) {
          response.status(200).json([]);
          return;
        }

        const purchaseOrder = purchaseOrderData[0];
        const combinedResponse = {
          // pending_qty: purchaseOrder.order_qty - purchaseOrder.received_qty,
          qty: purchaseOrder.qty,
          received_qty: purchaseOrder.received_qty,
          product_id: purchaseOrder.product_id,
          po_notes: purchaseOrder.po_notes,
          purchase_id: purchaseOrder.purchase_id,
          total_amount: purchaseOrder.total_amount,
          po_num: purchaseOrder.po_number,
          trade_name: purchaseOrder.users.trade_name,
          address: purchaseOrder.users.address,
          logistics_name: purchaseOrder.logistics_master.logistics_name,
          po_status: purchaseOrder.po_status,
          remarks: purchaseOrder.remarks,
          created_by: purchaseOrder.created_by,
          created_date: purchaseOrder.created_date,
          products: responseArray,
        };
        response.status(200).json(combinedResponse);
      } else {
        let purchaseOrders;
        if (sup_name) {
          purchaseOrders = await prisma.purchase_order.findMany({
            where: {
              users: {
                trade_name: {
                  equals: sup_name,
                },
              },
            },
            include: {
              users: {
                select: {
                  trade_name: true,
                },
              },
            },
            orderBy: {
              purchase_id: "desc",
            },
          });
          response.status(200).json(purchaseOrders);
        } else {
          if (!division) {
            purchaseOrders = await prisma.purchase_order.findMany({
              include: {
                users: {
                  select: {
                    trade_name: true,
                  },
                },
                po_payment: true,
              },
              orderBy: {
                purchase_id: "desc",
              },
            });
            for (let i = 0; i < purchaseOrders.length; i++) {
              const total_amount = purchaseOrders[i]?.total_amount || 0;
              const po_payments = purchaseOrders[i]?.po_payment;
              const paid_amunt = po_payments.reduce(
                (sum, payment) => sum + payment.amount,
                0
              );
              const pending = total_amount - paid_amunt;
              purchaseOrders[i].pending = pending;
              if (pending === 0) {
                purchaseOrders[i].status = "closed";
              } else {
                purchaseOrders[i].status = "pending";
              }
            }
            response.status(200).json(purchaseOrders);
          } else {
            purchaseOrders = await prisma.purchase_order.findMany({
              include: {
                users: {
                  select: {
                    trade_name: true,
                    product_type: true,
                  },
                },
              },
              orderBy: {
                purchase_id: "desc",
              },
            });

            let suppArray = [];
            for (i = 0; i < purchaseOrders.length; i++) {
              if (purchaseOrders[i].users.product_type) {
                const prodTypesArray = Object.values(
                  purchaseOrders[i].users.product_type
                );
                if (prodTypesArray.includes(division)) {
                  let supData = {
                    supFullData: purchaseOrders[i],
                  };

                  suppArray.push(supData.supFullData);
                }
              }
            }
            response.status(200).json(suppArray);
          }
        }
      }
    } else {
      logger.error(`Unauthorized- in purchaseOrders api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in purchaseOrders api`
    );
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

module.exports = {
  newPurchaseOrder,
  purchaseOrders,
  purchaselist,
  update_purchaseorder,
};
