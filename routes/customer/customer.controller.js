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

////////////////////////////////////////////////////////////////////////////////////

const customerWishList = async (req, res) => {
  const usertype = req.user.userType;
  const logged_id = req.user.id;
  const { prod_id } = req.body;
  try {
    if (usertype === "CUS") {
      if (!logged_id || !prod_id) {
        logger.error(
          "customer_id or prod_id is undefined in customerWishList api"
        );
        return res.send("invalid request");
      }
      const max_id = await prisma.customer_wish_list.aggregate({
        _count: {
          _all: true,
        },
        take: 1,
        orderBy: {
          id: "desc",
        },
      });

      const lastId = max_id[0]?.max?.id || 0; // Get the last ID or set a default value of 0
      const newId = lastId + 1;
      const id = newId.toString();
      await prisma.customer_wish_list.create({
        data: {
          customer_id: logged_id,
          prod_id: prod_id,
        },
      });
      res.status(201).json({
        success: true,
        message: "successfully wishlisted",
      });
    } else {
      logger.error(`Unauthorized- in customerwishlist api`);
      return res
        .status(403)
        .json({ message: "Unauthorized. You are not an customer" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "internal server error",
    });
    logger.error(
      `Internal server error: ${error.message} in customer- customerwishlist api`
    );
  } finally {
    await prisma.$disconnect();
  }
};

const getCustomerWishList = async (req, res) => {
  console.log(req.user, ">>>>");
  const logged_id = req.user.id;
  const usertype = req.user.userType;
  try {
    if (usertype === "CUS") {
      const data = {
        0: "product_name",
        1: "product_id",
        2: "color",
        3: "image1_link",
        4: "image2_link",
        5: "image3_link",
      };
      const dataKeys = Object.values(data).map(
        (key) => `product_master.${key}`
      );
      const response = await prisma.customer_wish_list.findMany({
        where: {
          customer_id: logged_id,
        },
        include: {
          product_master: {
            select: {
              brand: {
                select: {
                  brand_name: true,
                },
              },
              users: {
                select: {
                  trade_name: true,
                },
              },
              product_name: true,
              product_id: true,
              color: true,
              image1_link: true,
              image2_link: true,
              image3_link: true,
            },
          },
        },
      });
      // Extract the desired values from the product_master object
      const extractedResponse = response.map((item) => {
        const {
          product_name,
          product_id,
          color,
          brand,
          users,
          image1_link,
          image2_link,
          image3_link,
        } = item.product_master;

        return {
          product_name,
          product_id,
          color,
          brand_name: brand.brand_name,
          trade_name: users.trade_name,
          image1_link,
          image2_link,
          image3_link,
        };
      });

      res.status(200).json({
        success: true,
        data: extractedResponse,
      });
    } else {
      logger.error(`Unauthorized- in getcustomerwishlist api`);
      return res
        .status(403)
        .json({ message: "Unauthorized. You are not an customer" });
    }
  } catch (error) {
    res.status(500).json({
      error: "internal server error",
    });
    logger.error(
      `Internal server error: ${error.message} in customer- getcustomerwishlist api`
    );
  } finally {
    await prisma.$disconnect();
  }
};

const removeFromWishList = async (req, res) => {
  const usertype = req.user.userType;
  const { prod_id } = req.body;
  const customer_id = req.user.id;
  if (usertype === "CUS") {
    if (!customer_id || !prod_id) {
      logger.error(
        "customer_id or prod_id is undefined in customer-removeFromWishList api"
      );
      return res.status(400).json({
        error: true,
        message: "invalid request",
      });
    }
    try {
      const deletedItem = await prisma.customer_wish_list.deleteMany({
        where: {
          customer_id: customer_id,
          prod_id: prod_id,
        },
      });
      if (deletedItem.count === 1) {
        res.status(200).json({
          success: true,
          message: "successfully removed product ",
        });
      } else {
        logger.error("invalid data in removeFromWishList api");
        res.status(400).json({
          error: true,
          message: "invalid data",
        });
      }
    } catch (error) {
      res.status(500).json({
        error: "internal server error",
      });
      logger.error(
        `Internal server error: ${error.message} in customer- removewishlist api`
      );
    } finally {
      await prisma.$disconnect();
    }
  } else {
    logger.error(`Unauthorized- in removeFromWishList api`);
    return res
      .status(403)
      .json({ message: "Unauthorized. You are not an customer" });
  }
};

const addToCart = async (req, res) => {
  const usertype = req.user.userType;
  const { prod_id, quantity } = req.body;
  const customer_id = req.user.id;
  try {
    if (usertype === "CUS") {
      if (!customer_id || !prod_id || !quantity) {
        logger.error(
          "customer_id or prod_id or quantity is undefined in addToCart api"
        );

        return res.status(400).json({
          error: true,
          message: "invalid request",
        });
      }
      const addcart = await prisma.customer_cart.findFirst({
        where: {
          customer_id: customer_id,
          product_id: prod_id,
        },
      });
      if (addcart) {
        res.status(400).json({
          message: "product already in cart",
        });
      } else {
        const response = await prisma.customer_cart.create({
          data: {
            customer_id: customer_id,
            product_id: prod_id,
            quantity: parseInt(quantity),
          },
        });
        ////////////notification//////////
        res.status(201).json({
          success: true,
          message: "successfully added to cart",
        });
      }
    } else {
      logger.error(`Unauthorized- in addToCart api`);
      return res
        .status(403)
        .json({ message: "Unauthorized. You are not an customer" });
    }
  } catch (error) {
    res.status(500).json({
      error: "internal server error",
    });
    logger.error(
      `Internal server error: ${error.message} in customer- addtocart api`
    );
  } finally {
    await prisma.$disconnect();
  }
};

const getCart = async (req, res) => {
  const customer_id = req.user.id;
  const usertype = req.user.userType;
  try {
    if (usertype === "CUS") {
      if (customer_id) {
        const data = {
          0: "product_name",
          1: "product_id",
          2: "color",
          3: "quantity",
          4: "color_family",
        };
        const dataKeys = Object.values(data)
          .map((key) => `product_master.${key}`)
          .join(", ");

        const response = await prisma.customer_cart.findMany({
          where: {
            customer_id: customer_id,
          },
          select: {
            quantity: true,
            product_master: {
              select: {
                brand: {
                  select: {
                    brand_name: true,
                  },
                },
                users: {
                  select: {
                    trade_name: true,
                  },
                },
                product_name: true,
                product_id: true,
                color: true,
                color_family: true,
              },
            },
          },
        });
        const extractedResponse = response.map((item) => {
          const {
            product_name,
            product_id,
            color,
            color_family,
            brand,
            users,
          } = item.product_master;
          const quantity = item.quantity;
          return {
            product_name,
            product_id,
            color,
            color_family,
            quantity,
            brand_name: brand.brand_name,
            trade_name: users.trade_name,
          };
        });
        res.status(200).json({
          success: true,
          data: extractedResponse,
        });
      } else {
        logger.error("customer_id undefined in getCart api");
      }
    } else {
      logger.error(`Unauthorized- in getCart api`);
      return res
        .status(403)
        .json({ message: "Unauthorized. You are not an customer" });
    }
  } catch (error) {
    res.status(500).json({
      error: "internal server error",
    });
    logger.error(
      `Internal server error: ${error.message} in customer-getcart api`
    );
  } finally {
    await prisma.$disconnect();
  }
};

const removeFromCart = async (req, res) => {
  const usertype = req.user.userType;
  const { prod_id } = req.body;
  const customer_id = req.user.id;
  if (usertype === "CUS") {
    if (!customer_id || !prod_id) {
      logger.error("customer_id or prod_id undefined in removefromCart api");
      return res.status(400).json({
        error: true,
        message: "invalid request",
      });
    }
    try {
      await prisma.customer_cart.deleteMany({
        where: {
          customer_id: customer_id,
          product_id: parseInt(prod_id),
        },
      });
      res.status(200).json({
        success: true,
        message: "successfully deleted",
      });
    } catch (error) {
      res.status(500).json({
        error: "internal server error",
      });
      logger.error(
        `Internal server error: ${error.message} in customer-removefromcart api`
      );
    } finally {
      await prisma.$disconnect();
    }
  } else {
    logger.error(`Unauthorized- in removefromcart api`);
    return res
      .status(403)
      .json({ message: "Unauthorized. You are not an customer" });
  }
};

const removecartitems = async (req, res) => {
  const customer_id = req.body?.customer_id;
  const productIds = req.body.products;
  try {
    if (!customer_id || !productIds) {
      logger.error("Missing required fields: customer_id or productIds");
      return res.status(400).json({
        error: true,
        message: "Invalid request: Missing customer ID or product IDs",
      });
    }

    // Validate product IDs as integers (optional but recommended for security)
    if (!productIds.every((ele) => Number.isInteger(ele?.product_id))) {
      logger.error("Invalid product IDs: Must be integers");
      return res.status(400).json({
        error: true,
        message: "Invalid product IDs: Must be integers",
      });
    }

    // Efficiently delete multiple items using IN operator (assuming Prisma supports it)
    await prisma.customer_cart.deleteMany({
      where: {
        customer_id: customer_id,
        product_id: {
          in: productIds.map((ele) => parseInt(ele.product_id)),
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Items successfully deleted from cart",
    });
  } catch (error) {
    logger.error(
      `Internal server error-customer-removecartitems: ${error.message}`
    );
    res.status(500).json({
      error: true,
      message: "Internal Server Error", // Generic error message for security
    });
  } finally {
    await prisma.$disconnect();
  }
};

const profile = async (req, res) => {
  const usertype = req.user.userType;
  try {
    if (
      usertype === "CUS" ||
      usertype === "SU" ||
      usertype === "ADM" ||
      usertype === "SUP"
    ) {
      // const logged_id = req.user.id;
      const logged_id = req.body.logged_id; // instead of req.user.id

      if (logged_id) {
        const profiledata = await prisma.users.findFirst({
          where: {
            id: logged_id,
          },
        });
        res.status(201).json({
          success: true,
          // message: "your profile",
          data: profiledata,
        });
      } else {
        res.status(500).json({
          success: false,
          message: "no data",
        });
        logger.error("customer_id is undefined in profile api");
      }
    } else {
      logger.error(`Unauthorized- in profile api`);
      return res.status(403).json({ message: "Unauthorized" });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in customer- profile api`
    );
  } finally {
    await prisma.$disconnect();
  }
};

const profileedit = async (req, res) => {
  const usertype = req.user.userType;
  try {
    if (
      usertype === "CUS" ||
      usertype === "SU" ||
      usertype === "ADM" ||
      usertype === "SUP"
    ) {
      const logged_id = req.user.id;
      const { user_name, mobile, landline, website, product_type } = req.body;
      const updatedDate = new Date();
      const profiledata = await prisma.users.update({
        where: {
          id: logged_id,
        },
        data: {
          user_name: user_name,
          product_type: product_type,
          mobile: mobile,
          landline: landline,
          website: website,
          updated_date: updatedDate,
        },
      });

      ////////////notification//////////
      res.status(201).json({
        success: true,
        message: "profile updated",
        data: profiledata,
      });
    } else {
      logger.error(`Unauthorized- in profileedit api`);
      return res.status(403).json({ message: "Unauthorized. " });
    }
  } catch (error) {
    console.log(error);
    logger.error(`Internal server error: ${error.message} in customer-profileedit api`);
  } finally {
    await prisma.$disconnect();
  }
};

module.exports = {
  customerWishList,
  getCustomerWishList,
  removeFromWishList,
  addToCart,
  getCart,
  removeFromCart,
  profile,
  profileedit,
  removecartitems,
};
