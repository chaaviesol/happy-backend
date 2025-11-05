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

/*  View categories based on type-POST --------------------------- */

const viewCategory = async (request, response) => {
  const type = request.body.type;
  const usertype = request.user.userType;
  try {
    if (
      usertype === "SU" ||
      usertype === "ADM" ||
      usertype === "CUS" ||
      usertype === "SUP"
    ) {
      const responses = await prisma.category_master_new.findMany({
        where: {
          main_type: type,
        },
        select: {
          category: true,
        },
      });

      if (response.length === 0) {
        response.status(404).json({
          error: true,
          message: "no data",
        });

        logger.error(`No data found for type: ${type} in viewcategry api`);
      } else {
        const categories = responses.map((item) => item.category);
        // response.send(categories);
         response.status(200).json({
          error: false,
          data: categories,
        });
      }
    } else {
      logger.error(`Unauthorized- in viewCategory api`);
      return response
        .status(404)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in viewcategory api`);
    response.status(500).json({
      error: "Internal server error",
    });
  } finally {
    await prisma.$disconnect();
  }
};

const Categorymaster = async (request, res) => {
  const usertype = request.user.userType;
  const id = request.user.id;
  const main = request.body.main;
  try {
    if (usertype === "SU" || usertype === "ADM") {
      if (main) {
        const response = await prisma.category_master_new.findMany({
          where: {
            main_type: main,
          },
          select: {
            category: true,
            spec: true,
          },
        });

        // Process the response to convert spec to an array if it's not already
        const processedResponse = {
          category: [],
          sub_category: [],
          spec: [],
        };

        response.forEach((item) => {
          processedResponse.category.push(item.category);
          if (item.spec && Array.isArray(item.spec)) {
            item.spec.forEach((specItem) => {
              processedResponse.sub_category.push(specItem.sub_categories);
              processedResponse.spec.push(specItem.spec);
            });
          }
        });

        // Sending the processed response back to the client
        res.status(200).json(processedResponse);
      } else {
        const userdata = await prisma.users.findFirst({
          where: {
            id: id,
          },
          select: {
            user_id: true,
          },
        });
        const staffdata = await prisma.staff_users.findFirst({
          where: {
            user_id: userdata?.user_id,
          },
          select: {
            division: true,
          },
        });
        const response = await prisma.category_master_new.findMany({
          where: {
            main_type: staffdata?.division,
          },
          select: {
            category: true,
            spec: true,
          },
        });

        const processedResponse = {
          category: [],
          sub_category: [],
          spec: [],
        };

        response.forEach((item) => {
          processedResponse.category.push(item.category);
          if (item.spec && Array.isArray(item.spec)) {
            item.spec.forEach((specItem) => {
              processedResponse.sub_category.push(specItem.sub_categories);
              processedResponse.spec.push(specItem.spec);
            });
          }
        });

        res.status(200).json(processedResponse);
      }
    } else {
      logger.error(`Unauthorized- in Categorymaster api`);
      return res
        .status(404)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in Categorymaster api`
    );
    res.status(500).json({
      error: "Internal server error",
    });
  } finally {
    await prisma.$disconnect();
  }
};

/*  view Subcategories based on type and category -POST  ----------------  */

const viewSubCatAndSpecs = async (request, res) => {
  const { type, category } = request.body;
  const usertype = request.user.userType;
  try {
    if (
      usertype === "SU" ||
      usertype === "CUS" ||
      usertype === "SUP" ||
      usertype === "ADM"
    ) {
      const response = await prisma.category_master_new.findFirst({
        where: {
          main_type: type,
          category: category,
        },
        select: {
          spec: true,
        },
      });

      if (!response) {
        res.status(404).json({
          error: true,
          message: "no data",
        });
      } else {
        const specData = response.spec[0];
        const subCategories = specData.sub_categories;
        const specKeyValue = specData.spec;

        let specKeys = [];
        if (specKeyValue.length === 0) {
          let data = {};
          data.subCategories = subCategories;
          data.specs = [];
          res.send(data);
        } else {
          for (let i = 0; i < specKeyValue.length; i++) {
            specKeys.push(Object.keys(specKeyValue[i]).toString());
          }
          let data = {};
          data.subCategories = subCategories;
          data.specs = specKeys;
          res.send(data);
        }
      }
    } else {
      logger.error(`Unauthorized- in viewSubCatAndSpecs api`);
      return res
        .status(404)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
    });
    logger.error(
      `Internal server error: ${error.message} in viewSubCatAndSpecs`
    );
  }
};

/*view Specs based on type,category and selected spec -POST ------------ */

