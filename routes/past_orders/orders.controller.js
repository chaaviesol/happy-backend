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

const sales_listorders = async (request, response) => {
  // const usertype=request.user.userType
  console.log("req========", request.body);
  try {
    // if(usertype==="SU"|| usertype==="ADM"){
    const sales_id = request.body.sales_id;
    if (sales_id) {
      const sales_list = await prisma.sales_list.findMany({
        where: {
          so_number: sales_id,
        },
        include: {
          product_master: {
            select: {
              product_name: true,
            },
          },
        },
      });
      response.status(200).json({ sales_list });
    } else {
      logger.error(`sales_id is undefined in sales_listorders api`);
    }
    // }
    // else{
    //   logger.error(`Unauthorized- in sales_listorders api`);
    //   return response
    //     .status(403)
    //     .json({ message: "Unauthorized. You are not an admin" });
    // }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in sales_listorders api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const servicerequest = async (request, response) => {
  console.log("req", request.body);
  const usertype = request.user.userType;
  try {
    if (usertype === "CUS") {
      const created_by = request.user.id;
      const sales_list = request.body.sales_list;
      const currentDate = new Date();
      const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
      const istDate = new Date(currentDate.getTime() + istOffset);
      const so_number = request.body.so_number;
      if (created_by && sales_list) {
        for (i = 0; i < sales_list.length; i++) {
          const second = "S";
          const first = so_number + "_" + second;
          const existingservicerequest = await prisma.service_request.findMany({
            where: { created_by: created_by },
          });

          const newid = existingservicerequest.length + 1;
          const formattedNewId = ("00" + newid).slice(-2);
          const sr_number = first + formattedNewId;
          const service_request = await prisma.service_request.create({
            data: {
              sr_number,
              sales_list_id: sales_list[i].sales_list_id,
              product_qty: parseInt(sales_list[i].qty),
              photos: sales_list[i].picture,
              remarks: sales_list[i].remarks,
              sr_status: sales_list[i].status,
              created_date: istDate,
              created_by,
            },
          });
        }
        ////////////notification//////////
        const respText = `customer requested for service request `;
        const notification = await prisma.adm_notification.create({
          data: {
            text: respText,
            sender: created_by,
            read: "N",
            type: "SR",
            created_date: istDate,
            verification_id: so_number,
          },
        });
        response.status(201).json({
          message: "successfully applied",
          success: true,
        });
      } else {
        logger.error(
          `customer_id and sales_list are mandatory in servicerequest api`
        );
      }
    } else {
      logger.error(`Unauthorized- in servicerequest api`);
      return res
        .status(403)
        .json({ message: "Unauthorized. You are not an customer" });
    }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in servicerequest api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const customer_servicereqlist = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "SU" || usertype === "ADM") {
      const customer_id = request.body.customer_id;
      if (customer_id) {
        const servicerequest = await prisma.service_request.findMany({
          where: {
            created_by: customer_id,
          },
        });
        response.status(200).json({ servicerequest });
      } else {
        logger.error(`customer_id is undefined in customer_servicereqlist api`);
      }
    } else {
      logger.error(`Unauthorized- in servicerequest api`);
      return res
        .status(403)
        .json({ message: "Unauthorized. You are not an customer" });
    }
  } catch (error) {
    logger.error(
      `An error occurred: ${error.message} in customer_servicereqlist api`
    );
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const service_requestdetails = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "SU" || usertype === "ADM") {
      const id = request.body.id;
      if (id) {
        const service_reqdata = await prisma.service_request.findMany({
          where: {
            id: id,
          },
          include: {
            sales_list: true,
          },
        });
        response.status(200).json(service_reqdata);
      } else {
        logger.error(
          `notification id is undefined in service_requestdetails api`
        );
      }
    } else {
      logger.error(`Unauthorized- in service_requestdetails api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(
      `An error occurred: ${error.message} in service_requestdetails api`
    );
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const service_reqlist = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "SU" || usertype === "ADM") {
      let request_list = {
        all_request: [],
        service_request: [],
        return_request: [],
      };
      const servicereq_list = await prisma.service_request.findMany({
        where: {
          OR: [
            {
              sr_status: {
                in: ["", "requested", "request"],
              },
            },
            {
              sr_status: null,
            },
          ],
        },
        orderBy: {
          id: "desc",
        },
        include: {
          sales_list: true,
          sales_list: {
            include: {
              product_master: true,
              sales_order_new: true,
            },
          },
          users: {
            select: {
              user_name: true,
            },
          },
        },
      });

      request_list.service_request.push(...servicereq_list);
      request_list.all_request.push(...servicereq_list);
      const return_list = await prisma.return_request.findMany({
        where: {
          OR: [
            {
              rt_status: {
                in: ["", "requested", "request"],
              },
            },
            {
              rt_status: null,
            },
          ],
        },
        orderBy: {
          id: "desc",
        },
        include: {
          sales_list: true,
          sales_list: {
            include: {
              product_master: true,
              sales_order_new: true,
            },
          },
          users: {
            select: {
              user_name: true,
            },
          },
        },
      });
      request_list.return_request.push(...return_list);
      request_list.all_request.push(...return_list);
      response.status(200).json(request_list);
    } else {
      logger.error(`Unauthorized- in seervice_reqlist api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in service_reqlist api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

//////////////////////////////return///////////////////////
const return_request = async (request, response) => {
  console.log(JSON.stringify(request.body));
  // const usertype=request.user.userType
  try {
    const created_by = request.body.customer_id || request.user.id;
    const sales_list = request.body.sales_list;
    // const refund_amt = request.body.refund_amt;
    const currentDate = new Date();
    const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
    const istDate = new Date(currentDate.getTime() + istOffset);
    const so_number = request.body.so_number;
    if (created_by && sales_list) {
      for (i = 0; i < sales_list.length; i++) {
        const second = "R";
        const first = so_number + "_" + second;
        const existingreturnrequest = await prisma.return_request.findMany({
          where: { created_by: created_by },
        });

        const newid = existingreturnrequest.length + 1;
        const formattedNewId = ("00" + newid).slice(-2);
        const rt_number = first + formattedNewId;

        const return_request = await prisma.return_request.create({
          data: {
            rt_number,
            sales_list_id: sales_list[i].sales_list_id,
            product_qty: parseInt(sales_list[i].qty),
            photos: sales_list[i].picture,
            remarks: sales_list[i].remarks,
            rt_status: "requested",
            created_date: istDate,
            created_by,
            refundable_amt: parseInt(sales_list[i].refund_amt),
          },
        });
      }
      ////////////notification//////////
      const respText = `customer requested for return `;
      const notification = await prisma.adm_notification.create({
        data: {
          text: respText,
          sender: created_by,
          read: "N",
          type: "RT",
          created_date: istDate,
          verification_id: so_number,
        },
      });
      // const return_req=await prisma.sales_order_new.update({
      //   where:{
      //     so_number:so_number
      //   },
      //   data:{
      //     so_status:"return_requested"
      //   }

      // })

      response.status(201).json({
        message: "successfully applied",
        success: true,
      });
    } else {
      logger.error(
        `customer id and sales_list is undefined in return_request api`
      );
    }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in return_request api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const customer_returnreq = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "CUS") {
      const customer_id = request.body.customer_id;
      if (customer_id) {
        const returnrequest = await prisma.return_request.findMany({
          where: {
            created_by: customer_id,
          },
        });
        response.status(200).json({ returnrequest });
      } else {
        logger.error(`customer_id is undefined in customer_returnreq api`);
      }
    } else {
      logger.error(`Unauthorized- in customer_returnreq api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(
      `An error occurred: ${error.message} in customer_returnreq api`
    );
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

////////notification//////////////
const req_confirm = async (request, response) => {
  console.log("req_confirm", request.body);
  const usertype = "SU";
  try {
    if (usertype === "SU" || usertype === "ADM") {
      const req_id = request.body.id;
      const type_request = request.body.request;
      const so_number = request.body.so_number;
      const status = request.body.status;
      const customer_id = request.body.customer_id;
      const currentDate = new Date();
      const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
      const istDate = new Date(currentDate.getTime() + istOffset);
      if (req_id && type_request && customer_id && status) {
        if (type_request === "service_request") {
          const respText = `Your service request has ${status} `;
          const sr_status = await prisma.service_request.update({
            where: {
              id: req_id,
            },
            data: {
              sr_status: status,
            },
          });
          const services = await prisma.service_request.findUnique({
            where: {
              id: req_id,
            },
          });

          const notification = await prisma.cus_notification.create({
            data: {
              text: respText,
              receiver: customer_id,
              read: "N",
              type: "SR",
              created_date: istDate,
              verification_id: so_number,
            },
          });
          if (status === "accept") {
            const order = await prisma.sales_list.findUnique({
              where: {
                id: services.sales_list_id,
              },
            });

            const sales = await prisma.sales_list.update({
              where: {
                id: services.sales_list_id,
              },
              data: {
                order_qty: order.order_qty - services.product_qty,
              },
            });

            response.status(200).json({
              success: true,
              msg: `successfully ${status}ed`,
            });
          } else {
            response.status(200).json({
              success: true,
              msg: `successfully ${status}ed`,
            });
          }
        } else if (type_request === "return_request") {
          const respText = `Your return request has ${status} `;
          const rt_status = await prisma.return_request.update({
            where: {
              id: req_id,
            },
            data: {
              rt_status: status,
            },
          });
          const retn = await prisma.return_request.findUnique({
            where: {
              id: req_id,
            },
          });

          const notification = await prisma.cus_notification.create({
            data: {
              text: respText,
              receiver: customer_id,
              read: "N",
              type: "RT",
              created_date: istDate,
              verification_id: so_number,
            },
          });
          if (status === "accept") {
            const order = await prisma.sales_list.findUnique({
              where: {
                id: services.sales_list_id,
              },
            });

            const sales = await prisma.sales_list.update({
              where: {
                id: retn.sales_list_id,
              },
              data: {
                order_qty: order.order_qty - retn.product_qty,
              },
            });

            response.status(200).json({
              success: true,
              msg: `successfully ${status}ed`,
            });
          } else {
            response.status(200).json({
              success: true,
              msg: `successfully ${status}ed`,
            });
          }
        }
      } else {
        logger.error(
          `req_id && type_request && customer_id && status are mandatory in req_confirm api`
        );
      }
    } else {
      logger.error(`Unauthorized- in req_confirm api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in req_confirm api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const return_accept = async (request, response) => {
  // const usertype=request.user.userType
  console.log("reeeeeeeeeeeeeeeeeee", request.body);
  try {
    const req_id = request.body.id;
    const type = request.body.type;
    // const customer_id = request.body.customer_id;
    const sales_list = request.body.sales_list;
    const sales_list_id = request.body.sales_list_id;
    const refundable_amt = request.body.refundable_amt;

    const currentDate = new Date();
    const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
    const istDate = new Date(currentDate.getTime() + istOffset);
    if (type && req_id && sales_list) {
      const sales_id = await prisma.sales_list.findUnique({
        where: {
          id: sales_list_id,
        },
      });

      const order = await prisma.return_request.findUnique({
        where: {
          id: req_id,
        },
      });

      const sales = await prisma.sales_list.update({
        where: {
          id: sales_id.id,
        },
        data: {
          order_qty: sales_id.order_qty - order.product_qty,
        },
      });

      if (type === "inventory") {
        const batches = sales_list.batch;
        const so_number = sales_list.so_number;
        let remainingProductQty = sales_list.product_qty; // Initialize remaining product quantity
        if (batches.length > 0) {
          for (const batch of batches) {
            // Find the inventory record for the batch
            const inventory = await prisma.inventory.findFirst({
              where: {
                INVENTORY_id: batch.INVENTORY_id,
                batch_id: batch.batch_id,
              },
            });
            if (inventory) {
              if (batch.deductedQty <= remainingProductQty) {
                remainingProductQty -= batch.deductedQty;
                const updatedInventory = await prisma.inventory.update({
                  where: {
                    INVENTORY_id: inventory.INVENTORY_id,
                    // batch_id: batch.batch_id,
                  },
                  data: {
                    total_quantity:
                      inventory.total_quantity + batch.deductedQty,
                  },
                });
              } else {
                const deductedQty = remainingProductQty;
                remainingProductQty = 0;
                const updatedInventory = await prisma.inventory.update({
                  where: {
                    INVENTORY_id: inventory.INVENTORY_id,
                    // batch_id: batch.batch_id,
                  },
                  data: {
                    total_quantity: inventory.total_quantity + deductedQty,
                  },
                });
                break;
              }
            }
          }
          const status = "accepted";

          const rt_status = await prisma.return_request.update({
            where: {
              id: req_id,
            },
            data: {
              rt_status: status,
            },
          });
          const notification = await prisma.cus_notification.create({
            data: {
              text: `Your return request has ${status} `,
              receiver: sales_list.customer_id,
              read: "N",
              type: "RT",
              created_date: istDate,
              verification_id: so_number,
            },
          });
          try {
            const transactio = await prisma.transaction.create({
              data: {
                customer_id: sales_list.customer_id,
                amount: refundable_amt,
                sales_id: sales_id.so_number,
                return_id: req_id,
                created_date: istDate,
                // created_by,
              },
            });

            const respText = `Successfully added to inventory`;
            response.status(200).json({
              success: true,
              message: respText,
            });
          } catch (err) {
            console.log(err);
          }
        }
      }
      if (type === "scrap_inventory") {
        const batches = sales_list.batch;
        const so_number = sales_list.so_number;

        const respText = `Successfully added to scrap`;
        let remainingProductQty = sales_list.product_qty;
        if (batches.length > 0) {
          for (const batch of batches) {
            const inventory = await prisma.inventory.findFirst({
              where: {
                INVENTORY_id: batch.INVENTORY_id,
                batch_id: batch.batch_id,
              },
            });

            if (inventory) {
              const deductedQty = Math.min(
                remainingProductQty,
                batch.deductedQty
              );
              const add_scrapinv = await prisma.scrap_inventory.create({
                data: {
                  prod_id: sales_list.product_id,
                  batch_id: inventory.batch_id,
                  total_quantity: deductedQty,
                  created_date: istDate,
                  po_num: inventory.po_num,
                  mrp: inventory.mrp,
                  base_price: inventory.base_price,
                  selling_price: inventory.selling_price,
                  charges: inventory.charges,
                },
              });

              remainingProductQty -= deductedQty;
              if (remainingProductQty <= 0) {
                break;
              }
            }
          }

          const status = "accepted";
          const rt_status = await prisma.return_request.update({
            where: {
              id: req_id,
            },
            data: {
              rt_status: status,
            },
          });

          const notification = await prisma.cus_notification.create({
            data: {
              text: `Your return request has ${status} `,
              receiver: sales_list.customer_id,
              read: "N",
              type: "RT",
              created_date: istDate,
              verification_id: so_number,
            },
          });
          try {
            const transactio = await prisma.transaction.create({
              data: {
                customer_id: sales_list.customer_id,
                amount: refundable_amt,
                sales_id: sales_id.so_number,
                return_id: req_id,
                created_date: istDate,
                // created_by,
              },
            });

            response.status(200).json({
              success: true,
              message: respText,
            });
          } catch (err) {
            console.log(err);
          }
        }
      }
    } else {
      logger.error(
        `type && req_id && customer_id && sales_list are mandatory in return_accept api`
      );
    }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in return_accept api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const refund_amt = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "CUS") {
      const created_by = request.user.id;
      const sales_list = request.body.sales_list_id;
      const refund_qty = request.body.qty;
      const currentDate = new Date();
      const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
      const istDate = new Date(currentDate.getTime() + istOffset);
      if (sales_list) {
        const sales_order = await prisma.sales_list.findMany({
          where: {
            id: sales_list,
          },
        });

        const singlePriceResults = [];
        for (let i = 0; i < sales_order.length; i++) {
          const net_amount = sales_order[i]?.net_amount;
          const discount = sales_order[i]?.discount || 0;
          const discnt_price =
            discount === 0 ? 0 : (net_amount * discount) / 100;

          const price =
            discnt_price === 0 ? net_amount : net_amount - discnt_price;
          const qty = sales_order[i].order_qty;
          const single_price = price / qty;
          singlePriceResults.push(single_price.toFixed(2));
        }

        response
          .status(200)
          .json({ refund_amt: (singlePriceResults * refund_qty).toFixed(2) });
      } else {
        logger.error(`sales_list_id is undefined in refund_amt api`);
      }
    } else {
      logger.error(`Unauthorized- in refund_amt api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in refund api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const wallet = async (request, response) => {
  try {
    const customer_id = request.user.id;
    const transaction = await prisma.transaction.aggregate({
      where: {
        customer_id: customer_id,
      },
      _sum: {
        amount: true,
      },
    });
    if (transaction._sum.amount != null) {
      response.status(200).json({
        success: true,
        data: transaction._sum.amount,
        message: `your wallet amount is ${transaction._sum.amount} `,
      });
    } else {
      response.status(200).json({
        success: true,
        data: 0,
      });
    }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in wallet api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

module.exports = {
  servicerequest,
  sales_listorders,
  service_reqlist,
  customer_servicereqlist,
  return_request,
  customer_returnreq,
  service_requestdetails,
  return_accept,
  req_confirm,
  refund_amt,
  wallet,
};
