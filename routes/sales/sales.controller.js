const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const winston = require("winston");
const fs = require("fs");

const { format, subMonths } = require("date-fns");
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
const currentDate = new Date();
const istOffset = 5.5 * 60 * 60 * 1000;
const istDate = new Date(currentDate.getTime() + istOffset);

const newsalesOrder = async (request, response) => {
  // const usertype=request.user.userType
  console.log("newsaless====================>", request.body);

  try {
    // if(usertype==="ADM" || usertype==="SU"){
    const customer_id = request.body.customer_id;
    if (request.body.customer_id !== undefined) {
      const userdata = await prisma.users.findUnique({
        where: { id: customer_id },
        select: { user_name: true, user_id: true, sup_code: true },
      });
      if (!userdata) {
        response.status(404).json({
          error: true,
          message: "Customer not found",
        });
        return;
      }
      await prisma.$transaction(async (prisma) => {
        const usercode = userdata.sup_code;

        const twoDigits = currentDate.getFullYear();
        const lastFourDigits = twoDigits.toString().slice(-2);
        const cus_code = usercode + lastFourDigits;
        const so_num = cus_code.toUpperCase();

        const existingsalesOrders = await prisma.sales_order_new.findMany({
          where: { customer_id: customer_id },
        });

        const newid = existingsalesOrders.length + 1;
        const formattedNewId = ("0000" + newid).slice(-4);
        const so_number = so_num + formattedNewId;
        const total_amt = parseFloat(request.body.tl_amt).toFixed(2);
        const quotation_link = request.body.doclink;
        const so_status = request.body.so_status;
        const remarks = request.body.remarks;
        // const created_by = request.body.customer_id.toString();
        const so_notes = request.body.notes;
        const prod_list = request.body.products;
        const discount = request.body.discount;
        const prod_name_array = prod_list.map((prod) => prod.product_id);
        if (!so_status && !prod_list) {
          response.status(404).json({
            error: true,
            message: "Check required fields",
          });
          return;
        }
        const products = await prisma.product_master.findMany({
          where: { product_id: { in: prod_name_array } },
          select: {
            product_id: true,
            product_name: true,
          },
        });
        const prod_final_array = prod_list.map((prod) => {
          const matchedProduct = products.find(
            (p) => p.product_id === prod.product_id
          );

          return {
            prod_id: matchedProduct.product_id,
            qty: prod.qty,
            amt: prod.selling_price,
          };
        });

        const sales_orderdata = await prisma.sales_order_new.create({
          data: {
            so_number: so_number,
            total_amount: total_amt,
            quote_document_link1: quotation_link,
            so_status,
            remarks,
            // created_by,
            created_date: istDate,
            discount: discount || 0,
            updated_date: istDate,
            customer_id: customer_id,
            // logistics_id,
            so_notes,
          },
        });

        let taskStatus = "forpacking";
        for (let i = 0; i < prod_list.length; i++) {
          const product = prod_list[i];
          const delivery_type = product.selecttype;
          if (delivery_type === "fitted" || delivery_type === "Fitted") {
            taskStatus = "forfitting";
          }
          const productAccessories = product?.products_accessories || [];
          //inventory--parentproduct
          const oldestInventoryEntries = await prisma.inventory.findMany({
            where: {
              prod_id: product.product_id,
            },
            select: {
              batch_id: true,
              total_quantity: true,
              INVENTORY_id: true,
              created_date: true,
            },
            orderBy: {
              INVENTORY_id: "asc",
            },
          });
          // let qty = parseInt(product.qty);
          let qty = parseInt(product.effective_qty); //changed from qty to effective_qty
          const deductions = [];
          for (let k = 0; k < oldestInventoryEntries.length; k++) {
            const prodinv = oldestInventoryEntries[k].INVENTORY_id;
            const batchId = oldestInventoryEntries[k].batch_id;

            let totalqt = oldestInventoryEntries[k].total_quantity;
            if (totalqt > 0 && qty > 0) {
              if (qty >= totalqt) {
                // If qty is greater than or equal to totalqt, deduct totalqt from qty
                qty -= totalqt;
                deductions.push({
                  INVENTORY_id: prodinv,
                  batch_id: batchId,
                  deductedQty: totalqt,
                });
                totalqt = 0; // Set total quantity to 0 as it's fully used up
              } else {
                // If qty is less than totalqt, deduct qty from totalqt
                totalqt -= qty;
                deductions.push({
                  INVENTORY_id: prodinv,
                  batch_id: batchId,
                  deductedQty: qty,
                });
                qty = 0;
              }

              const invupdate = await prisma.inventory.updateMany({
                where: {
                  INVENTORY_id: prodinv,
                },
                data: {
                  total_quantity: totalqt,
                },
              });
              if (qty === 0) {
                break;
              }
            }
          }
          const sales_price = product?.product_Price
            ? parseInt(product.product_Price)
            : parseInt(product?.original_price); //nw

          const salesListEntryResult = await prisma.sales_list.create({
            data: {
              so_number: sales_orderdata.sales_id,
              product_id: product.product_id,
              order_qty: parseInt(product.effective_qty),
              sales_price: sales_price, //actually selling_price// changed from original_price
              fitting_charge: parseInt(product.fitting_charge) || 0,
              delivery_type: product.selecttype,
              net_amount: parseFloat(product.total).toFixed(2),
              discount: parseInt(product?.normalDiscount?.discount) || 0, //nw
              batch: deductions,
              created_date: istDate,
              pricing_unit: product?.pricing_unit,
              couponCode: product?.couponDiscount?.couponCode, //nw
            },
          });
          //////inventoryaccessories////////////////
          const accessorydeductions = [];
          for (let j = 0; j < productAccessories.length; j++) {
            const accessory = productAccessories[j];
            const inventoryaccessories = await prisma.inventory.findMany({
              where: {
                prod_id: accessory.prod_id,
              },
              select: {
                batch_id: true,
                total_quantity: true,
                INVENTORY_id: true,
                created_date: true,
              },
              orderBy: {
                INVENTORY_id: "asc",
              },
            });
            let accqty = accessory.qty;

            for (l = 0; l < inventoryaccessories.length; l++) {
              const prodinv = inventoryaccessories[l].INVENTORY_id;
              let totalqt = inventoryaccessories[l].total_quantity;
              const batch = inventoryaccessories[l].batch_id;

              if (totalqt > 0 && accqty > 0) {
                if (accqty >= totalqt) {
                  accqty -= totalqt;
                  accessorydeductions.push({
                    INVENTORY_id: prodinv,
                    batch_id: batch,
                    deductedQty: totalqt,
                  });
                  totalqt = 0;
                } else {
                  // If qty is less than totalqt, deduct qty from totalqt
                  totalqt -= accqty;
                  accessorydeductions.push({
                    INVENTORY_id: prodinv,
                    batch_id: batch,
                    deductedQty: accqty,
                  });
                  accqty = 0;
                }

                const invupdate = await prisma.inventory.updateMany({
                  where: {
                    INVENTORY_id: prodinv,
                  },
                  data: {
                    total_quantity: totalqt,
                  },
                });

                if (accqty === 0) {
                  break;
                }
              }
            }
            await prisma.sales_list_accessories.create({
              data: {
                so_number: sales_orderdata.sales_id,
                parent_product_id: product.product_id,
                product_id: accessory.prod_id,
                order_qty: parseInt(accessory.qty),
                sales_price: parseInt(accessory.price),
                net_amt: accessory.ac_tl_Price,
                // created_by: created_by,
                created_date: istDate,
              },
            });
          }
        }

        if (so_status == "placed") {
          const so_update = await prisma.sales_order_new.update({
            where: {
              so_number: so_number,
            },
            data: {
              so_status: taskStatus,
            },
          });
          const respText = `sales order ${so_number} has  ${so_status} successfully`;
          const notification = await prisma.cus_notification.create({
            data: {
              text: respText,
              receiver: customer_id,
              read: "N",
              type: "OR",
              created_date: istDate,
              verification_id: so_number,
            },
          });
          response.status(201).json({
            data: sales_orderdata,
            success: true,
            message: respText,
          });
        } else {
          const so_update = await prisma.sales_order_new.update({
            where: {
              so_number: so_number,
            },
            data: {
              so_status: so_status,
            },
          });
          const respText = `sales order ${so_status} successfully`;
          response.status(201).json({
            data: sales_orderdata,
            success: true,
            message: respText,
          });
        }
      });
    }
    // }
    // else{
    //   logger.error(`Unauthorized- in newsales api`);
    //   return response
    //     .status(404)
    //     .json({ message: "Unauthorized. You are not an admin" });
    // }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in newsaleorders api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const salesOrders = async (request, response) => {
  // const usertype=request.user.userType
  try {
    const so_number = request.body.so_number;
    const customer_id = request.body.customer_id;

    if (so_number) {
      const sonum = await prisma.sales_order_new.findFirst({
        where: {
          so_number: so_number,
        },
        select: {
          sales_id: true,
        },
        orderBy: {
          sales_id: "desc",
        },
      });
      const sales_idd = sonum.sales_id;
      const saleslistt = await prisma.sales_list.findMany({
        where: {
          so_number: sales_idd,
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
      const responseArray = saleslistt.map((item) => {
        //   const pending_qty = item.order_qty - item.received_qty;
        return {
          // pending_qty,
          sales_list_id: item.id,
          qty: item.order_qty,
          sales_price: item.sales_price,
          fitting_charge: item.fitting_charge,
          delivery_type: item.delivery_type,
          discount: item.discount,
          net_amount: item.net_amount,
          // received_qty: 0,
          product_id: item.product_id,
          prod_name: item.product_master.product_name,
          manufacturer_code: item.product_master.manufacturer_code,
          color_family: item.product_master.color_family,
          // amt: item.sales_price,
          so_number: item.so_number,
          no_of_items: item.product_master.no_of_items,
          p_package: item.product_master.package,
        };
      });

      const salesOrderData = await prisma.sales_order_new.findMany({
        where: {
          so_number: so_number,
        },
        include: {
          users: true,
        },
      });

      if (salesOrderData.length === 0) {
        response.status(200).json([]);
        return;
      }

      const salesOrder = salesOrderData[0];

      // Combine the data and prepare the final response
      const combinedResponse = {
        qty: salesOrder.qty,
        product_id: salesOrder?.product_id,
        so_notes: salesOrder?.so_notes,
        sales_id: salesOrder?.sales_id,
        so_number: salesOrder?.so_number,
        discount: salesOrder?.discount,
        address: salesOrder?.users?.address,
        so_status: salesOrder.so_status,
        total_amount: salesOrder?.total_amount,
        remarks: salesOrder?.remarks,
        created_by: salesOrder?.created_by,
        created_date: salesOrder?.created_date,
        products: responseArray,
        trade_name: salesOrder?.users.trade_name,
        // total_amount:salesOrder.total_amount,
        // logistics_name: salesOrder.logistics_master.logistics_name,
        // received_qty: salesOrder.received_qty,
        // pending_qty: salesOrder.order_qty - salesOrder.received_qty,
      };
      response.status(200).json(combinedResponse);
    } else {
      if (customer_id) {
        let salesorders = {
          all: [],
          requested_quote: [],
          responded: [],
          placed: [],
        };
        const salesOrders = await prisma.sales_order_new.findMany({
          where: {
            users: {
              id: {
                equals: customer_id,
              },
            },
          },
          include: {
            users: true,
          },
          orderBy: {
            sales_id: "desc",
          },
        });

        // Concatenate all sales orders into the 'all' array
        salesorders.all = salesorders.all.concat(salesOrders);

        for (let i = 0; i < salesOrders.length; i++) {
          const sales_so_status = salesOrders[i].so_status;
          if (sales_so_status === "requested_quote") {
            salesorders.requested_quote.push(salesOrders[i]);
          } else if (
            sales_so_status === "responded" ||
            sales_so_status === "quote_rejected"
          ) {
            salesorders.responded.push(salesOrders[i]);
          } else if (sales_so_status === "placed") {
            salesorders.placed.push(salesOrders[i]);
          }
        }
        response.status(200).json(salesorders);
      }
      ///////////////////////////all//////////////
      else {
        const salesOrders = await prisma.sales_order_new.findMany({
          include: {
            users: true,
            so_payment: true,
          },
          where: {
            so_status: {
              notIn: ["requested_quote", "quote_rejected"],
            },
          },
          orderBy: [
            {
              sales_id: "desc",
            },
            {
              updated_date: "desc",
            },
          ],
        });
        // for (let i = 0; i < salesOrders.length; i++) {
        //   const total_amount = salesOrders[i]?.total_amount || 0;
        //   const so_payments = salesOrders[i]?.so_payment;
        //   const paid_amunt = so_payments.reduce((sum, payment) => sum + payment.amount, 0);
        //   const pending = total_amount - paid_amunt;
        //   salesOrders[i].pending = pending;
        //   if (pending === 0) {
        //     salesOrders[i].status = "closed";
        //   } else {
        //     salesOrders[i].status = "pending";
        //   }
        // }
        for (const order of salesOrders) {
          const total_amount = order.total_amount || 0;
          const paid_amount = (order.so_payment || []).reduce(
            (sum, payment) => sum + payment.amount,
            0
          );
          const pending = total_amount - paid_amount;
          order.pending = pending;
          order.status = pending === 0 ? "closed" : "pending";
        }
        response.status(200).json(salesOrders);
      }
    }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in saleorders api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

// const viewcustomers = async (request, response) => {
//   const usertype = "CUS";
//   try {
//     const customer = await prisma.users.findMany({
//       where: {
//         user_type: usertype,
//         is_approved: "Y",
//       },
//       select: {
//         trade_name: true,
//         user_name: true,
//         mobile: true,
//         id: true,

//       },
//     });

//     //  const customerNames = customer.map((item) => item.trade_name);
//     //     const uniqueCustomerNamesSet = new Set(customerNames);
//     //     const uniqueCustomerNames = [...uniqueCustomerNamesSet];
//     //     const respText = {uniqueCustomerNames };
//     response.status(201).json(customer);
//   } catch (error) {
//     logger.error(`An error occurred: ${error.message} in viewcustomers api`);
//     response.status(500).json({ error: "Internal server error" });
//   } finally {
//     await prisma.$disconnect();
//   }
// };

const viewcustomers = async (request, response) => {
  const usertype = "CUS";
  try {
    // 1️⃣ Fetch all approved customers with their sales orders and payments
    const customers = await prisma.users.findMany({
      where: {
        user_type: usertype,
        is_approved: "Y",
      },
      select: {
        id: true,
        trade_name: true,
        user_name: true,
        mobile: true,
        grade: true,
        sales_order_new: {
          select: {
            sales_id: true,
            total_amount: true,
            so_payment: {
              select: {
                amount: true,
              },
            },
          },
        },
      },
    });

    // 2️⃣ Compute totals for each customer
    const result = customers.map((cust) => {
      const orders = cust.sales_order_new || [];

      const totalAmount = orders.reduce(
        (sum, o) => sum + parseFloat(o.total_amount || 0),
        0
      );

      const paidAmount = orders.reduce((sum, o) => {
        const payments = o.so_payment || [];
        const totalPaid = payments.reduce(
          (pSum, pay) => pSum + parseFloat(pay.amount || 0),
          0
        );
        return sum + totalPaid;
      }, 0);

      const outstanding = totalAmount - paidAmount;

      return {
        id: cust.id,
        trade_name: cust.trade_name,
        user_name: cust.user_name,
        mobile: cust.mobile,
        grade: cust.grade,
        total_amount: totalAmount.toFixed(2),
        paid_amount: paidAmount.toFixed(2),
        outstanding_amount: outstanding.toFixed(2),
      };
    });

    response.status(200).json(result);
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in viewcustomers api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

////////////////accessories--view////////////

const viewaccessories = async (request, response) => {
  // const usertype=request.user.userType
  try {
    const prodlist = await prisma.inventory.findMany();
    const productDataArray = [];
    const prod_type = "accessories";

    for (const prod of prodlist) {
      if (prod.prod_id !== null && prod.total_quantity > 0) {
        const productDetails = await prisma.product_master.findFirst({
          where: {
            product_id: prod.prod_id,
            product_type: prod_type,
          },
          select: {
            product_name: true,
            color_family: true,
            product_type: true,
          },
        });

        if (productDetails) {
          const existingProductIndex = productDataArray.findIndex(
            (item) => item.prod_id === prod.prod_id
          );

          if (existingProductIndex !== -1) {
            productDataArray[existingProductIndex].total_quantity +=
              prod.total_quantity;
          } else {
            productDataArray.push({
              prod_id: prod.prod_id,
              prod_type: prod_type,
              product_name: productDetails.product_name,
              color_family: productDetails.color_family,
              total_quantity: prod.total_quantity,
              mrp: prod.mrp,
            });
          }
        }
      }
    }

    response.status(201).json({
      data: productDataArray,
      success: true,
    });
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in viewaccessories api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const productsale_list = async (request, response) => {
  try {
    const division = request.body.division;
    console.log("aa division", division);

    if (!division) {
      const prodlist = await prisma.inventory.findMany({
        where: {
          AND: [{ prod_id: { not: null } }, { total_quantity: { gt: 0 } }],
        },
      });

      const productDataArray = await Promise.all(
        prodlist.map(async (prod) => {
          const [maxMrp, productTypeResult, coupon] = await Promise.all([
            prisma.inventory.aggregate({
              _max: { mrp: true },
              _min: { selling_price: true },
              where: { prod_id: prod.prod_id },
            }),
            prisma.product_master.findFirst({
              where: { product_id: prod.prod_id },
              select: {
                product_type: true,
                product_name: true,
                color_family: true,
                package: true,
                no_of_items: true,
                gst_perc: true,
                product_code: true,
              },
            }),
            prisma.campaigns.findMany({
              where: {
                product_id: { array_contains: prod.prod_id },
                NOT: { status: "N" },
              },
            }),
          ]);

          const updatedCampaigns = await Promise.all(
            coupon.map(async (campaign) => {
              if (campaign.status === "Y" && istDate > campaign.end_date) {
                await prisma.campaigns.update({
                  where: { id: campaign.id },
                  data: { status: "N" },
                });
                return { ...campaign, status: "N" };
              } else {
                return campaign;
              }
            })
          );

          const activeCampaigns = updatedCampaigns.filter((campaign) => {
            return (
              currentDate >= campaign.start_date &&
              currentDate <= campaign.end_date
            );
          });

          if (productTypeResult) {
            return {
              product_id: prod.prod_id,
              prod_type: productTypeResult.product_type,
              product_name: productTypeResult.product_name,
              color_family: productTypeResult.color_family,
              package: productTypeResult.package,
              no_of_items: productTypeResult.no_of_items,
              total_quantity: prod.total_quantity,
              mrp: maxMrp._max.mrp,
              original_price: maxMrp._min.selling_price,
              activeCampaigns,
              product_code: productTypeResult.product_code,
            };
          }
        })
      );

      response.status(201).json({
        data: productDataArray.filter(Boolean), // Remove any null or undefined entries
        success: true,
      });
    } else if (division) {
      const prodlist = await prisma.inventory.findMany({
        where: {
          product_master: {
            product_type: division,
          },
          AND: [{ prod_id: { not: null } }, { total_quantity: { gt: 0 } }],
        },
      });

      const productDataArray = [];

      await Promise.all(
        prodlist.map(async (prod) => {
          const [maxMrp, productTypeResult] = await Promise.all([
            prisma.inventory.aggregate({
              _max: { mrp: true },
              _min: { selling_price: true },
              where: { prod_id: prod.prod_id },
            }),
            prisma.product_master.findFirst({
              where: { product_id: prod.prod_id },
              select: {
                product_type: true,
                product_name: true,
                color_family: true,
                package: true,
                no_of_items: true,
                gst_perc: true,
                product_code: true,
              },
            }),
          ]);

          if (productTypeResult) {
            const existingProductIndex = productDataArray.findIndex(
              (item) => item.product_id === prod.prod_id
            );

            if (existingProductIndex !== -1) {
              productDataArray[existingProductIndex].total_quantity +=
                prod.total_quantity;
            } else {
              productDataArray.push({
                product_id: prod.prod_id,
                prod_type: productTypeResult.product_type,
                product_name: productTypeResult.product_name,
                color_family: productTypeResult.color_family,
                package: productTypeResult.package,
                no_of_items: productTypeResult.no_of_items,
                total_quantity: prod.total_quantity,
                mrp: maxMrp._max.mrp,
                original_price: maxMrp._min.selling_price,
                product_code: productTypeResult.product_code,
              });
            }
          }
        })
      );

      response.status(201).json({
        data: productDataArray,
        success: true,
      });
    }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in productsale_list api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

///////////////proddetails////////////////

const getsalesProductDetails = async (request, response) => {
  // const usertype=request.user.userType
  try {
    const type = request.body.type;
    const productid = request.body.prod_id;

    // if (type === "" || type === null || type === undefined) {
    const productDetails = await prisma.product_master.findFirst({
      where: {
        product_id: productid,
      },
      select: {
        product_id: true,
        product_name: true,
        manufacturer_code: true,
        color_family: true,
        package: true,
        no_of_items: true,
        gst_perc: true,
      },
    });

    const maxMrp = await prisma.inventory.aggregate({
      _max: {
        mrp: true,
      },
      _min: {
        selling_price: true,
      },
      where: {
        prod_id: productid,
      },
    });

    productDetails.mrp = maxMrp._max.mrp;
    productDetails.selling_price = maxMrp._min.selling_price;

    response.status(201).json(productDetails);
  } catch (error) {
    logger.error(
      `An error occurred: ${error.message} in getsalesProductDetails api`
    );

    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const sendquotation = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "CUS") {
      const customer_id = parseInt(request.user.id);
      if (customer_id !== undefined) {
        const userdata = await prisma.users.findFirst({
          where: { id: customer_id },
          select: { user_name: true, user_id: true, sup_code: true },
        });

        if (!userdata) {
          response.status(404).json({ error: "customer not found" });
          return;
        }
        const usercode = userdata.sup_code;
        const currentDate = new Date(); // Current date and time
        const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
        const istDate = new Date(currentDate.getTime() + istOffset);
        const twoDigits = currentDate.getFullYear();
        const lastFourDigits = twoDigits.toString().slice(-2);
        const cus_code = usercode + lastFourDigits;
        const so_num = cus_code.toUpperCase();

        const existingsalesOrders = await prisma.sales_order_new.findMany({
          where: { customer_id: customer_id },
        });
        const newid = existingsalesOrders.length + 1;
        const formattedNewId = ("0000" + newid).slice(-4);
        const so_number = so_num + formattedNewId;
        const total_amt = request.body.tl_amt;
        const quotation_link = request.body.doclink;
        const so_status = request.body.so_status;
        const remarks = request.body.remarks;
        const created_by = request.body.customer_id.toString();
        const so_notes = request.body.so_notes;
        const prod_list = request.body.products;
        const prod_name_array = prod_list.map((prod) => prod.product_id);
        const products = await prisma.product_master.findMany({
          where: { product_id: { in: prod_name_array } },
          select: {
            product_id: true,
            product_name: true,
          },
        });
        const prod_final_array = prod_list.map((prod) => {
          const matchedProduct = products.find(
            (p) => p.product_id === prod.product_id
          );
          return {
            prod_id: matchedProduct.product_id,
            qty: prod.quantity,
            amt: prod.amt,
          };
        });
        const sales_orderdata = await prisma.sales_order_new.create({
          data: {
            so_number: so_number,
            total_amount: total_amt,
            quote_document_link1: quotation_link,
            so_status,
            remarks,
            created_by,
            created_date: istDate,

            updated_date: istDate,
            customer_id: customer_id,
            // logistics_id,
            so_notes,
          },
        });
        for (let i = 0; i < prod_list.length; i++) {
          const product = prod_list[i];
          const salesListEntryResult = await prisma.sales_list.create({
            data: {
              so_number: sales_orderdata.sales_id,
              product_id: product.product_id,
              order_qty: parseInt(product.quantity),
              // sales_price: parseInt(product.amt),
              fitting_charge: parseInt(product.fitting_charge) || 0,
              delivery_type: product.select_type,
              created_by: created_by,
              created_date: istDate,
            },
          });
        }
        const respText = `sales order ${so_status} successfully`;
        const notification_test = `The  customer ${userdata.user_name} has ${so_status} successfully`;
        const notification = await prisma.adm_notification.create({
          data: {
            text: notification_test,
            sender: customer_id,
            read: "N",
            type: "OR",
            created_date: istDate,
            created_by: customer_id,
            verification_id: so_number,
          },
        });
        response.status(201).json({
          // data: salesListEntryResult,
          success: true,
          message: respText,
        });
      }
    } else {
      logger.error(`Unauthorized- in sendquotation api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an customer" });
    }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in sendquotation api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

//////////view quotation lists////////////
const viewquotation = async (request, response) => {
  // const usertype = request.user.userType
  try {
    // if (usertype === "ADM" || usertype === "SU") {
    const requested = await prisma.sales_order_new.findMany({
      where: {
        so_status: {
          in: ["requested_quote", "quote_rejected"],
        },
      },
      select: {
        sales_id: true,
        so_number: true,
        so_notes: true,
        so_status: true,
        remarks: true,
        created_by: true,
        created_date: true,
        users: {
          select: {
            user_id: true,
            user_name: true,
          },
        },
      },
      orderBy: {
        sales_id: "desc",
      },
    });
    response.status(200).json(requested);
    // } else {
    //   logger.error(`Unauthorized- in viewquotation api`);
    //   return response
    //     .status(403)
    //     .json({ message: "Unauthorized." });

    // }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in viewquotation api`
    );
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const quoted_details = async (request, response) => {
  try {
    // if(usertype==="ADM" || usertype==="SU"){
    const sales_id = request.body.sales_id;
    if (sales_id) {
      let productDataArray = [];
      let productsArray = [];

      const sales_orders = await prisma.sales_order_new.findFirst({
        where: {
          sales_id: sales_id,
        },
        select: {
          sales_id: true,
          so_number: true,
          so_notes: true,
          remarks: true,
          discount: true,
          users: {
            select: {
              user_id: true,
              user_name: true,
            },
          },
        },
      });

      productDataArray.push({
        so_number: sales_orders.so_number,
        so_notes: sales_orders.so_notes,
        remarks: sales_orders.remarks,
        user_id: sales_orders.users.user_id,
        user_name: sales_orders.users.user_name,
        sales_id: sales_orders.sales_id,
        discount: sales_orders?.discount, //changed from just discount to this format
      });

      const sales_list = await prisma.sales_list.findMany({
        where: {
          so_number: sales_id,
        },
        include: {
          campaigns: {
            select: {
              coupon_code: true,
              discount: true,
              discount_type: true,
            },
          },
        },
      });

      for (let i = 0; i < sales_list.length; i++) {
        const prod = sales_list[i];
        const couponDiscount = {
          couponCode: sales_list[i]?.campaigns?.coupon_code,
          discount: sales_list[i]?.campaigns?.discount,
          discountType: sales_list[i]?.campaigns?.discount_type,
        };

        if (prod.product_id !== null) {
          const maxMrp = await prisma.inventory.aggregate({
            _max: {
              mrp: true,
            },
            _min: {
              selling_price: true,
            },
            _sum: {
              total_quantity: true,
            },
            where: {
              prod_id: prod.product_id,
            },
          });

          const productTypeResult = await prisma.product_master.findFirst({
            where: {
              product_id: prod.product_id,
            },
            select: {
              product_type: true,
              product_name: true,
              manufacturer_code: true,
              color_family: true,
              package: true,
              color: true,
              no_of_items: true,
              gst_perc: true,
            },
          });
          const prod_id = prod?.product_id;

          const coupon = await prisma.campaigns.findMany({
            where: {
              product_id: {
                array_contains: prod_id,
              },
              NOT: {
                status: "N",
              },
            },
          });

          const updatedCampaigns = coupon.map(async (campaign) => {
            if (campaign.status === "Y" && istDate > campaign.end_date) {
              await prisma.campaigns.update({
                where: {
                  id: campaign.id,
                },
                data: {
                  status: "N",
                },
              });
              return { ...campaign, status: "N" };
            } else {
              return campaign;
            }
          });

          await Promise.all(updatedCampaigns);
          // Filter the campaigns that are currently active after the updates
          const activeCampaigns = coupon.filter((campaign) => {
            return (
              currentDate >= campaign.start_date &&
              currentDate <= campaign.end_date
            );
          });

          ///////////////////
          if (productTypeResult) {
            let calculatedQty = prod.order_qty;
            if (
              sales_list[i].pricing_unit &&
              sales_list[i].pricing_unit.toLowerCase() === "bundle" &&
              productTypeResult.no_of_items > 0
            ) {
              calculatedQty = prod.order_qty / productTypeResult.no_of_items;
            }
            productsArray.push({
              product_id: prod.product_id,
              qty: prod.calculatedQty,
              selecttype: prod.delivery_type,
              prod_type: productTypeResult.product_type,
              product_name: productTypeResult.product_name,
              color_family: productTypeResult.color_family,
              color: productTypeResult.color,
              package: productTypeResult.package,
              no_of_items: productTypeResult.no_of_items,
              total_quantity: maxMrp._sum.total_quantity,
              mrp: maxMrp._max.mrp,
              original_price: maxMrp._min.selling_price,
              net_amount: sales_list[i].net_amount,
              product_Price: sales_list[i].sales_price,
              pricing_unit: sales_list[i].pricing_unit,
              normalDiscount: { discount: sales_list[i].discount }, //changed from disc
              fitting_charge: sales_list[i].fitting_charge,
              activeCampaigns: activeCampaigns || [],
              couponDiscount: couponDiscount || [],
            });
          }

          const sales_list_accessories =
            await prisma.sales_list_accessories.findMany({
              where: {
                so_number: sales_id,
                parent_product_id: prod.product_id,
              },
              include: {
                product_master_sales_list_accessories_product_idToproduct_master:
                  {
                    select: {
                      product_id: true,
                      product_name: true,
                      color: true,
                      color_family: true,
                    },
                  },
              },
            });

          if (sales_list_accessories.length > 0) {
            let access = [];
            let net_amount = 0;

            for (let j = 0; j < sales_list_accessories.length; j++) {
              let accessory = sales_list_accessories[j];
              accessory.product_name =
                accessory.product_master_sales_list_accessories_product_idToproduct_master.product_name;
              if (accessory.parent_product_id === prod.product_id) {
                access.push(accessory);
                net_amount += parseInt(accessory.net_amt);
              }
            }

            productsArray[i].products_accessories = access; //chnge
            productsArray[i].price_accessory = productsArray[i].fitting_charge
              ? net_amount + productsArray[i].fitting_charge
              : net_amount; //change from accessory_total to price_accessory
          }
        }
      }

      productDataArray[0].products = productsArray;
      response.status(200).json(productDataArray);
    } else {
      logger.error(`sales_id is undefined in quoted_details api`);
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in quoted_details api`
    );
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

/////////////admin-creating a sales_order///////

const quoted_salesorder = async (request, response) => {
  const usertype = request.user.userType;
  console.log(
    "request quoted_salesorder data is >",
    JSON.stringify(request.body)
  );
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const customer_id = request.body.customer_id;
      const so_number = request.body.so_number;
      const sales_id = request.body.sales_id;
      const updated_by = request.body.updated_by;
      const total_amt = request.body.tl_amt;
      const quotation_link = request.body.doclink;
      const so_status = request.body.so_status;
      const remarks = request.body.remarks;
      const discount = request.body.discount || 0;
      const prod_list = request.body.products;

      if (customer_id && sales_id && so_status) {
        await prisma.$transaction(async (prisma) => {
          const sl_order = await prisma.sales_order_new.findFirst({
            where: {
              sales_id: sales_id,
            },
          });

          const prod_name_array = prod_list.map((prod) => prod.product_id);
          const products = await prisma.product_master.findMany({
            where: { product_id: { in: prod_name_array } },
            select: {
              product_id: true,
              product_name: true,
            },
          });
          const prod_final_array = prod_list.map((prod) => {
            const matchedProduct = products.find(
              (p) => p.product_id === prod.product_id
            );
            return {
              prod_id: matchedProduct.product_id,
              qty: prod.qty,
              amt: prod.selling_price,
            };
          });
          const currentDate = new Date();
          const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
          const updated_date = new Date(currentDate.getTime() + istOffset);

          const sales_orderdata = await prisma.sales_order_new.update({
            where: {
              sales_id: sales_id,
            },
            data: {
              total_amount: total_amt,
              quotation_link: quotation_link,
              discount: parseInt(discount),
              so_status: so_status,
              remarks: remarks,
              updated_by,
              updated_date,
            },
          });
          for (let i = 0; i < prod_list.length; i++) {
            const product = prod_list[i];
            const productAccessories = product.products_accessories || [];
            //inventory--parentproduct

            const oldestInventoryEntries = await prisma.inventory.findMany({
              where: {
                prod_id: product.product_id,
              },
              select: {
                batch_id: true,
                total_quantity: true,
                INVENTORY_id: true,
                blocked_quantity: true,
              },
              orderBy: {
                INVENTORY_id: "asc",
              },
            });
            let qty = parseInt(product.qty);
            const deductions = [];

            for (let k = 0; k < oldestInventoryEntries.length; k++) {
              const prodinv = oldestInventoryEntries[k].INVENTORY_id;
              const batchId = oldestInventoryEntries[k].batch_id;
              let totalqt = oldestInventoryEntries[k].total_quantity;
              const blkquantity = oldestInventoryEntries[k].blocked_quantity;
              if (sl_order.so_status === "requested_quote") {
                if (totalqt > 0 && qty > 0) {
                  if (qty >= totalqt) {
                    qty -= totalqt;
                    deductions.push({
                      INVENTORY_id: prodinv,
                      batch_id: batchId,
                      deductedQty: totalqt,
                    });
                    totalqt = 0;
                  } else {
                    totalqt -= qty;
                    deductions.push({
                      INVENTORY_id: prodinv,
                      batch_id: batchId,
                      deductedQty: qty,
                    });
                    qty = 0;
                  }
                  const blk_qty = blkquantity !== null ? blkquantity : 0;

                  const newBlockedQty =
                    blk_qty + deductions[deductions.length - 1].deductedQty;

                  const invupdate = await prisma.inventory.updateMany({
                    where: {
                      INVENTORY_id: prodinv,
                    },
                    data: {
                      total_quantity: totalqt,
                      blocked_quantity: newBlockedQty,
                    },
                  });
                  if (qty === 0) {
                    break;
                  }
                }
              }
            }
            const sales_price = product?.product_Price
              ? parseInt(product.product_Price)
              : parseInt(product?.original_price); //nw

            const salesListEntryResult = await prisma.sales_list.updateMany({
              where: {
                so_number: sales_id,
                product_id: product.product_id,
              },
              data: {
                order_qty: parseInt(product.qty),
                // sales_price: parseInt(product.selling_price) || parseInt(product.original_price),
                sales_price: sales_price, //actually selling_price// changed from original_price
                fitting_charge: parseInt(product.fitting_charge) || 0,
                delivery_type: product.selecttype,
                // discount: parseInt(product.disc) || 0,
                discount: parseInt(product?.normalDiscount?.discount) || 0,
                net_amount: product.total,
                batch: deductions,
                // modified_by,
                modified_date: updated_date,
                couponCode: product?.couponDiscount?.couponCode,
              },
            });

            //////inventoryaccessories////////////////
            const accessorydeductions = [];
            for (let j = 0; j < productAccessories.length; j++) {
              const accessory = productAccessories[j];

              const inventoryaccessories = await prisma.inventory.findMany({
                where: {
                  prod_id: accessory.prod_id,
                },
                select: {
                  batch_id: true,
                  total_quantity: true,
                  INVENTORY_id: true,
                  blocked_quantity: true,
                },
                orderBy: {
                  INVENTORY_id: "asc",
                },
              });
              let accqty = accessory.qty;

              for (l = 0; l < inventoryaccessories.length; l++) {
                const prodinv = inventoryaccessories[l].INVENTORY_id;
                let totalqt = inventoryaccessories[l].total_quantity;
                const batch = inventoryaccessories[l].batch_id;
                const blkquantity = inventoryaccessories[l].blocked_quantity;
                if (sl_order.so_status === "requested_quote") {
                  if (totalqt > 0 && accqty > 0) {
                    if (accqty >= totalqt) {
                      accqty -= totalqt;
                      accessorydeductions.push({
                        INVENTORY_id: prodinv,
                        batch_id: batch,
                        deductedQty: totalqt,
                      });
                      totalqt = 0;
                    } else {
                      // If qty is less than totalqt, deduct qty from totalqt
                      totalqt -= accqty;
                      accessorydeductions.push({
                        INVENTORY_id: prodinv,
                        batch_id: batch,
                        deductedQty: qty,
                      });
                      accqty = 0;
                    }

                    const blk_qty = blkquantity !== null ? blkquantity : 0;
                    const newBlockedQty =
                      blk_qty +
                      accessorydeductions[accessorydeductions.length - 1]
                        .deductedQty;

                    const invupdate = await prisma.inventory.updateMany({
                      where: {
                        INVENTORY_id: prodinv,
                      },
                      data: {
                        total_quantity: totalqt,
                        blocked_quantity: newBlockedQty,
                      },
                    });

                    if (accqty === 0) {
                      break;
                    }
                  }
                }
              }

              const qty = accessory?.qty || accessory?.order_qty;
              const price = accessory?.price || sales_price;
              const prod_id = accessory.prod_id || accessory.product_id;
              const accessories_create =
                await prisma.sales_list_accessories.create({
                  data: {
                    so_number: sales_id,
                    parent_product_id: product.product_id,
                    product_id: prod_id,
                    order_qty: parseInt(qty),
                    sales_price: parseInt(price),
                    net_amt: accessory.ac_tl_Price,
                    // created_by: created_by,
                    created_date: updated_date,
                  },
                });
            }
          }
          ////////////////////////notification/////////////////
          const so_num = await prisma.sales_order_new.findFirst({
            where: {
              sales_id: sales_id,
            },
            select: {
              so_number: true,
            },
          });
          const userId = await prisma.users.findFirst({
            where: {
              user_id: customer_id,
            },
          });
          if (so_status == "placed") {
            const respText = `sales order ${so_status} successfully`;
            const notification_text = `Your sales order ${so_num.so_number} has ${so_status}`;
            const notification = await prisma.cus_notification.create({
              data: {
                text: notification_text,
                receiver: userId?.id,
                read: "N",
                type: "OR",
                created_date: updated_date,
                verification_id: so_num.so_number,
                // created_by:customer_id
              },
            });

            response.status(201).json({
              data: sales_orderdata,
              success: true,
              message: respText,
            });
          } else {
            const respText = `sales order saved as ${so_status}`;
            const notification_text = `Your sales order ${so_num.so_number} has ${so_status}`;
            const notification = await prisma.cus_notification.create({
              data: {
                text: notification_text,
                receiver: userId?.id,
                read: "N",
                type: "OR",
                created_date: updated_date,
                verification_id: so_num.so_number,
                // created_by:customer_id
              },
            });
            response.status(201).json({
              data: sales_orderdata,
              success: true,
              message: respText,
            });
          }
        });
      } else {
        logger.error(`all fields are mandatory in quoted_salesorder api`);
        response.status(404).json({
          message: "Check required fields",
          error: true,
          success: false,
        });
      }
    } else {
      logger.error(`Unauthorized- in sendquotation api`);
      return response.status(403).json({ message: "Unauthorized!" });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in quoted_salesorder api`
    );
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

/////////sales_orders of a customer

const cus_quotation_response = async (request, response) => {
  // const usertype=request.user.userType
  try {
    // if(usertype==="ADM" || usertype==="SU"){
    const customer_id = request.body.customer_id;
    if (customer_id) {
      const requested = await prisma.sales_order_new.findMany({
        where: {
          // so_status: {
          //   in: ["responded"],
          //   // in: ["responded", "quote_rejected"],
          // },
          customer_id: customer_id,
        },
        orderBy: {
          sales_id: "desc",
        },
      });
      response.status(200).json(requested);
    } else {
      logger.error("customer_id is undefined in cus_quotation_response api");
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in cus_quotation_response api`
    );
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

//////////////sales_order sent by admin//////////////

const respond_details = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "ADM" || usertype === "SU" || usertype === "CUS") {
      const sales_id = request.body.sales_id;
      if (sales_id) {
        const productData = {};
        const sales_orders = await prisma.sales_order_new.findFirst({
          where: {
            sales_id: sales_id,
          },
          include: {
            users: {
              select: {
                user_id: true,
                user_name: true,
                mobile: true,
                email: true,
                address: true,
              },
            },
          },
        });

        productData.sales_id = sales_orders.sales_id;
        productData.so_number = sales_orders.so_number;
        productData.total_amount = sales_orders.total_amount;
        productData.quote_document_link1 = sales_orders.quote_document_link1;
        productData.so_status = sales_orders.so_status;
        productData.remarks = sales_orders.remarks;
        productData.delivery_date = sales_orders.delivery_date;
        productData.created_by = sales_orders.created_by;
        productData.created_date = sales_orders.created_date;
        productData.updated_by = sales_orders.updated_by;
        productData.updated_date = sales_orders.updated_date;
        productData.discount = sales_orders.discount;
        productData.logistics_id = sales_orders.logistics_id;
        productData.so_notes = sales_orders.so_notes;
        productData.customer_id = sales_orders.customer_id;
        productData.mobile = sales_orders.users.mobile;
        productData.user_name = sales_orders.users.user_name;
        productData.address = sales_orders.users.address;

        const products = [];
        const sales_list = await prisma.sales_list.findMany({
          where: {
            so_number: sales_id,
          },
          include: {
            product_master: {
              select: {
                product_id: true,
                product_name: true,
                color: true,
                color_family: true,
              },
            },
          },
        });

        for (let i = 0; i < sales_list.length; i++) {
          const prod = sales_list[i];
          const maxMrp = await prisma.inventory.aggregate({
            _max: {
              mrp: true,
            },
            _min: {
              selling_price: true,
            },
            where: {
              prod_id: prod.product_id,
            },
          });
          const batchIds = prod?.batch?.map((batchItem) => batchItem.batch_id);
          const productItem = {
            id: prod.id,
            so_number: prod.so_number,
            product_id: prod.product_id,
            order_qty: prod.order_qty,
            sales_price: prod.sales_price,
            created_by: prod.created_by,
            created_date: prod.created_date,
            modified_by: prod.modified_by,
            modified_date: prod.modified_date,
            fitting_charge: prod.fitting_charge,
            delivery_type: prod.delivery_type,
            discount: prod.discount,
            net_amount: prod.net_amount,
            mrp: maxMrp._max.mrp,
            selling_price: maxMrp._min.selling_price,
            product_name: prod.product_master.product_name,
            color: prod.product_master.color,
            color_family: prod.product_master.color_family,
            batch: batchIds,
            product_accessory: [],
            sum: 0,
          };

          if (
            prod.delivery_type == "Boxed" ||
            prod.delivery_type == "boxed" ||
            prod.delivery_type == "Fitted" ||
            prod.delivery_type == "fitted"
          ) {
            const sales_list_accessory =
              await prisma.sales_list_accessories.findMany({
                where: {
                  so_number: sales_id,
                  parent_product_id: prod.product_id,
                },
                include: {
                  product_master_sales_list_accessories_product_idToproduct_master:
                    {
                      select: {
                        product_id: true,
                        product_name: true,
                        color: true,
                        color_family: true,
                      },
                    },
                },
              });

            for (let j = 0; j < sales_list_accessory.length; j++) {
              let accessory = sales_list_accessory[j];
              accessory.product_name =
                accessory.product_master_sales_list_accessories_product_idToproduct_master.product_name;
              productItem.product_accessory.push(accessory);
            }
          }
          products.push(productItem);
          // Calculate the sum as (accessory.qty) * (accessory.sales_price)
          productItem.sum = productItem.product_accessory.reduce(
            (acc, accessory) => {
              const calc = acc + accessory.order_qty * accessory.sales_price;
              return calc;
            },
            0
          );
          productItem.sum = productItem.sum + productItem.fitting_charge;
        }
        productData.products = products;
        response.status(200).json(productData);
      } else {
        logger.error(`sales_id is undefined in respond_details api`);
        response.status(400).json({ message: "sales_id is not defined" });
      }
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in respond_details api`
    );
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

///////////quotation- placing or rejecting by customer////////
const confirm_salesorder = async (request, response) => {
  // const usertype=request.user.userType
  try {
    // if(usertype==="CUS"){
    const sales_id = request.body.sales_id;
    const so_status = request.body.so_status;
    const remarks = request.body.remarks;
    const currentDate = new Date();
    const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
    const istDate = new Date(currentDate.getTime() + istOffset);
    if (sales_id && so_status) {
      const userdata = await prisma.sales_order_new.findFirst({
        where: {
          sales_id: sales_id,
        },
        select: {
          users: true,
          so_number: true,
          total_amount: true,
        },
      });
      const total_amount = userdata.total_amount;
      if (so_status === "placed") {
        const sales_list = await prisma.sales_list.findMany({
          where: {
            so_number: sales_id,
          },
        });

        let taskStatus = "forpacking";
        for (i = 0; i < sales_list.length; i++) {
          const batch = sales_list[i].batch;
          const delivery_type = sales_list[i].delivery_type;
          if (delivery_type === "Fitted" || delivery_type === "fitted") {
            taskStatus = "forfitting";
          }
          for (j = 0; j < batch.length; j++) {
            const inv_id = batch[j].INVENTORY_id;
            const deductedQty = batch[j].deductedQty;
            const inventorydata = await prisma.inventory.findFirst({
              where: {
                INVENTORY_id: inv_id,
              },
              select: {
                blocked_quantity: true,
                total_quantity: true,
              },
            });
            const inventory = await prisma.inventory.update({
              where: {
                INVENTORY_id: inv_id,
              },
              data: {
                blocked_quantity: inventorydata.blocked_quantity - deductedQty,
              },
            });
          }
        }

        const confirm = await prisma.sales_order_new.update({
          where: {
            sales_id: sales_id,
          },
          data: {
            so_status: taskStatus,
            remarks: remarks,
            updated_date: istDate,
          },
        });

        const transaction = await prisma.transaction.aggregate({
          where: {
            customer_id: userdata.users.id,
          },
          _sum: {
            amount: true,
          },
        });
        const wallet_amt = transaction?._sum.amount;
        if (wallet_amt) {
          let amount;
          if (total_amount >= wallet_amt) {
            amount = wallet_amt;
          } else {
            amount = total_amount;
          }

          const transactio = await prisma.transaction.create({
            data: {
              customer_id: userdata.users.id,
              amount: -amount,
              sales_id: sales_id,
              // return_id: req_id,
              created_date: istDate,
              // created_by,
            },
          });
          const existing_payment_id = await prisma.so_payment.findMany({});
          const month = ("0" + (istDate.getMonth() + 1)).slice(-2);
          const new_user_id = existing_payment_id.length + 1;
          const payment_id =
            istDate.getFullYear() + month + ("000000" + new_user_id).slice(-6);
          const payment = await prisma.so_payment.create({
            data: {
              payment_id: payment_id,
              created_by: userdata.users.id,
              amount: parseInt(amount),
              sales_id: sales_id,
              mode: "wallet",
              created_date: istDate,
              // received_by
            },
          });
        }
        const respText = `sales order ${so_status} successfully`;
        const notification_text = `The  customer ${userdata.users.user_name} has ${so_status} sales order successfully`;
        const notification = await prisma.adm_notification.create({
          data: {
            text: notification_text,
            sender: userdata.users.id,
            read: "N",
            type: "CO", ////////confirm_order
            created_date: istDate,
            // created_by:customer_id
            verification_id: userdata.so_number,
          },
        });
        response.status(201).json({
          success: true,
          message: respText,
        });
      } else if (so_status === "quote_rejected") {
        const confirm = await prisma.sales_order_new.update({
          where: {
            sales_id: sales_id,
          },
          data: {
            so_status: so_status,
            remarks: remarks,
            updated_date: istDate,
          },
        });
        const respText = `sales order ${so_status} successfully`;
        const notification_text = `The  customer ${userdata.users.user_name} has ${so_status} sales order successfully`;
        const notification = await prisma.adm_notification.create({
          data: {
            text: notification_text,
            sender: userdata.users.id,
            read: "N",
            type: "CO", ////////confirm_order
            created_date: istDate,
            // created_by:customer_id
            verification_id: userdata.so_number,
          },
        });
        response.status(201).json({
          success: true,
          message: respText,
        });
      }
    } else {
      logger.error(
        `sales_id and so_status are mandatory in confirm_salesorder api`
      );
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in confirm_salesorder api`
    );
  } finally {
    await prisma.$disconnect();
  }
};

const closed_salesorder = async (request, response) => {
  try {
    console.log("closedddd", request.body);
    const sales_id = request.body.sales_id;
    const so_status = request.body.so_status;
    const remarks = request.body.remarks;
    const currentDate = new Date();
    const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
    const istDate = new Date(currentDate.getTime() + istOffset);

    if (sales_id && so_status === "closed") {
      const confirm = await prisma.sales_order_new.update({
        where: {
          sales_id: sales_id,
        },
        data: {
          so_status: so_status,
          remarks: remarks,
          updated_date: istDate,
        },
      });

      const userdata = await prisma.sales_order_new.findFirst({
        where: {
          sales_id: sales_id,
        },
        select: {
          users: true,
          so_number: true,
        },
      });

      const sales_list = await prisma.sales_list.findMany({
        where: {
          so_number: sales_id,
        },
      });

      for (let i = 0; i < sales_list.length; i++) {
        const batch = sales_list[i]?.batch;
        if (batch != null) {
          for (let j = 0; j < batch.length; j++) {
            const inv_id = batch[j].INVENTORY_id;
            const deductedQty = batch[j].deductedQty;

            const inventorydata = await prisma.inventory.findFirst({
              where: {
                INVENTORY_id: inv_id,
              },
              select: {
                blocked_quantity: true,
                total_quantity: true,
              },
            });

            const inventory = await prisma.inventory.update({
              where: {
                INVENTORY_id: inv_id,
              },
              data: {
                blocked_quantity: inventorydata.blocked_quantity - deductedQty,
                total_quantity: inventorydata.total_quantity + deductedQty,
              },
            });
          }
        }
      }

      const respText = `sales order ${so_status} successfully`;
      const notification_text = `The  sales order ${userdata.so_number} has been successfully ${so_status}.`;
      const notification = await prisma.cus_notification.create({
        data: {
          text: notification_text,
          receiver: userdata.users.id,
          read: "N",
          type: "CO", ////////////confirm_order
          created_date: istDate,
          verification_id: userdata.so_number,
        },
      });

      response.status(201).json({
        success: true,
        message: respText,
      });
    } else {
      logger.error(
        `sales_id and so_status are mandatory in confirm_salesorder api`
      );
      response.status(400).json({
        error: true,
        message: "sales_id and so_status are mandatory",
      });
    }
  } catch (error) {
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const placed_details = async (request, response) => {
  console.log("placed_details");
  // const usertype=request.user.userType
  try {
    // if(usertype==="ADM" || usertype==="SU"){
    const sales_id = request.body.sales_id;
    if (sales_id) {
      let productDataArray = [];
      let productsArray = [];
      let access = [];
      let net_amount = 0;
      const sales_orders = await prisma.sales_order_new.findFirst({
        where: {
          sales_id: sales_id,
        },
        select: {
          sales_id: true,
          so_number: true,
          so_notes: true,
          quote_document_link1: true,
          so_status: true,
          remarks: true,
          delivery_date: true,
          discount: true,
          updated_date: true,
          total_amount: true,
          users: {
            select: {
              user_id: true,
              user_name: true,
            },
          },
        },
      });
      productDataArray.push({
        so_number: sales_orders.so_number,
        so_notes: sales_orders.so_notes,
        user_id: sales_orders.users.user_id,
        user_name: sales_orders.users.user_name,
        sales_id: sales_orders.sales_id,
        so_status: sales_orders.so_status,
        remarks: sales_orders.remarks,
        delivery_date: sales_orders.delivery_date,
        discount: sales_orders.discount,
        updated_date: sales_orders.updated_date,
        total_amount: sales_orders.total_amount,
      });

      const sales_list = await prisma.sales_list.findMany({
        where: {
          so_number: sales_id,
        },
      });

      for (let i = 0; i < sales_list.length; i++) {
        const prod = sales_list[i];

        if (prod.product_id !== null) {
          const maxMrp = await prisma.inventory.aggregate({
            _max: {
              mrp: true,
            },
            _min: {
              selling_price: true,
            },
            _sum: {
              total_quantity: true,
            },
            where: {
              prod_id: prod.product_id,
            },
          });
          const productTypeResult = await prisma.product_master.findFirst({
            where: {
              product_id: prod.product_id,
            },
            select: {
              product_type: true,
              product_name: true,
              manufacturer_code: true,
              color_family: true,
              package: true,
              color: true,
              no_of_items: true,
              gst_perc: true,
            },
          });

          if (productTypeResult) {
            productsArray.push({
              product_id: prod.product_id,
              qty: prod.order_qty,
              selecttype: prod.delivery_type,
              prod_type: productTypeResult.product_type,
              product_name: productTypeResult.product_name,
              color_family: productTypeResult.color_family,
              color: productTypeResult.color,
              package: productTypeResult.package,
              no_of_items: productTypeResult.no_of_items,
              total_quantity: maxMrp._sum.total_quantity,
              mrp: maxMrp._max.mrp,
              original_price: maxMrp._min.selling_price,
              net_amount: sales_list[i].net_amount,
              discount: sales_list[i].discount,
              delivery_type: sales_list[i].delivery_type,
              fitting_charge: sales_list[i].fitting_charge,
              selling_price: sales_list[i].sales_price,
              modified_date: sales_list[i].modified_date,
              order_qty: sales_list[i].order_qty,
              created_date: sales_list[i].created_date,
              created_by: sales_list[i].created_by,
              modified_by: sales_list[i].modified_by,
            });
          }
        }
        const sales_list_accessories =
          await prisma.sales_list_accessories.findMany({
            where: {
              so_number: sales_id,
              parent_product_id: prod.product_id,
            },
            include: {
              product_master_sales_list_accessories_product_idToproduct_master:
                {
                  select: {
                    product_id: true,
                    product_name: true,
                    color: true,
                    color_family: true,
                  },
                },
            },
          });
        productDataArray[0].products = productsArray;

        for (let j = 0; j < sales_list_accessories.length; j++) {
          let accessory = sales_list_accessories[j];
          accessory.product_name =
            accessory.product_master_sales_list_accessories_product_idToproduct_master.product_name;
          if (accessory.parent_product_id === prod.product_id) {
            access.push(accessory);

            productDataArray[0].products[i].access = access;
            productDataArray[0].products[i].accessory_total = net_amount;
            net_amount += parseInt(accessory.net_amt);
          }
        }
      }
      response.status(200).json(productDataArray);
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in placed_details api`
    );
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const placed = async (request, response) => {
  // const usertype=request.user.userType
  try {
    // if(usertype==="ADM" || usertype==="SU"){
    const sales_id = request.body.sales_id;
    const productData = {};
    if (sales_id) {
      const sales_orders = await prisma.sales_order_new.findFirst({
        where: {
          sales_id: sales_id,
        },
        include: {
          users: {
            select: {
              user_id: true,
              user_name: true,
              mobile: true,
              email: true,
              address: true,
            },
          },
        },
      });

      productData.sales_id = sales_orders.sales_id;
      productData.so_number = sales_orders.so_number;
      productData.total_amount = sales_orders.total_amount;
      productData.quote_document_link1 = sales_orders.quote_document_link1;
      productData.so_status = sales_orders.so_status;
      productData.remarks = sales_orders.remarks;
      productData.delivery_date = sales_orders.delivery_date;
      productData.created_by = sales_orders.created_by;
      productData.created_date = sales_orders.created_date;
      productData.updated_by = sales_orders.updated_by;
      productData.updated_date = sales_orders.updated_date;
      productData.discount = sales_orders.discount;
      productData.logistics_id = sales_orders.logistics_id;
      productData.so_notes = sales_orders.so_notes;
      productData.customer_id = sales_orders.customer_id;
      productData.mobile = sales_orders.users.mobile;
      productData.user_name = sales_orders.users.user_name;
      productData.user_id = sales_orders.users.user_id;
      productData.address = sales_orders.users.address;

      const products = [];
      const sales_list = await prisma.sales_list.findMany({
        where: {
          so_number: sales_id,
        },
        include: {
          product_master: {
            select: {
              product_id: true,
              product_name: true,
              color: true,
              color_family: true,
              product_type: true,
              no_of_items: true,
              package: true,
            },
          },
        },
      });

      for (let i = 0; i < sales_list.length; i++) {
        const prod = sales_list[i];
        const maxMrp = await prisma.inventory.aggregate({
          _max: {
            mrp: true,
          },
          _min: {
            selling_price: true,
          },
          where: {
            prod_id: prod.product_id,
          },
        });

        const productItem = {
          id: prod.id,
          so_number: prod.so_number,
          product_id: prod.product_id,
          qty: prod.order_qty,
          sales_price: prod.sales_price,
          created_by: prod.created_by,
          created_date: prod.created_date,
          modified_by: prod.modified_by,
          modified_date: prod.modified_date,
          fitting_charge: prod.fitting_charge,
          delivery_type: prod.delivery_type,
          selecttype: prod.delivery_type,
          discount: prod.discount,
          net_amount: prod.net_amount,
          mrp: maxMrp._max.mrp,
          selling_price: maxMrp._min.selling_price,
          product_name: prod.product_master.product_name,
          prod_type: prod.product_master.product_type,
          no_of_items: prod.product_master.no_of_items,
          package: prod.product_master.package,
          color: prod.product_master.color,
          color_family: prod.product_master.color_family,
          access: [],
          accessory_total: 0, // Initialize with 0
        };

        if (
          prod.delivery_type == "Boxed" ||
          prod.delivery_type == "boxed" ||
          prod.delivery_type == "fitted" ||
          prod.delivery_type == "Fitted"
        ) {
          const sales_list_accessory =
            await prisma.sales_list_accessories.findMany({
              where: {
                so_number: sales_id,
                parent_product_id: prod.product_id,
              },
              include: {
                product_master_sales_list_accessories_product_idToproduct_master:
                  {
                    select: {
                      product_id: true,
                      product_name: true,
                      color: true,
                      color_family: true,
                    },
                  },
              },
            });

          for (let j = 0; j < sales_list_accessory.length; j++) {
            let accessory = sales_list_accessory[j];
            accessory.product_name =
              accessory.product_master_sales_list_accessories_product_idToproduct_master.product_name;
            productItem.access.push(accessory);
          }
        }
        products.push(productItem);
        productItem.accessory_total = productItem.access.reduce(
          (acc, accessory) => {
            return acc + parseInt(accessory.net_amt);
          },
          0
        );
      }
      productData.products = products;
      response.status(200).json(productData);
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in placed api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

////////////to calculate total_amount,total_salesorders,total_paid_amount and total_pending_payment of sales_orders in a month//////////

const order_fulfilled = async (request, response) => {
  // const usertype=request.user.userType
  try {
    // if(usertype==="ADM" || usertype==="SU"){
    const distinctMonths = await prisma.$queryRaw`
      SELECT TO_CHAR(so.created_date, 'YYYY-MM') as month, 
             COUNT(so.sales_id) as count,
             COALESCE(SUM(CAST(sp.amount AS DECIMAL)), 0) as paid_amount
      FROM sales_order_new so
      LEFT JOIN so_payment sp ON so.sales_id = sp.sales_id
      GROUP BY month
      ORDER BY month DESC
    `;

    const monthlySums = await Promise.all(
      distinctMonths.map(async (month) => {
        const startOfMonth = new Date(month.month);
        const endOfMonth = new Date(startOfMonth);
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);

        const sum = await prisma.sales_order_new.aggregate({
          _count: {
            sales_id: true,
          },
          _sum: {
            total_amount: true,
          },
          where: {
            created_date: {
              gte: startOfMonth.toISOString(),
              lt: endOfMonth.toISOString(),
            },
            so_status: "placed",
          },
          orderBy: {
            created_date: "desc",
          },
        });

        // Format the month to its string representation
        const formattedMonth = format(new Date(month.month), "yyyy MMMM");

        // Convert the total_amount
        const roundedTotalAmount = parseFloat(
          sum._sum.total_amount || 0
        ).toFixed(2);

        // Convert the paid_amount
        const remainingAmount = (
          roundedTotalAmount - parseFloat(month.paid_amount || 0)
        ).toFixed(2);

        return {
          month: formattedMonth,
          total_amount: roundedTotalAmount,
          paid_amount: parseFloat(month.paid_amount || 0).toFixed(2),
          remaining_amount: remainingAmount,
          total_salesorders: sum._count.sales_id || 0,
        };
      })
    );

    response.status(200).json(monthlySums);
    // }
    // else{
    //   logger.error(`Unauthorized- in purchaseOrders api`);
    //   return response
    //     .status(403)
    //     .json({ message: "Unauthorized. You are not an admin" });
    // }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in order_fulfilled api`
    );
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

///changing draft to confirm
const update_salesorder = async (request, response) => {
  // const usertype=request.user.userType
  console.log("request data to updteee>", JSON.stringify(request.body));
  try {
    // if(usertype==="ADM" || usertype==="SU"){}
    const sales_id = request.body.sales_id;
    const total_amt = request.body.total;
    const total_discount = request.body.disc;
    const quotation_link = request.body.doclink;
    const so_status = request.body.so_status;
    const remarks = request.body.remarks;
    const created_by = request.body.user;
    const so_notes = request.body.notes;
    const prod_list = request.body.products;
    const today = new Date();
    const customer_id = request.body.customer_id;
    const user = await prisma.users.findFirst({
      where: {
        id: customer_id,
      },
      select: {
        id: true,
        user_id: true,
        sup_code: true,
        user_name: true,
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

    const prod_final_array = prod_list.map((prod) => {
      const matchedProduct = products.find(
        (p) => p.product_id === prod.prod_id
      );
      return {
        prod_id: matchedProduct.product_id,
        qty: prod.qty,
        amt: prod.amt,
      };
    });

    await prisma.sales_order_new.updateMany({
      where: {
        sales_id: sales_id,
      },
      data: {
        total_amount: total_amt,
        quote_document_link1: quotation_link,
        delivery_date,
        so_status: so_status,
        so_notes: so_notes,
        remarks: remarks,
        updated_by,
        updated_date: today,
        customer_id: customer_id,
        discount: total_discount,
      },
    });
    if (sales_id) {
      await prisma.sales_list.deleteMany({
        where: {
          sales_id: sales_id,
        },
      });

      // Create rows in the purchase_list table for each product in the products array
      await Promise.all(
        prod_final_array.map((prod) =>
          prisma.sales_list.create({
            data: {
              sales_id: sales_id,
              product_id: prod.prod_id,
              order_qty: parseInt(prod.qty),
              sales_price,
              fitting_charge,
              delivery_type,
              discount,
              net_amount,
              batch,
              created_by: created_by,
              created_date: today,
              modified_by: created_by,
              modified_date: today,
            },
          })
        )
      );

      await prisma.sales_list_accessories.deleteMany({
        where: {
          so_number: sales_id,
        },
      });

      for (let j = 0; j < productAccessories.length; j++) {
        const accessory = productAccessories[j];

        const inventoryaccessories = await prisma.inventory.findMany({
          where: {
            prod_id: accessory.prod_id,
          },
          select: {
            batch_id: true,
            total_quantity: true,
            INVENTORY_id: true,
            blocked_quantity: true,
          },
          orderBy: {
            INVENTORY_id: "asc",
          },
        });
        let accqty = accessory.qty;

        for (l = 0; l < inventoryaccessories.length; l++) {
          const prodinv = inventoryaccessories[l].INVENTORY_id;
          let totalqt = inventoryaccessories[l].total_quantity;
          const batch = inventoryaccessories[l].batch_id;
          const blkquantity = inventoryaccessories[l].blocked_quantity;
          if (sl_order.so_status === "requested_quote") {
            if (totalqt > 0 && accqty > 0) {
              if (accqty >= totalqt) {
                accqty -= totalqt;
                accessorydeductions.push({
                  INVENTORY_id: prodinv,
                  batch_id: batch,
                  deductedQty: totalqt,
                });
                totalqt = 0;
              } else {
                // If qty is less than totalqt, deduct qty from totalqt
                totalqt -= accqty;
                accessorydeductions.push({
                  INVENTORY_id: prodinv,
                  batch_id: batch,
                  deductedQty: qty,
                });
                accqty = 0;
              }

              const blk_qty = blkquantity !== null ? blkquantity : 0;
              const newBlockedQty =
                blk_qty +
                accessorydeductions[accessorydeductions.length - 1].deductedQty;

              const invupdate = await prisma.inventory.updateMany({
                where: {
                  INVENTORY_id: prodinv,
                },
                data: {
                  total_quantity: totalqt,
                  blocked_quantity: newBlockedQty,
                },
              });

              if (accqty === 0) {
                break;
              }
            }
          }
        }

        const qty = accessory?.qty || accessory?.order_qty;
        const price = accessory?.price || sales_price;
        const prod_id = accessory.prod_id || accessory.product_id;
        const accessories_create = await prisma.sales_list_accessories.create({
          data: {
            so_number: sales_id,
            parent_product_id: product.product_id,
            product_id: prod_id,
            order_qty: parseInt(qty),
            sales_price: parseInt(price),
            net_amt: accessory.ac_tl_Price,
            // created_by: created_by,
            created_date: updated_date,
          },
        });
      }

      const respText =
        so_status === "placed" || so_status === "draft" ? sales_id : "";
      const notification_text = `The customer ${user?.user_name} has ${so_status} sales order successfully`;

      const notification = await prisma.cus_notification.create({
        data: {
          text: notification_text,
          receiver: user.id,
          read: "N",
          type: "SO",
          created_date: today,
          verification_id: sales_id,
          // created_by:customer_id
        },
      });
      response.status(201).json(respText);
    }
    // }
    // else{
    //   logger.error(`Unauthorized- in update_purchaseorder api`);
    //   return response
    //     .status(403)
    //     .json({ message: "Unauthorized. You are not an admin" });
    // }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in update_purchaseorder api`
    );
  } finally {
    await prisma.$disconnect();
  }
};

module.exports = {
  newsalesOrder,
  salesOrders,
  viewcustomers,
  viewaccessories,
  productsale_list,
  getsalesProductDetails,
  viewquotation,
  sendquotation,
  quoted_details,
  quoted_salesorder,
  cus_quotation_response,
  respond_details,
  confirm_salesorder,
  placed_details,
  placed,
  closed_salesorder,
  order_fulfilled,
  update_salesorder,
};