const viewSpecValues = async (request, res) => {
  const usertype = request.user.userType;
  const { type, category, spec } = request.body;
  try {
    if (usertype === "SU" || usertype === "ADM") {
      const response = await prisma.category_master_new.findFirst({
        where: {
          main_type: type,
          category: category,
        },
        select: {
          spec: true,
        },
      });

      const specData = response.spec[0];
      const specKeyValues = specData.spec;

      const specValues = [];
      for (let i = 0; i < specKeyValues.length; i++) {
        const specKey = Object.keys(specKeyValues[i])[0];
        if (specKey === spec) {
          const specValue = specKeyValues[i][spec];
          specValues.push(specValue);
        }
      }

      if (specValues.length === 0) {
        res.status(404).json({
          error: true,
          message: "Spec key not found",
        });
      } else {
        res.send(specValues.length === 1 ? specValues[0] : specValues);
      }
    } else {
      logger.error(`Unauthorized- in viewSpecValues api`);
      return res
        .status(404)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
    });
    logger.error(`Internal server error: ${error.message} in viewSpecValues`);
  }
};

/* add new category   -----------------------*/

const addCategory = async (request, res) => {
  const usertype = request.user.userType;
  const { category, sub_categories, spec, type } = request.body;
  if (usertype === "SU" || usertype === "ADM") {
    if (!category || !sub_categories || !spec || !type) {
      res.status(400).json({
        error: true,
        message: "all fields required!!!!!",
      });

      // Fixed: You should not reference 'error' here, as it's not defined in this context.
      logger.error("all fields required!!!!!");

      return;
    } else {
      // Transform the 'spec' array into the desired format
      const formattedSpec = spec.map((item) => ({ [item]: [] }));
      const specs = { sub_categories, spec: formattedSpec };

      try {
        const response = await prisma.category_master_new.create({
          data: {
            main_type: type,
            category: category,
            spec: [specs],
          },
        });

        if (response) {
          const formattedResponse = [
            {
              sub_categories: sub_categories,
              spec: formattedSpec,
            },
          ];

          res.status(200).json({
            success: true,
            message: "new category added",
            data: formattedResponse,
          });
        } else {
          res.status(404).json({
            error: true,
            message: "Error",
          });

          logger.info("Error in addcategory api");
        }
      } catch (error) {
        logger.error(
          `Internal server error: ${error.message} in addcategory api`
        );
        res.status(500).json({
          error: "Internal server error",
        });
      } finally {
        await prisma.$disconnect();
      }
    }
  } else {
    logger.error(`Unauthorized- in addCategory api`);
    return res
      .status(404)
      .json({ message: "Unauthorized. You are not an admin" });
  }
};

/* add new sub category -PATCH ------------   */

const addSubCategory = async (request, res) => {
  const usertype = request.user.userType;
  const { type, category, sub_categories } = request.body;

  if (usertype === "SU" || usertype === "ADM") {
    if (
      !type ||
      !category ||
      sub_categories.some((value) => value === null || value === "")
    ) {
      return res.status(400).json({
        error: true,
        message: "Request body is invalid",
      });
    }

    try {
      const existingCategory = await prisma.category_master_new.findFirst({
        where: {
          main_type: type,
          category: category,
        },
      });

      if (!existingCategory) {
        return res.status(404).json({
          error: true,
          message: "Category not found",
        });
      }

      const existingSpec = existingCategory.spec || [];
      const updatedSpec = existingSpec.map((item) => {
        return {
          ...item,
          sub_categories: sub_categories,
        };
      });

      await prisma.category_master_new.update({
        where: {
          id: existingCategory.id,
        },
        data: {
          spec: updatedSpec,
        },
      });

      const response = [
        {
          sub_categories: sub_categories,
          spec: existingSpec,
        },
      ];

      res.status(201).json({
        data: response,
        success: true,
        message: "New subcategory added successfully",
      });
    } catch (error) {
      logger.error(
        `Internal server error: ${error.message} in addsubcategory api `
      );

      res.status(500).send("Internal server error");
    } finally {
      await prisma.$disconnect();
    }
  } else {
    logger.error(`Unauthorized- in addSubCategory api`);
    return res
      .status(404)
      .json({ message: "Unauthorized. You are not an admin" });
  }
};

/* add new specs -PATCH */ //////////////

const addSpec = async (request, res) => {
  const usertype = request.user.userType;
  const { type, category, spec } = request.body;
  if (usertype === "SU" || usertype === "ADM") {
    if (
      !type ||
      !category ||
      spec.some((value) => value === null || value === "")
    ) {
      return res.status(400).json({
        error: true,
        message: "Request body is invalid",
      });
    }

    try {
      const existingCategory = await prisma.category_master_new.findFirst({
        where: {
          main_type: type,
          category: category,
        },
      });

      if (!existingCategory) {
        return res.status(404).json({
          error: true,
          message: "Category not found",
        });
      }

      const existingSpec = existingCategory.spec || [];

      const updatedSpec = {
        sub_categories: existingCategory.spec[0].sub_categories,
        spec: [],
      };

      // Add existing specs to the updated spec
      for (const item of existingSpec[0].spec) {
        for (const key in item) {
          if (item.hasOwnProperty(key)) {
            updatedSpec.spec.push({ [key]: item[key] });
          }
        }
      }

      // Add new specs to the updated spec
      for (const newSpec of spec) {
        if (
          !updatedSpec.spec.some((item) => Object.keys(item)[0] === newSpec)
        ) {
          updatedSpec.spec.push({ [newSpec]: [] });
        }
      }

      await prisma.category_master_new.update({
        where: {
          id: existingCategory.id,
        },
        data: {
          spec: [updatedSpec],
        },
      });

      res.status(201).json({
        success: true,
        message: "New spec added successfully",
      });
    } catch (error) {
      logger.error(`Internal server error: ${error.message} in addspec api`);
      res.status(500).json({
        error: true,
        message: "Internal server error",
      });
    } finally {
      await prisma.$disconnect();
    }
  } else {
    logger.error(`Unauthorized- in addspec api`);
    return res
      .status(404)
      .json({ message: "Unauthorized. You are not an admin" });
  }
};

