const { PrismaClient } = require("@prisma/client");
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
//////////////////////////////////////////

const managelogistics = async (request, response) => {
  console.log("heyylogist");
  const usertype = request.user.userType
  const option = request.body.type;
  try {
    if (usertype === "SU" || usertype === "ADM") {
      if (option === "add") {
        const newLogistics = {
          logistics_name: request.body.name,
          logistics_address: request.body.address,
          created_by: request.body.user,
          created_date: new Date(),
          updated_by: request.body.user,
          updated_date: new Date(),
          active: "Y",
        };

        const createdLogistics = await prisma.logistics_master.create({
          data: newLogistics,
        });

        const respText = "New Logistics Provider " + createdLogistics.logistics_name + " added";
        response.status(201).json(respText);
      } else if (option === "modify") {
        const log_id = request.body.log_id;
        const existingLogistics = await prisma.logistics_master.findUnique({
          where: { logistics_id: log_id },
        });

        if (!existingLogistics) {
          throw new Error("Logistics Provider not found");
        }

        let l_name = request.body.name;
        let l_address = request.body.address;
        const l_mod = request.body.user;
        const l_mod_dt = new Date();

        if (!l_name) {
          l_name = existingLogistics.logistics_name;
        }
        if (!l_address) {
          l_address = existingLogistics.logistics_address;
        }

        if (l_name === existingLogistics.logistics_name && l_address === existingLogistics.logistics_address) {
          const respText = "No changes found";
          response.status(201).json(respText);
        } else {
          const updatedLogistics = await prisma.logistics_master.update({
            where: { logistics_id: log_id },
            data: {
              logistics_name: l_name,
              logistics_address: l_address,
              updated_by: l_mod,
              updated_date: l_mod_dt,
            },
          });

          const respText =
            "Details of logistics Provider " + updatedLogistics.logistics_name + " with ID " + log_id + " updated";
          response.status(201).json(respText);
        }
      } else if (option === "delete") {
        const log_id = request.body.log_id;
        const existingLogistics = await prisma.logistics_master.findUnique({
          where: { logistics_id: log_id },
        });

        if (!existingLogistics) {
          throw new Error("Logistics Provider not found");
        }
        const l_name = existingLogistics.logistics_name;
        const l_status = "N";
        const l_mod = request.body.user;
        const l_mod_dt = new Date();

        const updatedLogistics = await prisma.logistics_master.update({
          where: { logistics_id: log_id },
          data: {
            active: l_status,
            updated_by: l_mod,
            updated_date: l_mod_dt,
          },
        });
        const respText = "Logistics Provider " + l_name + " with id " + log_id + " is marked inactive";
        response.status(201).json(respText);
      } else {
        logger.error(`Invalid option in managelogistics api`);
        response.status(400).json({ error: "Invalid option" });
      }
    } else {
      logger.error(`Unauthorized- in managelogistics api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an customer" });
    }
  } catch (error) {
    logger.error(`Internal server error- in managelogistics api`);
    response.status(500).json({ error: "Internal server error" });
  }finally {
    await prisma.$disconnect();
  }
};

const viewlogistics = async (request, response) => {
  const usertype = request.user.userType
  try {
    if (usertype === "SU" || usertype === "ADM") {
      const log_id = request.body.log_id;

      if (log_id == null) {
        const allLogistics = await prisma.logistics_master.findMany({
          select: { logistics_id: true, logistics_name: true, logistics_address: true },
        });

        response.status(200).json(allLogistics);
      } else {
        const logistics = await prisma.logistics_master.findUnique({
          where: { logistics_id: log_id },
          select: { logistics_name: true, logistics_address: true },
        });

        if (logistics == null) {
          response.status(404).json({ error: "Logistics not found" });
        } else {
          response.status(200).json(logistics);
        }
      }
    } else {
      logger.error(`Unauthorized- in viewlogistics api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an customer" });
    }
  } catch (error) {
    logger.error(`Internal server error- in viewlogistics api`);
    response.status(500).json({ error: "Internal server error" });
  }finally {
    await prisma.$disconnect();
  }
};

const viewSupplierandLogistics = async (request, response) => {
  const userType = request.user.userType
  const usertype = "SUP";
  try {
    if (userType === "SU" || userType === "ADM") {
      const logistics = await prisma.logistics_master.findMany({
        select: { logistics_name: true },
      });

      const suppliers = await prisma.users.findMany({
        where: { user_type: usertype },
        select: { trade_name: true },
      });

      const logisticsNamesSet = new Set(logistics.map((item) => item.logistics_name));
      const supplierNamesSet = new Set(suppliers.map((item) => item.trade_name));

      const logisticsNames = Array.from(logisticsNamesSet);
      const supplierNames = Array.from(supplierNamesSet);

      const respText = { suppliers: supplierNames, logistics: logisticsNames };
      response.status(201).json(respText);
    } else {
      logger.error(`Unauthorized- in viewSupplierandLogistics api`);
      return response
        .status(403 )
        .json({ message: "Unauthorized. You are not an customer" });
    }
  } catch (error) {
    logger.error(`Internal server error- in viewSupplierandLogistics api`);
    response.status(500).json({ error: "Internal server error" });
  }finally {
    await prisma.$disconnect();
  }
};

module.exports = { managelogistics, viewlogistics, viewSupplierandLogistics }




