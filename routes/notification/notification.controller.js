const { PrismaClient } = require("@prisma/client");
const { response } = require("express");
const prisma = new PrismaClient();
const winston = require('winston');
const fs = require('fs');

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

const getadm_notification = async (request, response) => {
  // console.log("jkjkjkjkjkjk",request.user)
  const usertype = request.user.userType
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const admin_notification = await prisma.adm_notification.findMany({
        orderBy: [
          {
            read: 'asc'
          },
          {
            created_date: 'desc'
          },
        ]
      })
      response.status(200).json({ admin_notification });
    }
    else {
      logger.error(`Unauthorized- in getadm_notification api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  }
  catch (error) {
    logger.error(`Internal server error- in adm_read_notification api`);
    response.status(500).json({ error: "Internal server error" })
  }finally {
    await prisma.$disconnect();
  }
}

const adm_read_notification = async (request, response) => {
  const usertype = request.user.userType
  console.log("adm_read_notification")
  try {
    if (usertype === "SU" || usertype === "ADM") {
      console.log("notifff", request.body);
      const id = request.body.id
      const verification_id = request.body.verification_id
      const currentDate = new Date();
      const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
      const istDate = new Date(currentDate.getTime() + istOffset);
      if (id) {
        const read_notification = await prisma.adm_notification.update({
          where: {
            id: id
          },
          data: {
            read: "Y",
            modified_date: istDate
          }
        })
        console.log({ read_notification })
        if (read_notification) {
          return response.status(200).json({
            message: "success",
            success: true
          });
        }
      }
      else {
        const read_notifictn = await prisma.adm_notification.update({
          data: {
            read: "Y",
            modified_date: istDate
          },
          where: {
            verification_id: verification_id
          }
        })
        return response.status(200).json({
          message: "success",
          success: true
        });
      }
    }
    else {
      logger.error(`Unauthorized- in adm_read_notification api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  }
  catch (error) {
    logger.error(`Internal server error- in adm_read_notification api`);
    response.status(500).json({ error: "Internal server error" });
  }finally {
    await prisma.$disconnect();
  }
}

