const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const winston = require("winston");
const fs = require("fs");
const { where } = require("@tensorflow/tfjs");

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

const viewCategory = async (req, res) => {
  try {
    const categories = await prisma.expense_category.findMany({
      orderBy: { category: "asc" },
    });

    if (categories.length === 0) {
      logger.error("No categories found - expense-viewCategory API");
      return res.status(404).json({
        error: true,
        message: "No data",
        data: [],
      });
    }

    logger.info("Categories fetched successfully - expense-viewCategory API");

    return res.status(200).json({
      error: false,
      message: "Success",
      data: categories,
    });
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} - expense-viewCategory API`
    );
    return res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  }
};

const addCategory = async (req, res) => {
  const { category, subcategory } = req.body;

  if (!category) {
    logger.error("Category required!");
    return res.status(400).json({
      error: true,
      message: "Category is required!",
    });
  }

  try {
    // 2. Check if category already exists
    const existingCategory = await prisma.expense_category.findFirst({
      where: { category },
    });

    // -------------------------------
    // CASE 1: Only category provided
    // -------------------------------
    if (category && !subcategory) {
      if (existingCategory) {
        return res.status(200).json({
          success: true,
          message: "Category already exists",
          data: existingCategory,
        });
      }

      // Create new category
      const newCategory = await prisma.expense_category.create({
        data: {
          category,
          created_date: istDate,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Category created successfully",
        data: newCategory,
      });
    }

    // ----------------------------------------
    // CASE 2: Category + Subcategory provided
    // ----------------------------------------
    if (category && subcategory) {
      if (existingCategory) {
        // Update only subcategory
        const updated = await prisma.expense_category.update({
          where: { id: existingCategory.id },
          data: { subcategory },
        });

        return res.status(200).json({
          success: true,
          message: "Subcategory updated successfully",
          data: updated,
        });
      }

      // Category does not exist → create with subcategory
      const newCategory = await prisma.expense_category.create({
        data: {
          category,
          subcategory,
          created_date: istDate,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Category and subcategory created successfully",
        data: newCategory,
      });
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in addCategory API`);

    return res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  }
};

// const addexpense = async (req, res) => {
//   const { category, party, subcategory, amount, payments } = req.body;

//   // Collect missing fields
//   let missing = [];
//   if (!category) missing.push("category");
//   if (!party) missing.push("party");
//   if (!subcategory) missing.push("subcategory");
//   if (!amount) missing.push("amount");

//   if (missing.length > 0) {
//     return res.status(400).json({
//       error: true,
//       message: `Missing required field(s): ${missing.join(", ")}`,
//     });
//   }
//   try {
//     const newExpense = await prisma.expense_details.create({
//       data: {
//         created_date: istDate,
//         category,
//         party,
//         subcategory,
//         amount,
//         payments,
//       },
//     });

//     return res.status(200).json({
//       success: true,
//       message: "New expense added",
//       data: newExpense,
//     });
//   } catch (error) {
//     logger.error(`Internal server error: ${error.message} in addexpense API`);

//     return res.status(500).json({
//       error: true,
//       message: "Internal server error",
//     });
//   }
// };

