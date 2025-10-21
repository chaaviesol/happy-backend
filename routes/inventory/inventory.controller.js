const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const winston = require("winston");
const fs = require("fs");
const path = require("path");
const bwipjs = require("bwip-js");

// Import your upload helpers
const { multipartUpload } = require("../../middleware/Image/Uploadimage");

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

// const viewInventory = async (request, response) => {
//   console.log(request.user);
//   // const division = request.user.division;
//   const id = request.user.id;
//   const usertype = request.user.userType;
//   const is_black = request.body.is_black;
//   const { type, subCategory, category } = request.body;

//   try {
//     if (usertype === "ADM" || usertype === "SU") {
//       const usersdata = await prisma.users.findFirst({
//         where: {
//           id: id,
//         },
//         select: {
//           user_id: true,
//         },
//       });

//       const divisiondata = await prisma.staff_users.findFirst({
//         where: {
//           user_id: usersdata?.user_id,
//         },
//         select: {
//           division: true,
//         },
//       });
//       const division = divisiondata?.division;

//       if (!division && !is_black) {
//         const inventory = await prisma.inventory.findMany({
//           select: {
//             INVENTORY_id: true,
//             batch_id: true,
//             total_quantity: true,
//             blocked_quantity: true,
//             mrp: true,
//             po_num: true,
//             barcode: true,
//             barcode_text: true,

//             product_master: {
//               select: {
//                 product_id: true,
//                 product_name: true,
//                 product_type: true,
//                 color: true,
//                 color_family: true,
//                 min_stk: true,
//                 image1_link: true,
//                 image2_link: true,
//                 image3_link: true,
//                 product_sub_type: true,
//                 product_code: true,
//                 assign_code: true,
//                 prod_subtype2: true,
//                 brand: {
//                   select: {
//                     brand_name: true,
//                   },
//                 },
//               },
//             },
//           },
//           orderBy: {
//             INVENTORY_id: "desc",
//           },
//         });

//         const inventoryWithStatus = inventory.map((item) => {
//           const isOutOfStock =
//             item?.total_quantity <= item.product_master?.min_stk;
//           return {
//             ...item,
//             status: isOutOfStock ? "outofstock" : "instock",
//           };
//         });
//         response.status(200).json(inventoryWithStatus);
//       } else if (division && !is_black) {
//         const inventory = await prisma.inventory.findMany({
//           where: {
//             product_master: {
//               product_type: division,
//             },
//           },
//           select: {
//             INVENTORY_id: true,
//             batch_id: true,
//             total_quantity: true,
//             blocked_quantity: true,
//             mrp: true,
//             po_num: true,
//             barcode: true,
//             barcode_text: true,
//             product_master: {
//               select: {
//                 product_id: true,
//                 product_name: true,
//                 product_type: true,
//                 product_code: true,
//                 assign_code: true,
//                 color: true,
//                 color_family: true,
//                 min_stk: true,
//                 image1_link: true,
//                 image2_link: true,
//                 image3_link: true,
//                 product_sub_type: true,
//                 prod_subtype2: true,
//                 brand: {
//                   select: {
//                     brand_name: true,
//                   },
//                 },
//               },
//             },
//           },
//           orderBy: {
//             INVENTORY_id: "desc",
//           },
//         });
//         const inventoryWithStatus = inventory.map((item) => {
//           const isOutOfStock =
//             item.total_quantity <= item.product_master.min_stk;
//           return {
//             ...item,
//             status: isOutOfStock ? "outofstock" : "instock",
//           };
//         });
//         console.log(
//           "🔍 Sample Inventory:",
//           JSON.stringify(inventoryWithStatus[0], null, 2)
//         );

//         response.status(200).json(inventoryWithStatus);
//       }
//     } else {
//       logger.error(`Unauthorized- in inventory api`);
//       return response
//         .status(403)
//         .json({ message: "Unauthorized. You are not an admin" });
//     }
//   } catch (error) {
//     logger.error(`An error occurred: ${error.message} in inventory api`);
//     response.status(500).json({ error: "An error occurred" });
//   } finally {
//     const test = await prisma.product_master.findFirst({
//       select: {
//         product_id: true,
//         product_name: true,
//         product_code: true,
//         assign_code: true,
//       },
//     });
//     console.log("product_master test:", test);

