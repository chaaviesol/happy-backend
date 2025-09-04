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
const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
const istDate = new Date(currentDate.getTime() + istOffset);

const fitting = async (request, response) => {
  // console.log("fitting");
  const user_type = request.user.userType;
  const id = request.user.id;

  try {
    if (user_type === "ADM" && id) {
      const user_data = await prisma.users.findUnique({
        where: {
          id: id,
        },
      });
      // console.log("user_data",user_data)
      const departmt = await prisma.staff_users.findFirst({
        where: {
          user_id: user_data?.user_id,
        },
      });
      const department = departmt?.department;
      console.log("department===", department);
      let so_status = [];
      if (department === "fitting" || department === "Fitting") {
        so_status.push("forfitting");
      } else if (department === "packing" || department === "Packing") {
        so_status.push("fitted", "placed", "forpacking");
      } else if (department === "dispatch" || department === "Dispatch") {
        so_status.push("packed");
      }
      console.log("so_status", so_status);
      const forfitting = await prisma.sales_order_new.findMany({
        where: {
          so_status: {
            in: so_status,
          },
        },
        orderBy: {
          sales_id: "asc",
        },
      });
      response.status(200).json({
        error: false,
        success: true,
        message: "successfull",
        data: forfitting,
      });
    } else {
      logger.error(`An error occurred: ${error.message} in fitting api`);
      response.status(400).json({
        error: true,
        success: false,
        message: "internal server error",
      });
    }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in fitting api`);
    response.status(400).json({
      error: true,
      success: false,
      message: "internal server error",
    });
  } finally {
    await prisma.$disconnect();
  }
};

const fitted = async (request, response) => {
  const user_type = request.user.userType;
  console.log("fitted", request.body);
  try {
    if (user_type === "ADM") {
      const status = request.body.status;
      const staff_id = request.user.id;
      const sales_id = request.body.sales_id;
      if (status && staff_id && sales_id) {
        const sales_order = await prisma.sales_order_new.update({
          where: {
            sales_id: sales_id,
          },
          data: {
            so_status: status,
          },
        });
        console.log("sales_order", sales_order);
        const sales_order_data = await prisma.sales_order_new.findFirst({
          where: {
            sales_id: sales_id,
          },
        });
        const adm_id = await prisma.users.findUnique({
          where: {
            id: staff_id,
          },
        });
        const staffid = await prisma.staff_users.findFirst({
          where: {
            user_id: adm_id.user_id,
          },
        });
        const complete_task = await prisma.completed_tasks.create({
          data: {
            task_id: sales_id,
            staff_id: staffid.id,
            created_date: istDate,
          },
        });
        const notification = await prisma.adm_notification.create({
          data: {
            text: ` A new Sales order ${sales_order_data.so_number} added to your tasklist`,
            //   sender: 2,
            read: "N",
            type: "FP",
            created_date: istDate,
            verification_id: sales_order_data.so_number,
          },
        });
        const cus_notification = await prisma.cus_notification.create({
          data: {
            text: `Your Sales order ${sales_order_data.so_number} has been fitted `,
            receiver: sales_order_data.customer_id,
            read: "N",
            type: "FC",
            created_date: istDate,
            verification_id: sales_order_data.so_number,
          },
        });

        response.status(200).json({
          error: false,
          success: true,
          message: "successfull",
          data: complete_task,
        });
      } else {
        logger.error(`status && staff_id && sales_id are mandatory fields`);
      }
    } else {
      logger.error(`An error occurred: ${error.message} in fitted api`);
      response.status(400).json({
        error: true,
        success: false,
        message: "internal server error",
      });
    }
  } catch (error) {
    console.log(error);
    logger.error(`An error occurred: ${error.message} in fitted api`);
    response.status(400).json({
      error: true,
      success: false,
      message: "internal server error",
    });
  } finally {
    await prisma.$disconnect();
  }
};
////
const packing = async (request, response) => {
  console.log("packing");
  const user_type = request.user.userType;
  try {
    if (user_type === "ADM") {
      const packing = await prisma.sales_order_new.findMany({
        where: {
          so_status: {
            in: ["fitted", "placed"],
          },
        },
        orderBy: {
          sales_id: "asc",
        },
      });
      response.status(200).json({
        error: false,
        success: true,
        message: "successfull",
        data: packing,
      });
    } else {
      logger.error(`An error occurred: ${error.message} in packing api`);
      response.status(400).json({
        error: true,
        success: false,
        message: "internal server error",
      });
    }
  } catch (error) {
    console.log(error);
    logger.error(`An error occurred: ${error.message} in packing api`);
    response.status(400).json({
      error: true,
      success: false,
      message: "internal server error",
    });
  } finally {
    await prisma.$disconnect();
  }
};

const packed = async (request, response) => {
  console.log("packedd==", request.body);
  const user_type = request.user.userType;
  try {
    if (user_type === "ADM" || user_type === "SU") {
      const status = request.body.status;
      const staff_id = request.user.id;
      const sales_id = request.body.sales_id;
      if (status && staff_id && sales_id) {
        const sales_order = await prisma.sales_order_new.update({
          where: {
            sales_id: sales_id,
          },
          data: {
            so_status: status,
          },
        });
        const sales_order_data = await prisma.sales_order_new.findFirst({
          where: {
            sales_id: sales_id,
          },
        });
        const adm_id = await prisma.users.findUnique({
          where: {
            id: staff_id,
          },
        });
        const staffid = await prisma.staff_users.findFirst({
          where: {
            user_id: adm_id.user_id,
          },
        });
        const complete_task = await prisma.completed_tasks.create({
          data: {
            task_id: sales_id,
            staff_id: staffid.id,
            created_date: istDate,
          },
        });
        const notification = await prisma.adm_notification.create({
          data: {
            text: ` A new Sales order ${sales_order_data.so_number} added to your tasklist`,
            //   sender: 2,
            read: "N",
            type: "FD",
            created_date: istDate,
            verification_id: sales_order_data.so_number,
          },
        });
        const cus_notification = await prisma.cus_notification.create({
          data: {
            text: `Your Sales order ${sales_order_data.so_number} has been packed `,
            receiver: sales_order_data.customer_id,
            read: "N",
            type: "PC",
            created_date: istDate,
            verification_id: sales_order_data.so_number,
          },
        });
        response.status(200).json({
          error: false,
          success: true,
          message: "successfull",
          data: complete_task,
        });
      } else {
        logger.error(`status && staff_id && sales_id are mandatory fields`);
      }
    } else {
      logger.error(`An error occurred: ${error.message} in packed api`);
      response.status(400).json({
        error: true,
        success: false,
        message: "internal server error",
      });
    }
  } catch (error) {
    console.log(error);
    logger.error(`An error occurred: ${error.message} in packed api`);
    response.status(400).json({
      error: true,
      success: false,
      message: "internal server error",
    });
  } finally {
    await prisma.$disconnect();
  }
};
/////////////////list of which are to be dispatched//////
const dispatch = async (request, response) => {
  console.log("dispatchhhhhhhhhh", request.user.userType);
  const user_type = request.user.userType;
  try {
    if (user_type == "ADM") {
      const packed = await prisma.sales_order_new.findMany({
        where: {
          so_status: "packed",
        },
        orderBy: {
          sales_id: "asc",
        },
      });
      response.status(200).json({
        error: false,
        success: true,
        message: "successfull",
        data: packed,
      });
    } else {
      logger.error(`An error occurred: ${error.message} in dispatch api`);
      response.status(400).json({
        error: true,
        success: false,
        message: "internal server error",
      });
    }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in dispatch api`);
    response.status(400).json({
      error: true,
      success: false,
      message: "internal server error",
    });
  } finally {
    await prisma.$disconnect();
  }
};