const addexpense = async (req, res) => {
  const items = req.body;
  const currentDate = new Date();
  const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
  const istDate = new Date(currentDate.getTime() + istOffset);
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: true,
      message: "Request body must be a non-empty array",
    });
  }

  // Validate each row has required fields
  for (let i = 0; i < items.length; i++) {
    const { category, party, subCategory, amount } = items[i];
    const subcategory = items[i].subcategory || subCategory;

    if (!category || !party || !subcategory || !amount) {
      return res.status(400).json({
        error: true,
        message: `Missing fields in item index ${i}`,
      });
    }
  }

  try {
    // Insert all items using transaction
    const result = await prisma.$transaction(
      items.map((item) => {
        return prisma.expense_details.create({
          data: {
            created_date: istDate,
            category: item.category,
            party: item.party,
            subcategory: item.subcategory || item.subCategory,
            amount: item.amount,
            payments: item.payments || [],
          },
        });
      })
    );

    return res.status(200).json({
      success: true,
      message: "Expenses added successfully",
      data: result,
    });
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in addexpense API`);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  }
};

const getexpenses = async (request, response) => {
  console.log("getexpenses called");
  try {
    const rows = await prisma.expense_details.findMany({
      orderBy: {
        created_date: {
          sort: "asc",
          nulls: "last",
        },
      },
    });

    if (!rows || rows.length === 0) {
      logger.error("No data found - expense-getexpenses API");
      return response.status(404).json({
        error: true,
        message: "No data",
        data: [],
      });
    }

    // Transform rows into desired shape
    const transformed = rows.map((r) => {
      // Ensure payments is an array (sometimes DB JSON may be null)
      const payments = Array.isArray(r.payments) ? r.payments : [];

      // Sum paid amount from payments array (coerce to Number)
      const paid = payments.reduce((sum, p) => {
        const amt = Number(p?.amount ?? 0);
        return sum + (isNaN(amt) ? 0 : amt);
      }, 0);

      // Amount from DB or 0
      const amount = Number(r.amount ?? 0);

      // Balance = amount - paid
      const balance = amount - paid;

      // Status logic
      let status = "Unpaid";
      if (paid === 0) status = "Unpaid";
      else if (paid >= amount && amount > 0) status = "Fully Paid";
      else status = "Partially Paid";

      // Unique payment types (method) joined by comma
      const paymentTypeArr = [
        ...new Set(
          payments
            .map((p) => (p?.method ? String(p.method).trim() : null))
            .filter(Boolean)
        ),
      ];
      const paymentType =
        paymentTypeArr.length > 0 ? paymentTypeArr.join(", ") : null;

      // Choose a top-level date: first payment date (if any) else created_date
      const date = payments[0]?.date ?? r.created_date ?? null;

      return {
        id: r.id,
        date,
        party: r.party ?? null,
        category: r.category ?? null,
        subCategory: r.subcategory ?? null,
        amount,
        paid,
        balance,
        status,
        paymentType,
        payments,
      };
    });

    logger.info(
      `Fetched ${transformed.length} expense records - expense-getexpenses API`
    );
    return response.status(200).json({
      error: false,
      message: "success",
      data: transformed,
    });
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in expense-getexpenses API`
    );
    return response.status(500).json({
      error: "Internal server error",
    });
  }
};

const updatepayment = async (req, res) => {
  const { payments, id } = req.body;

  if (!Array.isArray(payments) || payments.length === 0) {
    return res.status(400).json({
      error: true,
      message: "Request body must be a non-empty array",
    });
  }

  try {
    const result = await prisma.expense_details.update({
      where: {
        id: id,
      },
      data: {
        payments: payments || [],
      },
    });

    return res.status(200).json({
      success: true,
      message: "Payment updated successfully",
      data: result,
    });
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in expense-updatepayment API`
    );
    return res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  }
};

const deleteExpense = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res
      .status(400)
      .json({ error: true, message: "Missing expense id in params" });
  }

  try {
    const deleted = await prisma.expense_details.delete({
      where: { id: Number(id) },
    });

    return res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
      data: deleted,
    });
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in deleteExpense API`
    );
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ error: true, message: "Expense not found" });
    }
    return res
      .status(500)
      .json({ error: true, message: "Internal server error" });
  }
};

const updateExpense = async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res
      .status(400)
      .json({ error: true, message: "Missing expense id in params" });
  }

  // Accept single object in body (no array)
  const body = req.body || {};
  // Normalize subCategory
  if (body.subCategory && !body.subcategory)
    body.subcategory = body.subCategory;

  const allowed = ["category", "party", "subcategory", "amount", "payments"];

  const dataToUpdate = {};
  allowed.forEach((k) => {
    if (
      Object.prototype.hasOwnProperty.call(body, k) &&
      body[k] !== undefined
    ) {
      if (k === "amount") dataToUpdate.amount = Number(body.amount);
      else dataToUpdate[k] = body[k];
    }
  });

  if (Object.keys(dataToUpdate).length === 0) {
    return res.status(400).json({
      error: true,
      message:
        "No updatable fields provided. Provide at least one field to update.",
    });
  }

  try {
    const updated = await prisma.expense_details.update({
      where: { id: id },
      data: dataToUpdate,
    });

    return res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: updated,
    });
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in updateExpense API`
    );

    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ error: true, message: "Expense not found" });
    }
    return res
      .status(500)
      .json({ error: true, message: "Internal server error" });
  }
};

module.exports = {
  viewCategory,
  addCategory,
  addexpense,
  getexpenses,
  updatepayment,
  deleteExpense,
  updateExpense,
};