//     await prisma.$disconnect();
//   }
// };

const viewInventory = async (request, response) => {
  const id = request.user.id;
  const usertype = request.user.userType;
  const is_black = request.body.is_black;
  const { type, subCategory, category } = request.body;

  try {
    if (usertype === "ADM" || usertype === "SU") {
      const usersdata = await prisma.users.findFirst({
        where: { id },
        select: { user_id: true },
      });

      const divisiondata = await prisma.staff_users.findFirst({
        where: { user_id: usersdata?.user_id },
        select: { division: true },
      });

      const division = divisiondata?.division;

      // ✅ Build filters based on corrected mapping
      const productFilter = {};

      if (type && type.trim() !== "")
        productFilter.product_type = { equals: type, mode: "insensitive" };

      if (category && category.trim() !== "")
        productFilter.product_sub_type = {
          equals: category,
          mode: "insensitive",
        };

      if (subCategory && subCategory.trim() !== "")
        productFilter.prod_subtype2 = {
          equals: subCategory,
          mode: "insensitive",
        };

      if (division && !is_black)
        productFilter.product_type = { equals: division, mode: "insensitive" };

      // 🔍 Fetch inventory based on conditions
      const inventory = await prisma.inventory.findMany({
        where: Object.keys(productFilter).length
          ? { product_master: productFilter }
          : undefined,
        select: {
          INVENTORY_id: true,
          batch_id: true,
          total_quantity: true,
          blocked_quantity: true,
          mrp: true,
          po_num: true,
          barcode: true,
          barcode_text: true,
          product_master: {
            select: {
              product_id: true,
              product_name: true,
              product_type: true,
              product_sub_type: true,
              prod_subtype2: true,
              product_code: true,
              assign_code: true,
              color: true,
              color_family: true,
              min_stk: true,
              image1_link: true,
              image2_link: true,
              image3_link: true,
              brand: {
                select: { brand_name: true },
              },
            },
          },
        },
        orderBy: { INVENTORY_id: "desc" },
      });

      // 🧮 Add stock status
      const inventoryWithStatus = inventory.map((item) => ({
        ...item,
        status:
          item.total_quantity <= (item.product_master?.min_stk || 0)
            ? "outofstock"
            : "instock",
      }));

      return response.status(200).json(inventoryWithStatus);
    } else {
      logger.error(`Unauthorized - in inventory api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in inventory api`);
    response.status(500).json({ error: "An error occurred" });
  } finally {
    await prisma.$disconnect();
  }
};



// const generateBarcode = async (request, response) => {
//   // const id = request.user.id;
//   const { prod_id, po_num, batch_id, INVENTORY_id } = request.body;

//   try {
//     const findbarcode = await prisma.inventory.findFirst({
//       where: {
//         INVENTORY_id: INVENTORY_id,
//       },
//       select: {
//         barcode: true, // store S3 URL
//         barcode_text: true, // helpful for scanning API
//       },
//     });
//     console.log("findbarcode", findbarcode);
//     if (findbarcode && findbarcode.barcode && findbarcode.barcode_text) {
//       return response.status(400).json({
//         success: true,
//         message: "Barcode already generated",
//         data: {
//           barcode: findbarcode.barcode,
//           barcode_text: findbarcode.barcode_text,
//         },
//       });
//     }
//     // 1️⃣ Create unique barcode text
//     const now = new Date();

//     // format date as DDMM (day + month)
//     const day = String(now.getDate()).padStart(2, "0");
//     const month = String(now.getMonth() + 1).padStart(2, "0");
//     const dateCode = `${day}${month}`; // e.g. 1010 for 10 Oct

//     // generate a 4-digit random number
//     const randomNum = Math.floor(1000 + Math.random() * 9000);

//     const barcodeText = `${prod_id}-${batch_id}-${po_num}-${dateCode}${randomNum}`;
//     // const barcodeText = `${prod_id}-${batch_id}-${po_num}`;

//     // 2️⃣ Generate barcode PNG buffer
//     const pngBuffer = await bwipjs.toBuffer({
//       bcid: "code128", // Barcode type
//       text: barcodeText, // Text to encode
//       scale: 3, // Scaling factor
//       height: 10, // Height in mm
//       includetext: true, // Show text below barcode
//       textxalign: "center",
//     });

//     // 3️⃣ Create S3 key
//     const fileName = `barcode_${prod_id}_${Date.now()}.png`;
//     const s3Key = `barcodes/${fileName}`;

//     // 4️⃣ Upload to S3
//     const uploadResult = await multipartUpload(pngBuffer, s3Key, "image/png");
//     console.log("uploadResult", uploadResult);

//     // S3 file URL (depends on your bucket config)
//     // const fileUrl = `https://${process.env.AWS_S3_ACCESS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
//     const fileUrl = uploadResult?.Location;
//     // 5️⃣ Save in Inventory table
//     const newInventory = await prisma.inventory.update({
//       where: {
//         INVENTORY_id: INVENTORY_id,
//       },
//       data: {
//         barcode: fileUrl, // store S3 URL
//         barcode_text: barcodeText, // helpful for scanning API
//       },
//     });

//     response.status(201).json({
//       success: true,
//       message: "Barcode generated & uploaded successfully",
//       data: newInventory,
//     });
//   } catch (error) {
//     console.error("Error generating barcode:", error);
//     response
//       .status(500)
//       .json({ error: "An error occurred while generating barcode" });
//   } finally {
//     await prisma.$disconnect();
//   }
// };

const { createCanvas, loadImage } = require("canvas");
const { log } = require("console");

const generateBarcode = async (request, response) => {
  const { prod_id, po_num, batch_id, INVENTORY_id } = request.body;

  try {
    const findbarcode = await prisma.inventory.findFirst({
      where: { INVENTORY_id },
      select: { barcode: true, barcode_text: true },
    });

    const productfind = await prisma.product_master.findFirst({
      where: {
        product_id: prod_id,
      },
      select: {
        product_code: true,
        assign_code: true,
        product_name: true,
      },
    });
    const assign_code = productfind.assign_code;
    const product_name = productfind.product_name;

    if (findbarcode?.barcode && findbarcode?.barcode_text) {
      return response.status(400).json({
        success: true,
        message: "Barcode already generated",
        data: findbarcode,
      });
    }

    // 1️⃣ Generate unique barcode text
    const now = new Date();
    const dateCode = `${String(now.getDate()).padStart(2, "0")}${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;
    // const randomNum = Math.floor(1000 + Math.random() * 9000);
    // const barcodeText = `${prod_id}-${po_num}-${randomNum}`;
    const generateUniqueBarcode = async (prod_id, po_num) => {
      const alphabets = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

      let barcodeText;
      let exists = true;

      while (exists) {
        const randomAlphabet = alphabets.charAt(
          Math.floor(Math.random() * alphabets.length)
        );
        const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit random
        barcodeText = `${prod_id}-${randomAlphabet}`;

        // 🔍 Check in inventory if already exists
        const found = await prisma.inventory.findFirst({
          where: { barcode: barcodeText },
          select: { barcode: true },
        });

        exists = !!found; // true if already exists → regenerate
      }

      return barcodeText;
    };

    const barcodeText = await generateUniqueBarcode(prod_id, po_num);

    // 2️⃣ Generate barcode PNG buffer
    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: "code128",
      text: barcodeText,
      scale: 3,
      height: 7,
      includetext: false, // disable built-in text
    });

    // 3️⃣ Create label canvas (50mm x 30mm ≈ 189x113 pixels at 96 DPI)
    // 3️⃣ Create label canvas (wider so text doesn’t overlap)
    const labelWidth = 300; // ~75mm
    const labelHeight = 150; // ~38mm
    const canvas = createCanvas(labelWidth, labelHeight);
    const ctx = canvas.getContext("2d");

    // White background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, labelWidth, labelHeight);

    // Top: Product name (wrap if long)
    ctx.fillStyle = "#000000";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";

    // If product name is too long, shrink font size
    let displayName = product_name;
    if (ctx.measureText(displayName).width > labelWidth - 20) {
      ctx.font = "bold 12px Arial";
    }
    ctx.fillText(displayName, labelWidth / 2, 20);

    // Barcode image
    const img = await loadImage(barcodeBuffer);
    const barcodeX = (labelWidth - img.width) / 2;
    ctx.drawImage(img, barcodeX, 40);

    // Decoded barcode text
    ctx.font = "12px Arial";
    ctx.fillText(barcodeText, labelWidth / 2, 120);

    // Product code at bottom
    if (assign_code) {
      ctx.font = "bold 10px Arial";
      ctx.textAlign = "center";
      wrapText(ctx, assign_code, labelWidth / 2, 140, labelWidth - 20, 12);
    }
    function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
      const words = text.split(" ");
      let line = "";

      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + " ";
        const testWidth = ctx.measureText(testLine).width;

        if (testWidth > maxWidth && i > 0) {
          ctx.fillText(line, x, y);
          line = words[i] + " ";
          y += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, y);
    }

    const finalBuffer = canvas.toBuffer("image/png");

    // 4️⃣ Upload to S3
    const fileName = `barcode_${prod_id}_${Date.now()}.png`;
    const s3Key = `barcodes/${fileName}`;
    const uploadResult = await multipartUpload(finalBuffer, s3Key, "image/png");

    const fileUrl = uploadResult?.Location;
    console.log("fileUrl", fileUrl);
    // 5️⃣ Save in Inventory
    const newInventory = await prisma.inventory.update({
      where: { INVENTORY_id },
      data: {
        barcode: fileUrl,
        barcode_text: barcodeText,
      },
    });

    response.status(201).json({
      success: true,
      message: "Barcode label generated & uploaded",
      data: newInventory,
    });
  } catch (error) {
    console.error("Error generating barcode:", error);
    response.status(500).json({ error: "Error generating barcode" });
  } finally {
    await prisma.$disconnect();
  }
};

const scanBarcode = async (request, response) => {
  try {
    // Scanner sends decoded barcode text
    // Example: ?barcode=101-2024-55
    const { barcode } = request.query;

    if (!barcode) {
      return response.status(400).json({ error: "Barcode text is required" });
    }

    const cleanBarcode = barcode.trim();
    console.log("qq Barcode ", cleanBarcode);
    // 1️⃣ Find product by barcode_text
    const product = await prisma.inventory.findFirst({
      where: {
        OR: [{ barcode_text: cleanBarcode }, { barcode: cleanBarcode }],
      },
      select: {
        INVENTORY_id: true,
        barcode: true,
        po_num: true,
        prod_id: true,
        batch_id: true,
        selling_price: true,
        barcode_text: true,
        mrp: true,
      },
    });

    if (!product) {
      return response.status(404).json({ error: "Product not found" });
    }

    // 2️⃣ Fetch related product info (like in productsale_list)
    const [maxMrp, productTypeResult, coupon] = await Promise.all([
      prisma.inventory.aggregate({
        _max: { mrp: true },
        _min: { selling_price: true },
        where: { prod_id: product.prod_id },
      }),
      prisma.product_master.findFirst({
        where: { product_id: product.prod_id },
        select: {
          product_type: true,
          product_name: true,
          color_family: true,
          color: true,
          package: true,
          no_of_items: true,
          gst_perc: true,
          product_code: true,
          assign_code: true,
        },
      }),
      prisma.campaigns.findMany({
        where: {
          product_id: { array_contains: product.prod_id },
          NOT: { status: "N" },
        },
      }),
    ]);

    // 3️⃣ Update expired campaigns (same logic as above API)
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
        currentDate >= campaign.start_date && currentDate <= campaign.end_date
      );
    });

    // 4️⃣ Build response in same structure
    const responseData = {
      product_id: product.prod_id,
      prod_type: productTypeResult?.product_type || null,
      product_name: productTypeResult?.product_name || null,
      color_family: productTypeResult?.color_family || null,
      color: productTypeResult?.color || null,
      package: productTypeResult?.package || null,
      no_of_items: productTypeResult?.no_of_items || null,
      total_quantity: product.total_quantity,
      mrp: maxMrp._max.mrp,
      original_price: maxMrp._min.selling_price,
      product_code: productTypeResult?.product_code || null,
      assign_code: productTypeResult?.assign_code || null,
      activeCampaigns,
      barcode_text: product.barcode_text,
      barcode_image: product.barcode, // S3 URL
      batch_id: product.batch_id,
    };

    response.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error scanning barcode:", error);
    response
      .status(500)
      .json({ error: "An error occurred while scanning barcode" });
  } finally {
    await prisma.$disconnect();
  }
};

module.exports = {
  viewInventory,
  generateBarcode,
  scanBarcode,
};