const getcus_sup__notification = async (request, response) => {
  const usertype = request.user.userType
  try {
    if (usertype === "CUS" || usertype === "SUP") {
      const user_id = request.user.id
      const customer_notification = await prisma.cus_notification.findMany({
        where: {
          receiver: user_id,
        },
        orderBy: [
          {
            read: 'asc'
          },
          {
            created_date: 'desc'
          },
        ]
      })
      //console.log("customer_notification",customer_notification);
      return response.status(200).json({
        message: "success",
        success: true
      });
    }
    else {
      logger.error(`Unauthorized- in getcus_sup__notification api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not a customer" });
    }
  }
  catch (error) {
    logger.error(`Internal server error- in getcus_sup__notification api`);
    response.status(500).json({ error: "Internal server error" });
  }finally {
    await prisma.$disconnect();
  }
}

const cus_read_notification = async (request, response) => {
  const usertype = request.user.userType
  try {
    if (usertype === "CUS") {
      const id = request.body.id
      const currentDate = new Date();
      const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
      const istDate = new Date(currentDate.getTime() + istOffset);

      const read_notification = await prisma.cus_notification.update({
        data: {
          read: "Y",
          modified_date: istDate
        },
        where: {
          id: id
        }
      })
      return response.status(200).json({
        message: "success",
        success: true
      });
    }
    else {
      logger.error(`Unauthorized- in cus_read_notification api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not a customer" });
    }
  }
  catch (error) {
    logger.error(`Internal server error- in cus_read_notification api`);
    response.status(500).json({ error: "Internal server error" });
  }finally {
    await prisma.$disconnect();
  }
}


const notification_types = async (request, response) => {
  const usertype = request.user.userType
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const notifications = await prisma.adm_notification.findMany({
        orderBy: {
          id: "desc"
        }
      })
      const notificationsByType = {};

      notifications.forEach(notification => {
        const type = notification.type;
        if (!notificationsByType[type]) {
          notificationsByType[type] = [];
        }
        notificationsByType[type].push(notification);
      });

      response.status(200).json(notificationsByType);
    }
    else {
      logger.error(`Unauthorized- in notification_types api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(`Internal server error- in notification_types api`);
    response.status(500).json({ error: "Internal server error" });
  }finally {
    await prisma.$disconnect();
  }
}

///////////

const staff_notification = async (request, response) => {
  const user_id = request.body.staff_id
  const user_type = request.body.user_type
  const department = request.body.department
  try {
    if (user_type === "ADM" && department === "fitting") {
      const fitter_notification = await prisma.adm_notification.findMany({
        where: {
          type: "CO"
        }
      })
      return response.status(201).json({
        data: fitter_notification,
        message: "success",
        success: true
      });
    }
    else if (user_type === "ADM" && department === "packing") {
      const packer_notification = await prisma.adm_notification.findMany({
        where: {
          type: "FP"
        }
      })
      response.status(201).json({
        data: packer_notification,
        success: true
      });
    }
    else if (user_type === "ADM" && department === "dispatch") {
      const dispatched_notification = await prisma.adm_notification.findMany({
        where: {
          type: "FD"
        }
      })
      response.status(201).json({
        data: dispatched_notification,
        success: true
      });
    }

  }
  catch (error) {
    logger.error(`Internal server error- in staff_notification api`);
    response.status(500).json({ error: "Internal server error" });
  }finally {
    await prisma.$disconnect();
  }
}

const newstaffnotification = async (request, response) => {
  try {
    const array = [
      // { name: "Inventory", type: "Inventory" },
      // { name: "New Products", type: "NewProducts" },
      { name: "Product list", type: "PD" },
      // { name: "Category", type: "category" },
      // { name: "New User", type: "NewUser" },
      { name: "Worklist", type: ["PD", "UR"] },
      // { name: "Create PO", type: "PO" },
      { name: "PO list", type: "PO" },
      { name: "Supplier list", type: "UR" },
      { name: "Customer list", type: "UR" },
      // { name: "New sales order", type: "Newsalesorder" },
      { name: "SO list", type: "CO" },
      { name: "Quotation worklist", type: "OR" },
      { name: "Service & Return", type: ["RT", "SR"] },
      // { name: "Leave list", type: "leavelist" },
      // { name: "Staff claim", type: "staffclaim" },
      { name: "Task worklist", type: ["FC", "FP", "FD", "DS"] },
    ];
    
    const login_id = request.body.login_id;

    const user = await prisma.users.findUnique({
      where: {
        id: login_id
      }
    });

    const userid = await prisma.staff_users.findFirst({
      where: {
        user_id: user?.user_id
      }
    });

    const accesstable = await prisma.user_access.findFirst({
      where: {
        user_type: userid?.user_type,
        division: userid?.division,
        department: userid?.department
      }
    });

    const accessfull = accesstable?.access;
    console.log({ accessfull });
    
    if (accessfull) {
      const matchedTypes = [];

      for (const accessItem of accessfull) {
        const matchedObject = array.find(item => item.name.replace(/\s/g, '').toLowerCase() === accessItem.replace(/\s/g, '').toLowerCase());
        if (matchedObject) {
          // If type is an array, concatenate its items to matchedTypes, otherwise just push the type
          if (Array.isArray(matchedObject.type)) {
            matchedTypes.push(...matchedObject.type);
          } else {
            matchedTypes.push(matchedObject.type);
          }
        }
      }

      const notificationfind = await prisma.adm_notification.findMany({
        where: {
          type: { in: matchedTypes }
        }
      });

      response.status(200).json({ notificationfind });
    } else {
      response.status(404).json({ error: "No access information found for the user" });
    }
  } catch (error) {
    logger.error(`Internal server error- in staffnotification api`, error);
    response.status(500).json({ error: "Internal server error" });
  }finally {
    await prisma.$disconnect();
  }
};




module.exports = { getadm_notification, getcus_sup__notification, adm_read_notification, cus_read_notification, notification_types, staff_notification, newstaffnotification }