/* add new spec values AND  delete new spec values -PATCH */

const manageSpecvalue = async (request, res) => {
  const usertype = request.user.userType;
  const { type, category, spec } = request.body;

  try {
    if (usertype === "SU" || usertype === "ADM") {
      const existingCategory = await prisma.category_master_new.findFirst({
        where: {
          main_type: type,
          category: category,
        },
      });

      if (!existingCategory) {
        return res.status(404).json({
          error: true,
          message: "Category not found",
        });
      }

      const dbSpec = existingCategory.spec?.[0].spec;

      if (!dbSpec || !Array.isArray(dbSpec)) {
        return res.status(404).json({
          error: true,
          message: "Spec not found or invalid for the category",
        });
      }

      spec.forEach((update) => {
        const key = Object.keys(update)[0];
        const index = dbSpec.findIndex(
          (value) => Object.keys(value)[0] === key
        );
        if (index !== -1 && Array.isArray(update[key])) {
          dbSpec[index][key] = update[key];
        }
      });

      await prisma.category_master_new.update({
        where: {
          id: existingCategory.id,
        },
        data: {
          spec: [
            {
              sub_categories: existingCategory.spec[0].sub_categories,
              spec: dbSpec,
            },
          ],
        },
      });

      res.status(201).json({
        success: true,
        message: "Successfully updated spec values",
      });
    } else {
      logger.error(`Unauthorized- in managespecvalue api`);
      return res
        .status(404)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in managespecvalue api`
    );
    res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  } finally {
    await prisma.$disconnect();
  }
};

/* Delete category -DELETE ------------   */

const deleteCategory = async (request, res) => {
  const { type, category } = request.body;
  const usertype = request.user.userType;

  try {
    if (usertype === "SU" || usertype === "ADM") {
      const dbCategories = await prisma.category_master_new.findMany({
        where: {
          main_type: type,
        },
        select: {
          category: true,
        },
      });

      const dbCategoriesKeys = dbCategories.map((val) => val.category);

      const categoriesToDelete = dbCategoriesKeys.filter(
        (val) => !category.includes(val)
      );

      if (categoriesToDelete.length > 0) {
        for (let i = 0; i < categoriesToDelete.length; i++) {
          await prisma.category_master_new.deleteMany({
            where: {
              main_type: type,
              category: categoriesToDelete[i],
            },
          });
        }

        res.status(201).json({
          success: true,
          message: "Categories deleted",
        });
      } else {
        res.status(201).json({
          success: true,
          message: "No categories to delete",
        });
      }
    } else {
      logger.error(`Unauthorized- in deletecategory api`);
      return res
        .status(404)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in deletecategory`);
    res.status(500).json({
      error: true,
      message: "An error occurred while deleting the categories.",
    });
  } finally {
    await prisma.$disconnect();
  }
};

/* Delete Specs -DELETE ------------   */

const deleteSpecs = async (request, res) => {
  const usertype = request.user.userType;
  const { type, category, spec } = request.body;

  try {
    if (usertype === "SU" || usertype === "ADM") {
      const categoryRecord = await prisma.category_master_new.findFirst({
        where: {
          main_type: type,
          category: category,
        },
      });

      if (!categoryRecord) {
        return res.status(404).json({
          error: true,
          message: "Category not found",
        });
      }

      let dbSpec = categoryRecord.spec;
      if (!Array.isArray(dbSpec)) {
        dbSpec = [dbSpec];
      }

      dbSpec[0].spec = dbSpec[0].spec.filter((dbSpecObj) => {
        return Object.keys(dbSpecObj).some((key) => spec.includes(key));
      });

      await prisma.category_master_new.update({
        where: {
          id: categoryRecord.id,
        },
        data: {
          spec: dbSpec,
        },
      });

      res.status(201).json({
        success: true,
        message: "Specs deleted successfully",
      });
    } else {
      logger.error(`Unauthorized- in deleteSpecs api`);
      return res
        .status(404)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in deletespec api`);
    res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  } finally {
    await prisma.$disconnect();
  }
};

module.exports = {
  viewCategory,
  viewSubCatAndSpecs,
  viewSpecValues,
  addCategory,
  addSubCategory,
  addSpec,
  manageSpecvalue,
  deleteCategory,
  deleteSpecs,
  Categorymaster,
};
