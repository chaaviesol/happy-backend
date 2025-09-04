const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const winston = require('winston');
const fs = require('fs');

// logs directory 
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
const created_date = new Date(currentDate.getTime() + istOffset);
////////////////////////////////////////////////////////////////////

const po_payment = async (request, response) => {
  try {
    const usertype = request.user.userType
    if (usertype === "SU" || usertype === "ADM") {
      const total_amount = parseInt(request.body.tl_amt);
      const purchase_id = request.body.purchase_id;
      const created_by = request.body.logged_id;
      const credited_to = request.body.credited_to;
      const mode = request.body.mode;
      const currentDate = new Date();
      const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
      const created_date = new Date(currentDate.getTime() + istOffset);
      const purchase_total = await prisma.purchase_order.findUnique({
        where: {
          purchase_id: purchase_id
        },
        select: {
          total_amount: true
        }
      })
      const po_paymt = await prisma.po_payment.aggregate({
        where: {
          purchase_id: purchase_id
        },
        _sum: {
          amount: true
        }
      })
      const paidamount = po_paymt._sum.amount
      const p_tl = purchase_total.total_amount
      const balance_amtt = p_tl - paidamount
      if (total_amount <= balance_amtt) {
        const existing_payment_id = await prisma.po_payment.findMany({});
        const month = ("0" + (created_date.getMonth() + 1)).slice(-2);
        const new_user_id = existing_payment_id.length + 1;
        const payment_id =
          created_date.getFullYear() + month + ("000000" + new_user_id).slice(-6);

        if (payment_id && total_amount && purchase_id && mode) {
          const pay_create = await prisma.po_payment.create({
            data: {
              payment_id: payment_id,
              amount: total_amount,
              purchase_id: purchase_id,
              mode: mode,
              created_by: created_by,
              credited_to: credited_to,
              created_date,
            },
          });

          const respText = "successfully placed";
          response.status(200).json(respText);
        } else {
          const respText = "all fields are mandatory";
          response.status(200).json(respText);
          logger.error("all fields are mandatory in the po_payment api");
        }
      } else {
        return response
          .status(404)
          .json({ message: "The total amount to be paid should not exceed the total amount." });

      }
    }
    else {
      logger.error(`Unauthorized- in po_payment api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in po_payment api`);
  }finally {
    await prisma.$disconnect();
  }
};

const po_paymentlist = async (request, response) => {
  const usertype = request.user.userType
  try {
    if (usertype === "SU" || usertype === "ADM") {
      const payment = await prisma.po_payment.findMany({
        include: {
          purchase_order: true,
        },
      });
      response.status(200).json({ payment });
    }
    else {
      logger.error(`Unauthorized- in po_paymentlist api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    response.status(500).json({ error: "Internal server error" });
    logger.error(`Internal server error: ${error.message} in po_paymentlist api`);
  }finally {
    await prisma.$disconnect();
  }
};

const po_paymentdetails = async (request, response) => {
  const usertype = request.user.userType
  try {
    if (usertype === "SU" || usertype === "ADM") {
      const purchase_id = request.body.purchase_id;

      if (purchase_id) {
        const purchasedetails = await prisma.purchase_order.findUnique({
          where: {
            purchase_id: purchase_id,
          },
        });

        const paymentdetails = await prisma.po_payment.findMany({
          where: {
            purchase_id: purchase_id,
          },
          // include: {
          //   users: {
          //     select: {
          //       user_name: true,
          //     },
          //   },
          // },
        });

        let sumOfAmounts = 0;

        for (let i = 0; i < paymentdetails.length; i++) {
          const amount = paymentdetails[i].amount;
          //console.log("amount", amount);
          sumOfAmounts += amount;
        }

        const balance = purchasedetails.total_amount - sumOfAmounts;
        // if (balance == 0) {
        //   response.status(200).json({ message: "completed the payment" });
        // } else {
        response
          .status(200)
          .json({
            paymentdetails,
            po_number: purchasedetails.po_number,
            total_amount: purchasedetails.total_amount,
            balance_amt: balance,
          });
        // }
      }
      else {
        logger.error("purchase_id is mandatory in the po_paymentdetails api");
      }
    }
    else {
      logger.error(`Unauthorized- in po_paymentdetails api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    response.status(500).json({ error: "Internal server error" });
    logger.error(`Internal server error: ${error.message} in po_paymentdetails api`);
  }finally {
    await prisma.$disconnect();
  }
};

///////////////////////sales///////////////////////////

const so_payment = async (request, response) => {
  const usertype = request.user.userType
  try {
    if (usertype === "CUS" || usertype === "SU" || usertype === "ADM") {
      // const payment_id=request.body.payment_id
      const total_amount = parseInt(request.body.tl_amt);
      const sales_id = request.body.sales_id;
      const created_by = request.body.logged_id;
      const received_by = request.body.credited_to;
      const mode = request.body.mode;
      const currentDate = new Date();
      const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
      const created_date = new Date(currentDate.getTime() + istOffset);
      const sales_orders = await prisma.sales_order_new.findUnique({
        where: {
          sales_id: sales_id
        },
        select: {
          total_amount: true
        }
      })
      const soPaymentAggregate = await prisma.so_payment.aggregate({
        where: {
          sales_id: sales_id,
        },
        _sum: {
          amount: true,
        },
      });
      const totalAmountSum = soPaymentAggregate._sum.amount || 0;
      const balance_amt = sales_orders.total_amount - totalAmountSum
      if (total_amount <= balance_amt) {
        const existing_payment_id = await prisma.so_payment.findMany({});
        const month = ("0" + (created_date.getMonth() + 1)).slice(-2);
        const new_user_id = existing_payment_id.length + 1;
        const payment_id =
          created_date.getFullYear() + month + ("000000" + new_user_id).slice(-6);
        if (payment_id && total_amount && mode) {
          const pay_create = await prisma.so_payment.create({
            data: {
              payment_id: payment_id,
              amount: total_amount,
              sales_id,
              mode: mode,
              created_by: created_by,
              received_by: received_by,
              created_date,
            },
          });
          const respText = "successfully placed";
          response.status(200).json(respText);

        } else {
          const respText = "all fields are mandatory";
          response.status(200).json(respText);
          logger.error("all fields are mandatory in the so_payment api");
        }
      }
      else {
        return response
          .status(404)
          .json({ message: "The total amount to be paid should not exceed the total amount." });
      }
    }
    else {
      logger.error(`Unauthorized- in so_payment api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    console.log(error);
    response.status(500).json({ error: "Internal server error" });
    logger.error(`Internal server error: ${error.message} in so_payment api`);
  }finally {
    await prisma.$disconnect();
  }
};

const so_paymentdetails = async (request, response) => {
  const usertype = request.user.userType
  try {
    if (usertype === "CUS" || usertype === "SU" || usertype === "ADM") {
      const sales_id = request.body.sales_id;
      if (sales_id) {
        const salesdetails = await prisma.sales_order_new.findUnique({
          where: {
            sales_id: sales_id
          },
        });
        const paymentdetails = await prisma.so_payment.findMany({
          where: {
            sales_id: sales_id,
          },
          // include: {
          //   users: {
          //     select: {
          //       user_name: true,
          //     },
          //   },
          // },
        });

        let sumOfAmounts = 0;

        for (let i = 0; i < paymentdetails.length; i++) {
          const amount = paymentdetails[i].amount;
          sumOfAmounts += amount;
        }

        const balance = salesdetails.total_amount - sumOfAmounts;
        response
          .status(200)
          .json({
            paymentdetails,
            so_number: salesdetails.so_number,
            total_amount: salesdetails.total_amount,
            balance,
          });
      } else {
        logger.error(`sales_id is mandatory in so_paymentdetails`)
      }
    }
    else {
      logger.error(`Unauthorized- in so_paymentdetails api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    response.status(500).json({ error: "Internal server error" });
    logger.error(`Internal server error: ${error.message} in so_paymentdetails api`);
  }finally {
    await prisma.$disconnect();
  }
};

const sodirect_payment = async (request, response) => {
  try {
    const { sales_id, roundoff_disc, ispayment_completed, total_amount, mode, created_by, received_by } = request.body
    if (!sales_id || !total_amount || !mode) {
      return response.status(400).json({
        message: "required fields can't be null",
        error: true
      })
    }
    const existing_payment_id = await prisma.so_payment.findMany({});
    const month = ("0" + (created_date.getMonth() + 1)).slice(-2);
    const new_user_id = existing_payment_id.length + 1;
    const payment_id = created_date.getFullYear() + month + ("000000" + new_user_id).slice(-6);

    const pay_create = await prisma.so_payment.create({
      data: {
        payment_id: payment_id,
        amount: total_amount,
        sales_id,
        mode: mode,
        created_by: created_by,
        received_by: received_by,
        created_date,
      },
    });
    if (pay_create) {
      const salesorderupdate = await prisma.sales_order_new.update({
        where: {
          sales_id: sales_id
        },
        data: {
          roundoff_disc: roundoff_disc,
          ispayment_completed: ispayment_completed,
          updated_date: created_date
        }
      })
      const respText = "successfully placed";
      response.status(200).json({
        message: respText,
        success: true
      });
    }
  }
  catch (error) {
    console.log(error);
    response.status(500).json({ error: "Internal server error" });
    logger.error(`Internal server error: ${error.message} in sodirect_payment api`);
  }finally {
    await prisma.$disconnect();
  }
}

module.exports = {
  po_payment,
  po_paymentlist,
  po_paymentdetails,
  so_payment,
  so_paymentdetails,
  sodirect_payment
};