const dispatched = async (request, response) => {
  console.log("dispatched===>>", request.bdoy);
  const user_type = request.user.userType;
  const sales_id = request.body.sales_id;
  try {
    if (user_type === "ADM") {
      const dispatch = await prisma.sales_order_new.update({
        where: {
          sales_id: sales_id,
        },
        data: {
          so_status: "dispatched",
        },
      });
      const sales_order = await prisma.sales_order_new.findFirst({
        where: {
          sales_id: sales_id,
        },
      });
      const notification = await prisma.adm_notification.create({
        data: {
          text: ` A new Sales order ${sales_order.so_number} added to your tasklist`,
          //   sender: 2,
          read: "N",
          type: "DS",
          created_date: istDate,
          verification_id: sales_order.so_number,
        },
      });
      const cus_notification = await prisma.cus_notification.create({
        data: {
          text: `Your Sales order ${sales_order.so_number} has been packed `,
          receiver: sales_order.customer_id,
          read: "N",
          type: "DS", //from DC
          created_date: istDate,
          verification_id: sales_order.so_number,
        },
      });
      console.log("cus_notification", notification, cus_notification);
      response.status(200).json({
        error: false,
        success: true,
        message: "successfull",
        data: dispatch,
      });
    } else {
      logger.error(`An error occurred: ${error.message} in dispatched api`);
      response.status(400).json({
        error: true,
        success: false,
        message: "internal server error",
      });
    }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in dispatched api`);
    response.status(400).json({
      error: true,
      success: false,
      message: "internal server error",
    });
  } finally {
    await prisma.$disconnect();
  }
};

///////////////////////dispatch-sales_orders\\\\\\\\\\\\\\\\\\\\\\\\\\
const dispatched_list = async (request, response) => {
  const user_type = request.user.userType;
  try {
    if (user_type == "ADM") {
      const list = await prisma.sales_order_new.findMany({
        where: {
          so_status: "dispatched",
        },
      });
      response.status(200).json({
        error: false,
        success: true,
        data: list,
      });
    } else {
      logger.error(`Unauthorized- in dispatched_list api`);
      return response
        .status(403)
        .json({ message: "Unauthorised--You are not an admin" });
    }
  } catch (error) {
    console.log(error);
    logger.error(`An error occured: ${error.message} in dispatched_list api`);
    response.status(400).json({
      error: true,
      success: false,
      message: "internal server error",
    });
  } finally {
    await prisma.$disconnect();
  }
};

//////////////////history of a sales_order///////
const history = async (request, response) => {
  console.log(request.body);
  const sales_id = request.body.sales_id;
  try {
    const data = await prisma.sales_order_new.findFirst({
      where: {
        sales_id: sales_id,
      },
    });
    const sales_list = await prisma.sales_list.findMany({
      where: {
        so_number: sales_id,
      },
    });

    const isForFitting = sales_list.some(
      (item) => item.delivery_type === "Fitted"
    );
    let A = [];
    if (isForFitting) {
      A = [
        "Placed",
        "For fitting",
        "Fitted",
        "For packing",
        "Packed",
        "Dispatched",
      ];
    } else {
      A = ["Placed", "For packing", "Packed", "Dispatched"];
    }
    let statusDetails = [];
    if (data && data.so_status === "dispatched") {
      if (isForFitting) {
        statusDetails = [
          "Placed",
          "For fitting",
          "Fitted",
          "For packing",
          "Packed",
          "Dispatched",
        ].map((status) => ({
          status,
          tick: true,
        }));
      } else {
        statusDetails = ["Placed", "For packing", "Packed", "Dispatched"].map(
          (status) => ({
            status,
            tick: true,
          })
        );
      }
    } else if (data && data.so_status === "packed") {
      if (isForFitting) {
        statusDetails = [
          "Placed",
          "For fitting",
          "Fitted",
          "For packing",
          "Packed",
        ].map((status) => ({
          status,
          tick: true,
        }));
      } else {
        statusDetails = ["Placed", "For packing", "Packed"].map((status) => ({
          status,
          tick: true,
        }));
      }
    } else if (data && data.so_status === "forpacking") {
      if (isForFitting) {
        statusDetails = ["Placed", "For fitting", "Fitted", "For packing"].map(
          (status) => ({
            status,
            tick: true,
          })
        );
      } else {
        statusDetails = ["Placed", "For packing"].map((status) => ({
          status,
          tick: true,
        }));
      }
    } else if (data && data.so_status === "fitted") {
      statusDetails = ["Placed", "For fitting", "Fitted"].map((status) => ({
        status,
        tick: true,
      }));
    } else if (data && data.so_status === "forfitting") {
      statusDetails = ["Placed", "For fitting"].map((status) => ({
        status,
        tick: true,
      }));
    } else if (data && data.so_status === "placed") {
      statusDetails = ["Placed"].map((status) => ({
        status,
        tick: true,
      }));
    }
    response.status(200).json({
      error: false,
      success: true,
      data: {
        ...data,
        A,
        statusDetails,
      },
    });
  } catch (error) {
    console.log(error);
    logger.error(`An error occured: ${error.message} in history api`);
    response.status(400).json({
      error: true,
      success: false,
      message: "internal server error",
    });
  }finally {
    await prisma.$disconnect();
  }
};

module.exports = {
  fitting,
  packing,
  fitted,
  packed,
  dispatch,
  dispatched,
  dispatched_list,
  history,
};
