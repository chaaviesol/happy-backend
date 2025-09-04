const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const winston = require("winston");
const fs = require("fs");
const { response } = require("express");


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
const istOffset = 5.5 * 60 * 60 * 1000; // IST offset is 5 hours 30 minutes
const istDate = new Date(currentDate.getTime() + istOffset);

const createprofit = async (request, response) => {
  const userType = request.user.userType;
  if (userType !== "SU") {
    logger.error(`Unauthorized- in createprofit api`);
    return response
      .status(403)
      .json({ message: "Unauthorized" });

  }
  try {
    const data = request.body.data;
    const alldata = await prisma.profit_distribution.findMany();
    for (let i = 0; i < data.length; i++) {
      const name = data[i].name;
      const percentage = data[i].percentage;
    
      if (name && percentage) {
        const existingRecord = alldata.find(
          (record) => record.name.toLowerCase() === name.toLowerCase()
        );

        if (existingRecord) {
        
          await prisma.profit_distribution.update({
            where: {
              id: existingRecord.id,
            },
            data: {
              name: name,
              percentage: percentage,
              updated_date: new Date(), // Assuming istDate is a Date object
              // updated_by: vvv,
            },
          });
        } else {
    
          await prisma.profit_distribution.create({
            data: {
              name: name,
              percentage: percentage,
              created_date: new Date(),
              // created_by: vvv,
            },
          });
        }
      }
    }
    response.status(200).json({
      message: "Success",
      success: true,
      error: false,
    });
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in createprofit api`);
    response.status(500).json({ error: "Internal server error" });
  }finally {
    await prisma.$disconnect();
  }
};

const viewprofit_distribution = async (request, response) => {
  const userType = request.user.userType;
  if (userType !== "SU") {
    logger.error(`Unauthorized- in viewprofit_distribution api`);
    return response
      .status(403)
      .json({ message: "Unauthorized" });
  }
  try {
    const view = await prisma.profit_distribution.findMany();
    response.status(200).json({
      success: true,
      error: false,
      data: view,
    });
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in viewprofit_distribution api`
    );
    response.status(500).json({ error: "Internal server error" });
  }finally {
    await prisma.$disconnect();
  }
};

const getLastSettledDate = async (req, res) => {
  const userType = req.user.userType;
  if (userType !== "SU") {
    logger.error(`Unauthorized- in getLastSettledDate api`);
    return response
      .status(403)
      .json({ message: "Unauthorized" });
  }
  try {
  
    const settledDetails = await prisma.settleaccount_details.findMany({
      orderBy: {
        id: "desc",
      },
      select: {
        settled_date: true,
      },
    });
    const lastSettledOn = settledDetails[0]?.settled_date;
  
    if (!lastSettledOn) {
      return res.status(204).send();
    }
    res.status(200).json({
      success: true,
      error: false,
      lastSettledOn,
    });
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in get last settled date api`
    );
    response.status(500).json({ error: "Internal server error" });
  }finally {
    await prisma.$disconnect();
  }
};

const account_details = async (request, response) => {
  const userType = request.user.userType;
  if (userType !== "SU") {
    logger.error(`Unauthorized- in account_details api`);
    return response
      .status(403)
      .json({ message: "Unauthorized" });
  }
  try {
    const end_date = request.body.end_date;
  
    const accountdetails = await prisma.settleaccount_details.findMany({
      orderBy: {
        id: "asc",
      },
    });

    let start_date;
    if (accountdetails.length > 0) {
      const date = accountdetails[0]?.settled_date;
      start_date = new Date(date);
      start_date.setDate(start_date.getDate() + 1);
    } else {
      const sales_order = await prisma.sales_order_new.findFirst({
        orderBy: {
          sales_id: "asc",
        },
      });
      start_date = sales_order?.created_date;
    }
   
    if (start_date && end_date) {
      const formattedEndDate = new Date(end_date).toISOString();

      const sales_data = await prisma.sales_order_new.findMany({
        where: {
          created_date: {
            gte: start_date,
            lte: formattedEndDate,
          },
        },
        select: {
          total_amount: true,
        },
      });
      if (sales_data.length < 1) {
        return response.status(404).json({
          success: false,
          error: true,
          message: "No sales orders found",
        });
      }

      const totalAmount = sales_data.reduce((total, sale) => {
        if (sale.total_amount !== null) {
          return total + parseFloat(sale.total_amount); // Parse the total_amount to handle decimal values
        } else {
          return total;
        }
      }, 0);

      // Calculating 22% of the total amount
      const profit = 0.22 * totalAmount;
     
      if (profit > 0) {
        const latestProfitDistribution =
          await prisma.profit_distribution.findMany();

        const totalPercentage = latestProfitDistribution.reduce(
          (total, item) => {
           
            return parseFloat(total) + parseFloat(item.percentage);
          },
          0
        );

        const distributedAmounts = latestProfitDistribution.map((item) => {
          const individualPercentage = (
            profit *
            (parseFloat(item.percentage) / totalPercentage)
          ).toFixed(2);
          return { ...item, distributedAmount: individualPercentage };
        });
        response.status(200).json({
          tableData: distributedAmounts,
          totalSalesAmount: totalAmount.toFixed(2),
          success: true,
          error: false,
        });
      }
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in account_details api`
    );
    response.status(500).json({ error: "Internal server error" });
  }finally {
    await prisma.$disconnect();
  }
};

const addsettle = async (request, response) => {
  const userType = request.user.userType;
  if (userType !== "SU") {
    logger.error(`Unauthorized- in addsettle api`);
    return response
      .status(403)
      .json({ message: "Unauthorized" });
  }
  try {
    const data = request.body.data;
    const end_date = request.body.end_date;
    if (data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        const add = await prisma.settleaccount_details.create({
          data: {
            name: data[i]?.name,
            amount: parseFloat(data[i]?.distributedAmount),
            settled_date: end_date,
            created_date: istDate,
            created_by: request.user.id,
          },
        });
      }

      return response.status(200).json({ message: "Data added successfully." });
    } else {
      return response.status(400).json({ message: "No data provided." });
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in addsettle api`);
    response.status(500).json({ error: "Internal server error" });
  }
};

const settled_view = async (request, response) => {
  const userType = request.user.userType;
  if (userType !== "SU") {
    logger.error(`Unauthorized- in settled_view api`);
    return response
      .status(403)
      .json({ message: "Unauthorized" });
  }
  try {
    const view = await prisma.settleaccount_details.findMany()
    if (view.length > 0) {
      response.status(200).json({
        data: view,
        error: false,
        success: true
      })
    }
    else {
      response.status(404).json({
        message: "no data",
        success: false,
        error: true
      })
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in settled_view api`);
    response.status(500).json({ error: "Internal server error" });
  }finally {
    await prisma.$disconnect();
  }
}

module.exports = {
  createprofit,
  viewprofit_distribution,
  account_details,
  addsettle,
  getLastSettledDate,
  settled_view
};
