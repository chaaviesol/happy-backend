const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const winston = require("winston");
const fs = require("fs");
const path = require("node:path");
const mime = require("mime");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const {
  upload,
  multipartUpload,
  downloadFileFromS3,
} = require("../../middleware/Image/Uploadimage");
const xlsx = require("xlsx");

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

////brandadd////////////
const manageBrand = async (request, response) => {
  console.log(request.body);
  const usertype = request.user.userType;
  try {
    if (usertype == "ADM" || usertype === "SU") {
      const name = request.body.name; // Updated from brand_name to name
      const supplier_id = request.body.supplier_id;
      const prod_type = request.body.prod_type; // Updated from product_type to prod_type
      const product_sub_type = request.body.product_sub_type;
      const brandcode = request.body.brandcode.toLowerCase(); // Updated from brand_code to brandcode
      const user = request.body.user; // Updated from created_by to user

      if (name && supplier_id && prod_type && brandcode) {
        const maxBrandId = await prisma.brand.findFirst({
          select: {
            brand_id: true,
          },
          orderBy: {
            brand_id: "desc",
          },
          take: 1,
        });
        let newbrand_id;
        if (maxBrandId === null) {
          newbrand_id = 1;
        } else {
          newbrand_id = maxBrandId.brand_id + 1;
        }

        const existingbrand_name = await prisma.brand.findMany({
          select: {
            brand_name: true,
          },
        });
        const brandNames = existingbrand_name.map((item) =>
          item.brand_name.toLowerCase()
        );
        let brandcode_flag = true;
        for (i = 0; i < brandNames.length; i++) {
          if (brandNames[i] === name.toLowerCase()) {
            brandcode_flag = false;
            const responsepText = "Brand name is already in use";
            return response.status(409).json(responsepText);
          }
        }
        const existingBrandCodes = await prisma.brand.findFirst({
          where: {
            brand_code: brandcode,
          },
        });

        if (existingBrandCodes?.brand_code === brandcode) {
          brandcode_flag = false;

          const responsepText = "Brand code is already in use";
          return response.status(409).json(responsepText);
        } else {
          brandcode_flag = true;
        }
        if (brandcode_flag === true) {
          const newBrand = await prisma.brand.create({
            data: {
              brand_id: newbrand_id,
              brand_name: name,
              supplier_id: supplier_id,
              product_type: prod_type,
              created_by: user,
              created_date: istDate,
              updated_by: user,
              updated_date: istDate,
              product_sub_type: product_sub_type,
              brand_code: brandcode,
            },
          });

          const responsepText = `New Brand ${name} added`;
          response.status(201).json(responsepText);
        } else {
          logger.error(
            `Brand code or Brand name is already in use for manageBrand api`
          );
          const responsepText = "Brand code or Brand name is already in use";
          response.status(201).json(responsepText);
        }
      } else {
        logger.error(
          `name && supplier_id && prod_type && brandcode are required in manageBrand api`
        );
      }
    } else {
      logger.error(`Unauthorized- in managebrand api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in manageBrand api`);
    response.status(500).json("Internal Server Error");
  } finally {
    await prisma.$disconnect();
  }
};

const viewbrands = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype == "ADM" || usertype === "SU" || usertype === "SUP") {
      const product_type = request.body.prod_type;
      console.log("product_type =>>>", product_type);
      const id = request.user.id;
      if (product_type) {
        const view = await prisma.brand.findMany({
          select: {
            brand_id: true,
            brand_name: true,
          },
          where: {
            product_type: product_type,
          },
        });
        response.status(201).json(view);
      } else {
        if (usertype === "ADM") {
          const user = await prisma.users.findFirst({
            where: {
              id: id,
            },
            select: {
              user_id: true,
            },
          });
          const staff = await prisma.staff_users.findFirst({
            where: {
              user_id: user.user_id,
            },
          });
          const view = await prisma.brand.findMany({
            select: {
              brand_id: true,
              brand_name: true,
            },
            where: {
              product_type: staff?.division,
            },
          });
          response.status(201).json(view);
        } else {
          const prod_type = await prisma.users.findFirst({
            where: {
              id: id,
            },
            select: {
              product_type: true,
            },
          });
          console.log("prod_type", prod_type);
          const productTypes = Object.values(prod_type.product_type);
          const view = await prisma.brand.findMany({
            select: {
              brand_id: true,
              brand_name: true,
            },
            where: {
              product_type: {
                in: productTypes,
              },
            },
          });
          response.status(201).json(view);
        }
      }
    } else {
      logger.error(`Unauthorized- in managebrand api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in viewbrands api `);
    response.status(500).json("Internal Server Error");
  } finally {
    await prisma.$disconnect();
  }
};

const productmgmt = async (request, response) => {
  console.log("request.bodyrequest.bodyrequest.body", request.body);
  console.log("reeeeeeeeeee1111", JSON.parse(request.body.data));
  const data = JSON.parse(request.body.data);
  const usertype = request.user.userType;

  try {
    if (usertype === "ADM" || usertype === "SU") {
      const product_id = data.product_id;
      const product_imageLink = request.files;

      let prodImage = {};

      for (let i = 0; i < product_imageLink?.length; i++) {
        let keyName = `image${i + 1}`;
        const file = product_imageLink[i];

        if (file.size > 1024 * 1024 * 1) {
          // If file is larger than 5 MB
          const fileUrl = file.location; // S3 URL

          const buffer = await downloadFileFromS3(fileUrl);
          const s3Key = `${Date.now()}-${file.originalname}`;
          const contentType = file.mimetype;
          const uploadResult = await multipartUpload(
            buffer,
            s3Key,
            contentType
          );
          prodImage[keyName] = uploadResult.Location; // Assuming Location is part of the upload result
        } else {
          prodImage[keyName] = file.location; // multer-S3 will provide this directly
        }
      }

      if (
        product_id === null ||
        product_id === undefined ||
        product_id === ""
      ) {
        const maxProductId = await prisma.product_master.findFirst({
          select: {
            product_id: true,
          },
          orderBy: {
            product_id: "desc",
          },
        });

        let new_id;

        if (maxProductId) {
          new_id = maxProductId.product_id + 1;
        } else {
          new_id = 1;
        }

        // const product_id = maxProductId.product_id + 1;
        const product_id = new_id;
        const {
          name,
          type,
          category,
          subcategory,
          hsn,
          sup_name,
          brand,
          spec,
          package,
          manufacturer_code,
          gst_perc,
          user,
          unit_of_measure,
          color,
          color_family,
          usertype,
          min_stk,
        } = data;

        let product_desc = data.desc;
        const no_of_items = data.no_of_items; //units

        let product_code = data?.product_code;

        let responsepText = "";
        if (name === null || name === undefined || name === "") {
          responsepText = "Product Name cannot be blank";
          response.status(401).json(responsepText);
          return;
        } else if (type === null || type === undefined || type === "") {
          responsepText = "Please choose product type";
          response.status(401).json(responsepText);
          return;
        } else if (
          category === null ||
          category === undefined ||
          category === ""
        ) {
          responsepText = "Please choose product category";
          response.status(401).json(responsepText);
          return;
        } else if (brand === null || brand === undefined || brand === "") {
          responsepText = "Please choose product brand";
          response.status(401).json(responsepText);
          return;
        } else if (
          subcategory === null ||
          subcategory === undefined ||
          subcategory === ""
        ) {
          responsepText = "Please choose product sub-category";
          response.status(401).json(responsepText);
          return;
        } else {
          const supplier = await prisma.users.findFirst({
            select: {
              id: true,
            },
            where: {
              trade_name: {
                equals: sup_name,
                mode: "insensitive",
              },
            },
          });
          const sup_id = supplier.id;
          const brands = await prisma.brand.findFirst({
            select: {
              brand_id: true,
              brand_code: true,
            },
            where: {
              brand_name: {
                equals: brand,
              },
            },
          });
          const brandid = brands.brand_id;
          const brandcode = brands.brand_code;
          let ptypeforspec = type.length > 5 ? type.substring(0, 5) : type;
          let pcategoryforspec =
            category.length > 5 ? category.substring(0, 5) : category;
          let psubcatforspec =
            subcategory.length > 5 ? subcategory.substring(0, 5) : subcategory;

          if (product_desc === null || product_desc === undefined) {
            product_desc = name;
          }

          if (product_code) {
            const foundProductCode = await prisma.product_master.findUnique({
              where: {
                product_code: product_code,
              },
              select: {
                product_code: true,
              },
            });
            if (foundProductCode) {
              return response
                .status(409)
                .json({ error: "product code already used" });
            }
          } else {
            if (color === null || color === undefined) {
              product_code =
                brandcode +
                ptypeforspec +
                pcategoryforspec +
                psubcatforspec +
                color_family +
                product_desc.slice(0, 5);
              +name;
            } else if (color.length < 5) {
              product_code =
                brandcode +
                ptypeforspec +
                pcategoryforspec +
                psubcatforspec +
                color +
                color_family +
                product_desc.slice(0, 5);
              +name;
            } else {
              product_code =
                brandcode +
                ptypeforspec +
                pcategoryforspec +
                psubcatforspec +
                color.substring(0, 5) +
                color_family +
                product_desc.slice(0, 5);
              +name;
            }
          }
          const p_created = new Date();
          const p_flag = usertype === "SUP" ? "N" : "Y";
          const newProduct = await prisma.product_master.create({
            data: {
              product_id: product_id,
              product_code: product_code,
              product_name: name,
              product_desc: product_desc,
              product_type: type,
              product_sub_type: category,
              prod_subtype2: subcategory,
              hsn: hsn,
              supplier_id: sup_id,
              brand_id: brandid,
              product_spec: spec || undefined,
              package: package,
              no_of_items: parseInt(no_of_items) || 0,
              manufacturer_code: manufacturer_code,
              gst_perc: gst_perc,
              created_by: user,
              created_date: istDate,
              is_active: p_flag,
              unit_of_measure: unit_of_measure,
              // parent_product_id: parent_id,
              // updated_by: user,
              updated_date: p_created,
              image1_link: prodImage?.image1,
              image2_link: prodImage?.image2,
              image3_link: prodImage?.image3,
              color: color,
              color_family: color_family,
              // images: images,
              min_stk: parseInt(min_stk),
            },
          });
          responsepText = name + " added to the Product master successfully..";
          return response.status(201).json(responsepText);
        }
      }
      // forupdateeeeeeeeeeeeeeeeeeeeee
      else {
        const product = await prisma.product_master.findFirst({
          where: {
            product_id: product_id,
          },
        });

        if (!product) {
          const responsepText = "Product not found!";
          response.status(404).json(responsepText);
        } else {
          const {
            product_name,
            product_desc,
            product_type,
            product_sub_type,
            prod_subtype2,
            hsn,
            product_code,
            sup_name,
            spec,
            package,
            manufacturer_code,
            gst_perc,
            user,
            unit_of_measure,
            color,
            color_family,
            p_flag,
            min_stk,
            brand_id,
          } = data;

          const sup_idd = data?.supplier_id; ///////sup_name
          const no_of_items = parseInt(data?.no_of_items) || 0; //units
          const brand_code = data?.brand.brand_code;
          const trade_name = data?.trade_name || data?.users.trade_name;
          const users = data?.users.trade_name;
          const brand = data?.brand.brand_name;
          const brand_name = data?.brand_name || data?.brand.brand_name;

          const brandidd = await prisma.brand.findFirst({
            where: {
              brand_name: brand_name,
            },
            select: {
              brand_id: true,
              brand_code: true,
            },
          });
          let responsepText = "";

          if (
            product_name === null ||
            product_name === undefined ||
            product_name === ""
          ) {
            responsepText = "Product Name cannot be blank";
            response.status(404).json(responsepText);
            return;
          } else if (
            product_type === null ||
            product_type === undefined ||
            product_type === ""
          ) {
            responsepText = "Please choose product type";
            response.status(404).json(responsepText);
            return;
          } else if (
            product_sub_type === null ||
            product_sub_type === undefined ||
            product_sub_type === ""
          ) {
            responsepText = "Please choose product category";
            response.status(404).json(responsepText);
            return;
          } else if (brand === null || brand === undefined || brand === "") {
            responsepText = "Please choose product brand";
            response.status(404).json(responsepText);
            return;
          } else if (
            prod_subtype2 === null ||
            prod_subtype2 === undefined ||
            prod_subtype2 === ""
          ) {
            responsepText = "Please choose product sub-category";
            response.status(404).json(responsepText);
            return;
          } else {
            let ptypeforspec =
              product_type.length > 5
                ? product_type.substring(0, 5)
                : product_type;
            let pcategoryforspec =
              product_sub_type.length > 5
                ? product_sub_type.substring(0, 5)
                : product_sub_type;
            let psubcatforspec =
              prod_subtype2.length > 5
                ? prod_subtype2.substring(0, 5)
                : prod_subtype2;

            if (product_desc === null || product_desc === undefined) {
              product_desc = product_name;
            }
            const p_modified = new Date();
            const supplier = await prisma.users.findFirst({
              select: {
                id: true,
              },
              where: {
                trade_name: trade_name,
              },
            });
            const sup_id = supplier.id;
            try {
              const updatedProduct = await prisma.product_master.update({
                where: {
                  product_id: product_id,
                },
                data: {
                  product_id: product_id,
                  product_code: product_code,
                  product_name: product_name,
                  product_desc: product_desc,
                  product_type: product_type,
                  product_sub_type: product_sub_type,
                  prod_subtype2: prod_subtype2,
                  hsn: hsn,
                  supplier_id: sup_id,
                  brand_id: brandidd.brand_id,
                  // brand: { connect: { brand_name: p_brand } },
                  product_spec: spec,
                  package: package,
                  no_of_items: no_of_items,
                  manufacturer_code: manufacturer_code,
                  gst_perc: gst_perc,
                  created_by: users,
                  is_active: p_flag,
                  unit_of_measure: unit_of_measure,
                  // parent_product_id: parent_id,
                  updated_by: user,
                  updated_date: istDate,
                  image1_link: prodImage?.image1,
                  image2_link: prodImage?.image2,
                  image3_link: prodImage?.image3,
                  color: color,
                  color_family: color_family,
                  // images:images,
                  min_stk: parseInt(min_stk),
                },
              });
              const responsepText = product_name + " updated successfully";
              response.status(201).json(responsepText);
            } catch (err) {
              logger.error(
                `Internal server error: ${err.message} in productmgmt api `
              );
            }
          }
        }
      }
    } else {
      logger.error(`Unauthorized- in productadd api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (err) {
    logger.error(`Internal server error: ${err.message} in productmgmt api `);
    response.status(500).json("Internal Server Error");
  } finally {
    await prisma.$disconnect();
  }
};

const updatedProduct = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype == "ADM" || usertype === "SU") {
    }
    const product_id = request.body.product_id;
    const product = await prisma.product_master.findFirst({
      where: {
        product_id: product_id,
      },
    });

    if (!product) {
      const responsepText = "Product not found!";
      response.status(201).json(responsepText);
    } else {
      const product_name = request.body.product_name;
      const product_desc = request.body.product_desc;
      const product_type = request.body.product_type;
      const product_sub_type = request.body.product_sub_type;
      const prod_subtype2 = request.body.prod_subtype2;
      const hsn = request.body.hsn;
      const sup_id = request.body.sup_id; ///////sup_name
      const trade_name = request.body.trade_name;
      const brand_id = request.body.brand_id;
      const brand = request.body.brand;
      const spec = request.body.spec;
      const package = request.body.package;
      const no_of_items = parseInt(request.body.no_of_items); //units
      const manufacturer_code = request.body.manufacturer_code; // mfgcode
      const gst_perc = request.body.gst_perc;
      const users = request.body.users.trade_name; //user
      const unit_of_measure = request.body.unit_of_measure;
      // const parent_id = request.body.parent_id;
      const image1_link = request.body.image1_link;
      const image2_link = request.body.image2_link;
      const image3_link = request.body.image3_link;
      const color = request.body.color;
      const color_family = request.body.color_family;
      const brand_code = request.body.brand_code;
      const p_flag = request.body.p_flag;

      let responsepText = "";
      if (
        product_name === null ||
        product_name === undefined ||
        product_name === ""
      ) {
        responsepText = "Product Name cannot be blank";
        response.status(201).json(responsepText);
        return;
      } else if (
        product_type === null ||
        product_type === undefined ||
        product_type === ""
      ) {
        responsepText = "Please choose product type";
        response.status(201).json(responsepText);
        return;
      } else if (
        product_sub_type === null ||
        product_sub_type === undefined ||
        product_sub_type === ""
      ) {
        responsepText = "Please choose product category";
        response.status(201).json(responsepText);
        return;
      } else if (brand === null || brand === undefined || brand === "") {
        responsepText = "Please choose product brand";
        response.status(201).json(responsepText);
        return;
      } else if (
        prod_subtype2 === null ||
        prod_subtype2 === undefined ||
        prod_subtype2 === ""
      ) {
        responsepText = "Please choose product sub-category";
        response.status(201).json(responsepText);
        return;
      } else {
        let ptypeforspec =
          product_type.length > 5 ? product_type.substring(0, 5) : product_type;
        let pcategoryforspec =
          product_sub_type.length > 5
            ? product_sub_type.substring(0, 5)
            : product_sub_type;
        let psubcatforspec =
          prod_subtype2.length > 5
            ? prod_subtype2.substring(0, 5)
            : prod_subtype2;

        if (product_desc === null || product_desc === undefined) {
          product_desc = product_name;
        }

        let product_code = "";
        if (color === null || color === undefined) {
          product_code =
            brand_code +
            ptypeforspec +
            pcategoryforspec +
            psubcatforspec +
            color_family +
            product_desc.slice(0, 5) +
            product_name;
        } else if (color.length < 5) {
          product_code =
            brand_code +
            ptypeforspec +
            pcategoryforspec +
            psubcatforspec +
            color +
            color_family +
            product_desc.slice(0, 5) +
            product_name;
        } else {
          product_code =
            brand_code +
            ptypeforspec +
            pcategoryforspec +
            psubcatforspec +
            color.substring(0, 5) +
            color_family +
            product_desc.slice(0, 5) +
            product_name;
        }
        const p_modified = new Date();
        const supplier = await prisma.users.findFirst({
          select: {
            id: true,
          },
          where: {
            trade_name: {
              equals: trade_name,
            },
          },
        });
        const sup_id = supplier.id;
        try {
          const updatedProduct = await prisma.product_master.update({
            where: {
              product_id: product_id,
            },

            data: {
              product_id: product_id,
              product_code: product_code,
              product_name: product_name,
              product_desc: product_desc,
              product_type: product_type,
              product_sub_type: product_sub_type,
              prod_subtype2: prod_subtype2,
              hsn: hsn,
              supplier_id: sup_id,
              brand_id: brand_id,
              product_spec: spec,
              package: package,
              no_of_items: no_of_items,
              manufacturer_code: manufacturer_code,
              gst_perc: gst_perc,
              created_by: users,
              is_active: p_flag,
              unit_of_measure: unit_of_measure,
              // parent_product_id: parent_id,
              updated_by: trade_name,
              updated_date: istDate,
              image1_link: image1_link,
              image2_link: image2_link,
              image3_link: image3_link,
              color: color,
              color_family: color_family,
              brand_code: brand_code,
            },
          });

          const responsepText = product_name + " updated successfully";
          response.status(201).json(responsepText);
        } catch (err) {
          logger.error(
            `Internal server error: ${error.message} in updatedProduct api `
          );
        }
      }
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in updatedProduct api`
    );
    response.status(500).json("Internal Server Error");
  } finally {
    await prisma.$disconnect();
  }
};

const deleteproduct = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype == "ADM" || usertype === "SU") {
      const product_id = request.body.product_id;
      const productdel = await prisma.product_master.findFirst({
        where: {
          product_id: product_id,
        },
      });
      if (!productdel) {
        const responsepText = "Product not found!";
        response.status(201).json(responsepText);
      } else {
        const updatedRecord = await prisma.product_master.update({
          where: {
            product_id: product_id,
          },
          data: {
            is_active: "N",
          },
        });
      }
    } else {
      logger.error(`Unauthorized- in deleteproduct api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (err) {
    logger.error(`Internal server error: ${err.message} in deleteproduct api `);
    response.status(500).json("Internal Server Error");
  } finally {
    await prisma.$disconnect();
  }
};

const getProductDetails = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (
      usertype == "ADM" ||
      usertype === "SU" ||
      usertype === "SUP " ||
      usertype === "CUS"
    ) {
      const type = request.body.type;
      const productname = request.body.prod_name;
      const product_id = request.body.product_id;

      if (type === "" || type === null || type === undefined) {
        const whereCondition = productname
          ? { product_name: productname }
          : { product_id: product_id };
        const productDetails = await prisma.product_master.findFirst({
          where: whereCondition,
          select: {
            product_id: true,
            product_code: true,
            product_name: true,
            product_desc: true,
            product_type: true,
            product_sub_type: true,
            prod_subtype2: true,
            hsn: true,
            supplier_id: true,
            brand_id: true,
            product_spec: true,
            package: true,
            no_of_items: true,
            manufacturer_code: true,
            gst_perc: true,
            created_by: true,
            created_date: true,
            is_active: true,
            unit_of_measure: true,
            parent_product_id: true,
            updated_by: true,
            updated_date: true,
            image1_link: true,
            image2_link: true,
            image3_link: true,
            images: true,
            color: true,
            color_family: true,
            min_stk: true,
            users: {
              select: {
                trade_name: true,
              },
            },
            brand: {
              select: {
                brand_name: true,
                brand_code: true,
              },
            },
          },
        });

        response.status(201).json(productDetails);
      } else if (type === "detail") {
        let whereCondition;

        if (productname) {
          whereCondition = {
            product_name: productname,
          };
        } else {
          whereCondition = {
            product_id: product_id,
          };
        }
        const productDetails = await prisma.product_master.findFirst({
          where: whereCondition,
          select: {
            product_id: true,
            product_code: true,
            product_name: true,
            product_desc: true,
            product_type: true,
            product_sub_type: true,
            prod_subtype2: true,
            min_stk: true,
            hsn: true,
            supplier_id: true,
            brand_id: true,
            product_spec: true,
            package: true,
            no_of_items: true,
            manufacturer_code: true,
            gst_perc: true,
            created_by: true,
            created_date: true,
            is_active: true,
            unit_of_measure: true,
            parent_product_id: true,
            updated_by: true,
            updated_date: true,
            image1_link: true,
            image2_link: true,
            image3_link: true,
            images: true,
            color: true,
            color_family: true,
            users: {
              select: {
                trade_name: true,
              },
            },
            brand: {
              select: {
                brand_name: true,
                brand_code: true,
              },
            },
          },
        });

        response.status(201).json(productDetails);
      }
    } else {
      logger.error(`Unauthorized- in getProductDetails api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in getProductDetails api`
    );
  } finally {
    await prisma.$disconnect();
  }
};

////////////////////////////
const addCategories = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const addcategory = await prisma.category_master_new.create({
        data: {
          main_type: request.body.main_type,
          category: request.body.category,
          spec: request.body.spec,
        },
      });
      response.status(200).json({
        data: addcategory,
      });
    } else {
      logger.error(`Unauthorized- in addcategories api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in addCategories api`
    );
    response.status(500).json("Internal Server Error");
  } finally {
    await prisma.$disconnect();
  }
};

const getCategories = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype == "ADM" || usertype === "SU") {
      const main_type = request.body.main_type.toLowerCase();
      const responseult = await prisma.category_master_new.findMany({
        where: {
          main_type: main_type,
        },
        select: {
          category: true,
        },
      });
      if (responseult.length > 0) {
        const categories = responseult.map((item) => item.category);
        return response.status(200).json(categories);
      } else {
        return response.status(204).json({
          message: "No Categories",
        });
      }
    } else {
      logger.error(`Unauthorized- in manageCategories api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (err) {
    logger.error(`Internal server error: ${err.message} in getCategories api`);
  } finally {
    await prisma.$disconnect();
  }
};

//////getspecc============//////////////

const getspec = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype == "ADM" || usertype === "SU") {
      const main_type = request.body.main_type.toLowerCase();
      const category = request.body.category;
      if (main_type && category) {
        const responseult = await prisma.category_master_new.findMany({
          where: {
            main_type: main_type,
            category: category,
          },
          select: {
            spec: true,
          },
        });
        if (responseult.length > 0) {
          const specvalues = responseult.flatMap((item) => item.spec);
          response.status(200).json(specvalues);
        } else {
          response.status(404).json("spec not found");
        }
      } else {
        response.status(404).json("main_type and category are required fields");
      }
    } else {
      logger.error(`Unauthorized- in manageCategories api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (err) {
    logger.error(`Internal server error: ${err.message} in getspec api`);
  } finally {
    await prisma.$disconnect();
  }
};

const categoryMasterview = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype == "ADM" || usertype === "SU") {
      const category = request.body.category;
      const mainTypeData = await prisma.category_master_new.findFirst({
        where: {
          category: category,
        },
        select: {
          spec: true,
        },
      });

      if (mainTypeData) {
        const speci = Object.values(JSON.parse(mainTypeData.spec).spec);
        const sub_categry = Object.values(
          JSON.parse(mainTypeData.spec).sub_categories
        );

        response.status(200).json({
          success: true,
          specification: speci,
          sub_category: sub_categry,
        });
      } else {
        logger.error(
          `No category found for category in categoryMasterview api`
        );
        response
          .status(404)
          .json({ error: `No category found for category: ${category}` });
      }
    } else {
      logger.error(`Unauthorized- in manageCategories api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (err) {
    logger.error(
      `Internal server error: ${err.message} in categoryMasterview api`
    );
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

/////////////////////

const manageCategories = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype == "ADM" || usertype === "SU") {
      main_type = request.body.main_type;
      category = request.body.category;
      spec = request.body.spec;
      if (category == null || category == undefined) {
        category = null;
      }
      if (spec == null || spec == undefined) {
        spec = null;
      }

      if (category == null && spec == null) {
        responsepText = "No values passed";
      } else {
        if (category !== null && spec !== null) {
          prisma.category_master_new
            .findFirst({
              where: { main_type: main_type },
            })
            .then((responseult) => {
              existing_category = responseult.sub_categories;
              existing_spec = responseult.spec;
              // Checking the categories
              const sort_category = spec.sort();
              const cat_arraysAreEqual =
                JSON.stringify(sort_category) ===
                JSON.stringify(sort_existing_category);
              if (cat_arraysAreEqual) {
                final_category = sort_existing_category;
                cat_text = "No change in categories";
              } else {
                final_category = sort_category;
                cat_text = "Categories updated";
              }
              final_specs = {
                category: final_category,
                sub_categories: final_subcategory,
                spec: responseult.spec,
              };
              return prisma.category_master_new.update({
                where: { main_type: main_type },
                data: {
                  updated_by: user,
                  updated_date: istDate,
                  category_specs: final_specs,
                },
              });
            })
            .then((response) => {
              response.status(201).json(cat_text + " & " + sub_cat_text);
            })
            .catch((err) => {
              logger.error(
                `Internal server error: ${err.message} in manageCategories api`
              );
              throw err;
            });
        }
      }
    } else {
      logger.error(`Unauthorized- in manageCategories api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in manageCategories api`
    );
  } finally {
    await prisma.$disconnect();
  }
};

const updateSpecs = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const category = request.body.category;
      const spec = request.body.spec;
      const existingCategory = await prisma.category_master_new.findFirst({
        where: {
          category: category,
        },
      });

      if (existingCategory) {
        const updatedCategory = await prisma.category_master_new.update({
          where: {
            id: existingCategory.id,
          },
          data: {
            spec: spec,
          },
        });

        response.status(200).json(updatedCategory);
      } else {
        response.status(404).json({ error: "Category not found" });
      }
    } else {
      logger.error(`Unauthorized- in productvarient api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (err) {
    logger.error(`Internal server error: ${err.message} in updateSpecs api`);
    response.status(500).json({ error: "Failed to update category and specs" });
  } finally {
    await prisma.$disconnect();
  }
};

const tagParentProduct = async (request, response) => {
  const usertype = request.user.userType;
  const product_name = request.body.product_name;
  try {
    if (usertype == "ADM" || usertype === "SU") {
      const productDetails = await prisma.product_master.findFirst({
        select: {
          product_name: true,
          product_sub_type: true,
          brand: {
            select: {
              brand_name: true,
            },
          },
          prod_subtype2: true,
          gst_perc: true,
          package: true,
          hsn: true,
        },
        where: {
          product_name: product_name,
        },
      });
      if (productDetails) {
        const updatedProductDetails = {
          ...productDetails,
          brand_name: productDetails.brand.brand_name,
        };
        delete updatedProductDetails.brand;
        response.send(updatedProductDetails);
        return;
      }
      response.send("product not found");
    } else {
      logger.error(`Unauthorized- in getProductList api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (err) {
    logger.error(
      `Internal server error: ${err.message} in tagParentProduct api`
    );
  } finally {
    await prisma.$disconnect();
  }
};

////////////////////supplier//////////////////////////////////////////////

const productadd = async (request, response) => {
  console.log("reee", request.body);
  const usertype = request.user.userType;
  try {
    if (usertype === "SUP") {
      const product_id = request.body.product_id;
      if (
        product_id === null ||
        product_id === undefined ||
        product_id === ""
      ) {
        const maxProductId = await prisma.product_master.findFirst({
          select: {
            product_id: true,
          },
          orderBy: {
            product_id: "desc",
          },
        });
        let new_id;
        if (maxProductId) {
          new_id = maxProductId.product_id + 1;
        } else {
          new_id = 1;
        }
        const product_id = new_id;
        const name = request.body.name;
        let product_desc = request.body.product_desc;
        const type = request.body.Product_type;
        const sup_id = parseInt(request.user.id);
        const brand = request.body.brand; //brand
        const package = request.body.package;
        const no_of_items = parseInt(request.body.no_of_items);
        const manufacturer_code = request.body.mfgcode;
        const unit_of_measure = request.body.measure;
        const image1_link = request.body.image1_link;
        const image2_link = request.body.image2_link;
        const image3_link = request.body.image3_link;
        const color = request.body.color;
        const color_family = request.body.color_family;
        let product_code = request.body.product_code;
        const min_stk = request.body.min_stk;

        let responsepText = "";
        if (name === null || name === undefined || name === "") {
          responsepText = "Product Name cannot be blank";
          response.status(401).json(responsepText);
          return;
        } else if (type === null || type === undefined || type === "") {
          responsepText = "Please choose product type";
          response.status(401).json(responsepText);
          return;
        } else if (brand === null || brand === undefined || brand === "") {
          responsepText = "Please choose product brand";
          response.status(401).json(responsepText);
          return;
        } else {
          const brands = await prisma.brand.findFirst({
            select: {
              brand_id: true,
              brand_code: true,
            },
            where: {
              brand_name: {
                equals: brand,
              },
            },
          });

          const brandid = brands.brand_id;
          const brandcode = brands.brand_code;
          let ptypeforspec = type.length > 5 ? type.substring(0, 5) : type;

          if (product_desc === null || product_desc === undefined) {
            product_desc = name;
          }
          if (product_code) {
            const foundProductCode = await prisma.product_master.findUnique({
              where: {
                product_code: product_code,
              },
              select: {
                product_code: true,
              },
            });
            if (foundProductCode) {
              return response
                .status(409)
                .json({ error: "product code already used" });
            }
          } else {
            if (color === null || color === undefined) {
              product_code =
                brandcode + ptypeforspec + color_family + product_desc + name;
            } else if (color.length < 5) {
              product_code =
                brandcode +
                ptypeforspec +
                color +
                color_family +
                product_desc +
                name;
            } else {
              product_code =
                brandcode +
                ptypeforspec +
                color.substring(0, 5) +
                color_family +
                product_desc +
                name;
            }
          }

          const p_created = new Date();
          const newProduct = await prisma.product_master.create({
            data: {
              product_id: product_id,
              product_code: product_code,
              product_name: name,
              product_desc: product_desc,
              product_type: type,
              is_active: "N",
              supplier_id: sup_id,
              brand_id: brandid,
              package: package,
              no_of_items: no_of_items || 0,
              manufacturer_code: manufacturer_code,
              created_date: istDate,
              unit_of_measure: unit_of_measure,
              updated_date: p_created,
              image1_link: image1_link,
              image2_link: image2_link,
              image3_link: image3_link,
              images: true,
              color: color,
              color_family: color_family,
              min_stk: parseInt(min_stk),
            },
          });
          const responsepText =
            name + " added to the Product master successfully..";
          const notification_text =
            name + " added to the Product master successfully by " + sup_id;
          const notification = await prisma.adm_notification.create({
            data: {
              text: notification_text,
              sender: sup_id,
              read: "N",
              type: "PD",
              created_date: istDate,
              created_by: sup_id,
              verification_id: product_id.toString(),
            },
          });
          response.status(201).json(responsepText);
        }
      }
    } else {
      logger.error(`Unauthorized- in productadd api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an supplier" });
    }
  } catch (err) {
    console.log(err.message);
    logger.error(`Internal server error: ${err.message} in productadd api`);
    response.status(500).json("Internal Server Error");
  } finally {
    await prisma.$disconnect();
  }
};

const getProductList = async (request, response) => {
  console.log("getProductList=======", request.body);
  let searchtext = request.body.query;
  let supplier = request.body.trade_name;
  let campaign = request?.body?.campaign;
  const id = request.user.id;
  const usertype = request.user.userType;
  let division;
  if (usertype === "ADM") {
    const userdata = await prisma.users.findFirst({
      where: {
        id: id,
      },
      select: {
        user_id: true,
      },
    });
    const divisiondata = await prisma.staff_users.findFirst({
      where: {
        user_id: userdata?.user_id,
      },
      select: {
        division: true,
      },
    });
    division = divisiondata?.division;
    console.log("division", division);
  }
  if (!searchtext) {
    searchtext = null;
  }
  if (!supplier) {
    supplier = null;
  }
  if (searchtext === null && supplier === null) {
    if (campaign) {
      const productList = await prisma.product_master.findMany({
        where: {
          is_active: "Y",
        },
        orderBy: {
          product_id: "desc",
        },
        select: {
          product_id: true,
          product_name: true,
          color_family: true,
          product_code: true,
          color: true,
          product_sub_type: true,
          prod_subtype2: true,
          min_stk: true,
        },
      });

      const modifiedProductList = productList.map((products) => ({
        ...products,
        checked: false,
      }));
      return response.status(201).json(modifiedProductList);
    }
    const productList = await prisma.product_master.findMany({
      where: {
        is_active: "Y",
      },
      orderBy: {
        product_id: "desc",
      },
      select: {
        product_id: true,
        product_name: true,
        product_code: true,
        color_family: true,
        color: true,
        product_type: true,
        product_sub_type: true,
        prod_subtype2: true,
        image1_link: true,
        image2_link: true,
        image3_link: true,
        images: true,
        min_stk: true,
        users: {
          select: {
            trade_name: true,
          },
        },
        brand: {
          select: {
            brand_name: true,
          },
        },
      },
    });

    response.status(201).json(productList);
  } else if (supplier === null) {
    const searchquery = `%${searchtext}%`;
    const productList = await prisma.product_master.findMany({
      where: {
        is_active: "Y",
        OR: [
          { product_code: { contains: searchquery, mode: "insensitive" } },
          { product_name: { contains: searchquery, mode: "insensitive" } },
          { product_desc: { contains: searchquery, mode: "insensitive" } },
          { product_type: { contains: searchquery, mode: "insensitive" } },
          { product_sub_type: { contains: searchquery, mode: "insensitive" } },
        ],
      },
      select: {
        product_id: true,
        product_name: true,
      },
      orderBy: {
        product_id: "desc",
      },
    });

    // response.status(200).json(productList);
    let productDataArray = [];

    // Filter and accumulate quantities for accessories with valid productDetails
    for (const prod of productList) {
      const productDetails = await prisma.inventory.findFirst({
        where: {
          prod_id: prod.product_id,
        },
        select: {
          total_quantity: true,
        },
      });

      if (productDetails) {
        // Product is in the inventory
        productDataArray.push({
          prod_id: prod.product_id,
          product_name: prod.product_name,
          color_family: prod.color_family,
          total_quantity: productDetails.total_quantity,
        });
      } else {
        // Product is not in the inventory, get data from product_master
        productDataArray.push({
          prod_id: prod.product_id,
          product_name: prod.product_name,
          color_family: prod.color_family, // Change this field name as needed
          total_quantity: 0, // Assuming total_quantity is 0 for products not in inventory
        });
      }
    }

    response.status(200).json(productDataArray);
  } else if (searchtext === null && supplier != null) {
    const supplierData = await prisma.users.findFirst({
      where: {
        trade_name: {
          equals: supplier,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    });
    if (!supplierData) {
      return response.status(404).json({ message: "Supplier not found!" });
    }

    const sup_id = supplierData?.id;
    // const division = request.body.division
    if (division != null) {
      const productList = await prisma.product_master.findMany({
        where: {
          supplier_id: sup_id,
          is_active: "Y",
          product_type: division,
        },
        orderBy: {
          product_id: "desc",
        },
        select: {
          product_id: true,
          color: true,
          product_name: true,
          color_family: true,
          product_type: true,
          product_sub_type: true,
          prod_subtype2: true,
          image1_link: true,
          image2_link: true,
          image3_link: true,
          images: true,
          product_code: true,
          product_desc: true,
          product_spec: true,
          min_stk: true,
          users: {
            select: {
              trade_name: true,
            },
          },
          brand: {
            select: {
              brand_name: true,
            },
          },
        },
      });

      let productDataArray = [];

      for (const prod of productList) {
        const productDetails = await prisma.inventory.findMany({
          where: {
            prod_id: prod.product_id,
          },
          select: {
            total_quantity: true,
            prod_id: true,
          },
        });
        if (productDetails.length > 0) {
          const totalQuantity = productDetails.reduce(
            (acc, item) => acc + item.total_quantity,
            0
          );

          const existingProduct = productDataArray.find(
            (item) => item.prod_id === prod.product_id
          );

          if (existingProduct) {
            existingProduct.total_quantity += totalQuantity;
          } else {
            productDataArray.push({
              prod_id: prod.product_id,
              product_name: prod.product_name,
              color_family: prod.color_family,
              total_quantity: totalQuantity, // Set to the accumulated total
              product_code: prod.product_code,
              product_desc: prod.product_desc,
              product_type: prod.product_type,
              image1_link: prod.image1_link,
              image2_link: prod.image2_link,
              image3_link: prod.image3_link,
              color: prod.color,
              product_spec: prod.product_spec,
              trade_name: prod.users,
              brand_name: prod.brand,
            });
          }
        } else {
          // Product is not in the inventory, initialize total_quantity to zero
          productDataArray.push({
            prod_id: prod.product_id,
            product_name: prod.product_name,
            color_family: prod.color_family,
            total_quantity: 0,
            product_code: prod.product_code,
            product_desc: prod.product_desc,
            product_type: prod.product_type,
            image1_link: prod.image1_link,
            image2_link: prod.image2_link,
            image3_link: prod.image3_link,
            color: prod.color,
            product_spec: prod.product_spec,
            trade_name: prod.users,
            brand_name: prod.brand,
          });
        }
      }

      return response.status(200).json(productDataArray);
    } else {
      const productList = await prisma.product_master.findMany({
        where: {
          supplier_id: sup_id,
          is_active: "Y",
        },
        select: {
          product_id: true,
          color: true,
          product_name: true,
          color_family: true,
          product_type: true,
          product_sub_type: true,
          prod_subtype2: true,
          image1_link: true,
          image2_link: true,
          image3_link: true,
          product_code: true,
          product_desc: true,
          product_spec: true,
          min_stk: true,
          users: {
            select: {
              trade_name: true,
            },
          },
          brand: {
            select: {
              brand_name: true,
            },
          },
        },
      });

      let productDataArray = [];
      for (const prod of productList) {
        const productDetails = await prisma.inventory.findMany({
          where: {
            prod_id: prod.product_id,
          },
          select: {
            total_quantity: true,
            prod_id: true,
          },
        });
        if (productDetails.length > 0) {
          const totalQuantity = productDetails.reduce(
            (acc, item) => acc + item.total_quantity,
            0
          );
          const existingProduct = productDataArray.find(
            (item) => item.prod_id === prod.product_id
          );
          const stockStatus =
            totalQuantity <= prod.min_stk ? "outofstock" : "instock";
          if (existingProduct) {
            existingProduct.total_quantity += totalQuantity;
            existingProduct.stock_status = stockStatus;
          } else {
            productDataArray.push({
              prod_id: prod.product_id,
              product_name: prod.product_name,
              color_family: prod.color_family,
              total_quantity: totalQuantity, // Set to the accumulated total
              product_code: prod.product_code,
              product_desc: prod.product_desc,
              product_type: prod.product_type,
              image1_link: prod.image1_link,
              image2_link: prod.image2_link,
              image3_link: prod.image3_link,
              color: prod.color,
              product_spec: prod.product_spec,
              trade_name: prod.users,
              brand_name: prod.brand,
              min_stk: prod.min_stk,
              stock_status: stockStatus,
            });
          }
        } else {
          // Product is not in the inventory, initialize total_quantity to zero
          productDataArray.push({
            prod_id: prod.product_id,
            product_name: prod.product_name,
            color_family: prod.color_family,
            total_quantity: 0,
            product_code: prod.product_code,
            product_desc: prod.product_desc,
            product_type: prod.product_type,
            image1_link: prod.image1_link,
            image2_link: prod.image2_link,
            image3_link: prod.image3_link,
            color: prod.color,
            product_spec: prod.product_spec,
            trade_name: prod.users,
            brand_name: prod.brand,
            min_stk: prod.min_stk,
            stock_status: "outofstock",
          });
        }
      }

      response.status(200).json(productDataArray);
    }
  } else {
    const searchquery = `%${searchtext}%`;
    const supplierData = await prisma.users.findFirst({
      where: {
        trade_name: supplier,
      },
      select: {
        id: true,
      },
    });
    const sup_id = supplierData.id;
    const productList = await prisma.product_master.findMany({
      where: {
        AND: [
          {
            OR: [
              { product_code: { contains: searchquery, mode: "insensitive" } },
              { product_name: { contains: searchquery, mode: "insensitive" } },
              { product_desc: { contains: searchquery, mode: "insensitive" } },
              { product_type: { contains: searchquery, mode: "insensitive" } },
              {
                product_sub_type: {
                  contains: searchquery,
                  mode: "insensitive",
                },
              },
            ],
          },
          { supplier_id: sup_id },
        ],
      },
      select: {
        product_id: true,
        product_name: true,
        color_family: true,
        product_type: true,
        product_sub_type: true,
        prod_subtype2: true,
        image1_link: true,
        image2_link: true,
        image3_link: true,
        product_code: true,
        product_desc: true,
        product_spec: true,
      },
      orderBy: {
        product_id: "desc",
      },
    });
    let productDataArray = [];

    for (const prod of productList) {
      const productDetails = await prisma.inventory.findMany({
        where: {
          prod_id: prod.product_id,
        },
        select: {
          total_quantity: true,
          prod_id: true,
        },
      });

      if (productDetails.length > 0) {
        const totalQuantity = productDetails.reduce(
          (acc, item) => acc + item.total_quantity,
          0
        );

        const existingProduct = productDataArray.find(
          (item) => item.prod_id === prod.product_id
        );

        if (existingProduct) {
          existingProduct.total_quantity += totalQuantity;
        } else {
          productDataArray.push({
            prod_id: prod.product_id,
            product_name: prod.product_name,
            color_family: prod.color_family,
            total_quantity: totalQuantity, // Set to the accumulated total
            product_code: prod.product_code,
            product_desc: prod.product_desc,
            product_type: prod.product_type,
            image1_link: prod.image1_link,
            image2_link: prod.image2_link,
            image3_link: prod.image3_link,
            color: prod.color,
            product_spec: prod.product_spec,
            trade_name: prod.users,
            brand_name: prod.brand,
          });
        }
      } else {
        productDataArray.push({
          prod_id: prod.product_id,
          product_name: prod.product_name,
          color_family: prod.color_family,
          total_quantity: 0,
          product_code: prod.product_code,
          product_desc: prod.product_desc,
          product_type: prod.product_type,
          image1_link: prod.image1_link,
          image2_link: prod.image2_link,
          image3_link: prod.image3_link,
          color: prod.color,
          product_spec: prod.product_spec,
          trade_name: prod.users,
          brand_name: prod.brand,
        });
      }
    }

    response.status(200).json(productDataArray);
  }
};

const productapprovelist = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const type = await prisma.product_master.findMany({
        where: {
          is_active: "N",
        },
        orderBy: {
          product_id: "desc",
        },
        select: {
          product_name: true,
          product_id: true,
          created_date: true,
          color: true,
          users: {
            select: {
              user_name: true,
              trade_name: true,
            },
          },
        },
      });
      response.status(201).json(type);
    } else {
      logger.error(`Unauthorized- in productvarient api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in productapprovelist api`
    );
  } finally {
    await prisma.$disconnect();
  }
};

const productapprove = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const product_id = request.body.product_id;
      const approvalflag = request.body.approvalflag;
      const product_sub_type = request.body.product_sub_type;
      const prod_subtype2 = request.body.prod_subtype2;
      const product_code = request.body.product_code;

      if (approvalflag == null) {
        const responsepText = "Error! Approval cannot be null";
        response.status(400).json({ error: responsepText });
      } else {
        const productData = await prisma.product_master.findUnique({
          where: {
            product_id: product_id,
          },
          select: {
            product_code: true,
          },
        });

        if (!productData) {
          return response.status(404).json({ error: "Product not found" });
        }

        if (product_code && product_code !== productData.product_code) {
          const foundProductCode = await prisma.product_master.findUnique({
            where: {
              product_code: product_code,
            },
            select: {
              product_code: true,
              supplier_id: true,
            },
          });

          if (foundProductCode) {
            return response
              .status(500)
              .json({ message: "Product code already in use" });
          } else {
            await prisma.product_master.update({
              where: {
                product_id: product_id,
              },
              data: {
                is_active: approvalflag,
                product_code: product_code,
                product_sub_type: product_sub_type,
                prod_subtype2: prod_subtype2,
              },
            });
          }
        } else {
          // If product_code is the same, update other fields
          await prisma.product_master.update({
            where: {
              product_id: product_id,
            },
            data: {
              is_active: approvalflag,
              product_sub_type: product_sub_type,
              prod_subtype2: prod_subtype2,
            },
          });
        }
        const product = await prisma.product_master.findUnique({
          where: {
            product_id: product_id,
          },
          select: {
            product_name: true,
            supplier_id: true,
          },
        });
        let responsepText = "";
        if (approvalflag === "Y") {
          responsepText = `Product ${product.product_name} is approved`;
          const p_created = new Date();
          const notification = await prisma.cus_notification.create({
            data: {
              text: responsepText,
              receiver: product.supplier_id,
              read: "N",
              type: "PD",
              created_date: istDate,
              verification_id: product_id.toString(),
              // created_by:sup_id
            },
          });
        } else if (approvalflag === "N") {
          responsepText = `M/s ${product.product_name} has been made inactive`;
          const p_created = new Date();
          const notification = await prisma.cus_notification.create({
            data: {
              text: responsepText,
              receiver: product.supplier_id,
              read: "N",
              type: "PD",
              created_date: istDate,
              verification_id: product_id.toString(),
              // created_by:sup_id
            },
          });
        }
        ////////////notification//////////
        response.status(200).json({ message: responsepText });
      }
    } else {
      logger.error(`Unauthorized- in productapprove api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in productapprove api`
    );
    response.status(500).json({ error: error.message });
  } finally {
    await prisma.$disconnect();
  }
};

const type_prodlist = async (request, response) => {
  const usertype = request.user.userType;
  console.log("usertype====================", usertype);
  try {
    if (usertype == "CUS" || usertype === "SUP") {
      const logged_id = request.user.id;
      const product_type = await prisma.users.findMany({
        where: {
          id: logged_id,
        },
        select: {
          product_type: true,
        },
        orderBy: {
          id: "desc",
        },
      });
      const userProdTypes = Object.values(product_type[0].product_type);
      let ProdListDetailed = [];
      for (let i = 0; i < userProdTypes.length; i++) {
        const prodData = await prisma.product_master.findMany({
          where: {
            product_type: userProdTypes[i],
          },
        });
        ProdListDetailed.push(...prodData);
      }
      response.send(ProdListDetailed);
    } else {
      logger.error(`Unauthorized- in productvarient api`);
      return response.status(403).json({ message: "Unauthorized." });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in type_prodlist api `
    );
  } finally {
    await prisma.$disconnect();
  }
};

const prod_typelist = async (request, response) => {
  const usertype = request.user.userType;
  console.log("prod_typelist=======", usertype);
  try {
    if (usertype == "CUS" || usertype === "SUP") {
      const logged_id = request.user.id;
      const product_type = await prisma.users.findMany({
        where: {
          id: logged_id,
        },
        select: {
          product_type: true,
        },
        orderBy: {
          id: "desc",
        },
      });
      const values = Object.values(product_type[0].product_type);
      response.status(200).json(values);
    } else {
      logger.error(`Unauthorized- in productvarient api`);
      return response.status(403).json({ message: "Unauthorized." });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in prod_typelist api`
    );
  } finally {
    await prisma.$disconnect();
  }
};

const productvarient = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype == "ADM" || usertype === "SU") {
      const product_id = request.body.product_id;
      if (product_id) {
        const product_data = await prisma.product_master.findFirst({
          where: {
            product_id: product_id,
          },
          select: {
            parent_product_id: true,
          },
        });
        if (product_data.parent_product_id == null) {
          response.status(404).json("no similar products");
        } else {
          const data = await prisma.product_master.findMany({
            where: {
              parent_product_id: product_data.parent_product_id,
            },
            include: {
              brand: true,
            },
          });
          response.status(200).json({ data });
        }
      } else {
        logger.error(`product_id is undefined in productvarient api`);
      }
    } else {
      logger.error(`Unauthorized- in productvarient api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in productvarient api`
    );
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};
// ------------------------
const s3Client = new S3Client({
  region: "s3-bucket-region",
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRETACCESSKEY,
  },
});

function fileToBuffer(filePath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath);
    const chunks = [];

    fileStream.on("data", (chunk) => {
      chunks.push(chunk);
    });

    fileStream.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer);
      fileStream.destroy();
    });

    fileStream.on("error", (error) => {
      reject(error);
    });
  });
}

async function bufferedFileUpload(filePath) {
  try {
    const objFile = await fileToBuffer(filePath);

    const s3UploadParams = {
      Bucket: process.env.AWS_S3_ACCESS_BUCKET_NAME,
      Key: path.basename(filePath), // Use filename from original path
      Body: objFile.buffer,
      ContentType: mime.getType(filePath),
    };

    const putObjectCommand = new PutObjectCommand(s3UploadParams);
    console.time("uploading");
    const response = await s3Client.send(putObjectCommand);

    console.log(response);
    console.timeEnd("uploading");
  } catch (error) {
    console.error(error);
  } finally {
    s3Client.destroy();
  }
}

const uploadFile = async (req, res) => {
  try {
    // Retrieve the file from the request (replace with your logic)
    console.log(req.body);
    const filePath = req.file; // Example, adjust based on your framework

    // Call the bufferedFileUpload function
    await bufferedFileUpload(filePath);

    res.status(200).json({ message: "File uploaded successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error uploading file" });
  }

  console.log("fileeeeeee");
};

async function importProductsFromExcel(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet, { defval: "" }); // Keep empty cells as ""

  for (const row of data) {
    const brand = row["COMPANY"]?.toString().trim();
    const category = row["CATEGORY"]?.toString().trim();
    const name = row["ITEMS"]?.toString().trim();
    const item_code = row["ITEM COD"]?.toString().trim();

    // Skip incomplete or malformed rows
    if (!brand || !category || !name || !item_code) continue;

    try {
      // Check for duplicate based on name + brand + category
      const existing = await prisma.product_master.findFirst({
        where: {
          name,
          brand,
          category,
        },
      });

      if (existing) {
        console.log(
          `Duplicate found: ${name} (${brand}/${category}) – Skipping`
        );
        continue;
      }

      // Check for unique item_code
      const itemCodeExists = await prisma.product_master.findUnique({
        where: {
          item_code: item_code,
        },
      });

      if (itemCodeExists) {
        console.log(`Item code already exists: ${item_code} – Skipping`);
        continue;
      }

      await prisma.product_master.create({
        data: {
          name,
          brand,
          category,
          item_code,
        },
      });

      console.log(`Inserted: ${name} (${brand}/${category})`);
    } catch (err) {
      console.error(`Error inserting row [${name}]:`, err.message);
    }
  }

  console.log("Import completed.");
}

// Example call
// Run from local Excel file placed beside server.js (optional trigger)
const excelFilePath = path.join(__dirname, "../../happy_stockUpdate.xlsx");

// const importFromLocalExcel = async (req, res) => {
//   try {
//     const excelFilePath = path.join(__dirname, "../../happy_stockUpdate.xlsx");

//     const workbook = xlsx.readFile(excelFilePath);
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });

//     const inserted = [];
//     const skipped = [];

//     for (const row of data) {
//       const category = row["CATEGORY"]?.toString().trim();
//       const name = row["ITEMS"]?.toString().trim();
//       const item_code = row["ITEM COD"]?.toString().trim();
//       const product_type = "baby";
//       const brand_id = row["Brand_id"]?.toString().trim();
//       const supplier_id = row["supplier_id"]?.toString().trim();
//       const unit_of_measure=row["Unit pieces"]?.toString().trim();

//       if (!brand_id || !category || !name) {
//         skipped.push({ reason: "Missing fields", row });
//         continue;
//       }

//       const existing = await prisma.product_master.findFirst({
//         where: {
//           product_name: name,
//           brand_id: parseInt(brand_id),
//           product_sub_type: category,
//         },
//       });

//       if (existing) {
//         skipped.push({ reason: "Duplicate", row });
//         continue;
//       }

//       // Auto-generate product_code if missing or already used
//       let final_product_code = item_code;
//       if (!final_product_code || final_product_code.trim() === "") {
//         const baseCode = `BR${brand_id}_${name
//           .replace(/\s+/g, "_")
//           .toUpperCase()}`;
//         let counter = 1;
//         let generatedCode = baseCode;

//         // Ensure uniqueness
//         while (
//           await prisma.product_master.findUnique({
//             where: { product_code: generatedCode },
//           })
//         ) {
//           generatedCode = `${baseCode}_${counter++}`;
//         }

//         final_product_code = generatedCode;
//       } else {
//         // If code exists already, skip
//         const codeExists = await prisma.product_master.findUnique({
//           where: { product_code: final_product_code },
//         });

//         if (codeExists) {
//           skipped.push({ reason: "Duplicate product_code", row });
//           continue;
//         }
//       }

//       await prisma.product_master.create({
//         data: {
//           product_name: name,
//           brand_id: parseInt(brand_id),
//           product_sub_type: category,
//           supplier_id: supplier_id ? parseInt(supplier_id) : null,
//           product_code: final_product_code,
//           product_type,
//           is_active:"Y"
//         },
//       });

//       inserted.push({
//         name,
//         brand_id,
//         category,
//         product_code: final_product_code,
//       });
//     }

//     res.status(200).json({
//       message: "✅ Local Excel Import Completed",
//       insertedCount: inserted.length,
//       skippedCount: skipped.length,
//       skippedRows: skipped,
//     });
//   } catch (e) {
//     console.error("❌ Error importing local Excel:", e.message);
//     res.status(500).json({ error: "Failed to import Excel file." });
//   } finally {
//     await prisma.$disconnect();
//   }
// };

const importFromLocalExcel = async (req, res) => {
  try {
    const excelFilePath = path.join(__dirname, "../../happy_stockUpdate.xlsx");

    const workbook = xlsx.readFile(excelFilePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    const inserted = [];
    const updated = [];
    const skipped = [];

    for (const row of data) {
      const category = row["CATEGORY"]?.toString().trim();
      const name = row["ITEMS"]?.toString().trim();
      const item_code = row["ITEM COD"]?.toString().trim();
      const product_type = "baby";
      const brand_id = row["Brand_id"]?.toString().trim();
      const supplier_id = row["supplier_id"]?.toString().trim();
      const unit_of_measure = row["Unit pieces"]?.toString().trim();

      const openingStockRaw = row["Opening stock"];
      const sellingPriceRaw = row["Selling Price.(Rs)"];
      const basePriceRaw = row["Landing Price (Rs)"];

      const openingStock =
        openingStockRaw !== "" ? parseInt(openingStockRaw) : null;
      const sellingPrice =
        sellingPriceRaw !== "" ? parseInt(sellingPriceRaw) : null;
      const basePrice = basePriceRaw !== "" ? parseInt(basePriceRaw) : null;
      const batch_id = row["Batch No"]?.toString().trim() || "TY4567";

      if (!brand_id || !category || !name) {
        skipped.push({ reason: "Missing fields", row });
        continue;
      }

      const existing = await prisma.product_master.findFirst({
        where: {
          product_name: name,
          brand_id: parseInt(brand_id),
          product_sub_type: category,
        },
      });

      if (existing) {
        // Update product master
        await prisma.product_master.update({
          where: { product_id: existing.product_id },
          data: {
            unit_of_measure: unit_of_measure || existing.unit_of_measure,
            supplier_id: supplier_id
              ? parseInt(supplier_id)
              : existing.supplier_id,
            updated_date: new Date(),
          },
        });
        if (
          openingStock !== null ||
          sellingPrice !== null ||
          basePrice !== null
        ) {
          // Update or create inventory
          const existingInventory = await prisma.inventory.findFirst({
            where: { prod_id: existing.product_id },
          });

          if (existingInventory) {
            await prisma.inventory.updateMany({
              where: { prod_id: existing.product_id },
              data: {
                total_quantity: openingStock,
                selling_price: sellingPrice,
                base_price: basePrice,
                batch_id: batch_id,
                updated_date: new Date(),
              },
            });
          } else {
            await prisma.inventory.create({
              data: {
                prod_id: existing.product_id,
                batch_id: batch_id,
                total_quantity: openingStock,
                selling_price: sellingPrice,
                base_price: basePrice,
                created_date: istDate,
              },
            });
          }
        }

        updated.push({
          name,
          brand_id,
          category,
          updated_fields: {
            unit_of_measure,
            supplier_id,
            openingStock,
            sellingPrice,
          },
        });

        continue;
      }

      // Auto-generate product_code
      let final_product_code = item_code;
      if (!final_product_code || final_product_code.trim() === "") {
        const baseCode = `BR${brand_id}_${name
          .replace(/\s+/g, "_")
          .toUpperCase()}`;
        let counter = 1;
        let generatedCode = baseCode;

        while (
          await prisma.product_master.findUnique({
            where: { product_code: generatedCode },
          })
        ) {
          generatedCode = `${baseCode}_${counter++}`;
        }

        final_product_code = generatedCode;
      } else {
        const codeExists = await prisma.product_master.findUnique({
          where: { product_code: final_product_code },
        });

        if (codeExists) {
          skipped.push({ reason: "Duplicate product_code", row });
          continue;
        }
      }

      // Create product
      const newProduct = await prisma.product_master.create({
        data: {
          product_name: name,
          brand_id: parseInt(brand_id),
          product_sub_type: category,
          supplier_id: supplier_id ? parseInt(supplier_id) : null,
          product_code: final_product_code,
          product_type,
          unit_of_measure,
          is_active: "Y",
        },
      });
      if (
        openingStock !== null ||
        sellingPrice !== null ||
        basePrice !== null
      ) {
        // Create inventory
        await prisma.inventory.create({
          data: {
            prod_id: newProduct.product_id,
            total_quantity: openingStock,
            selling_price: sellingPrice,
            batch_id: batch_id,
            base_price: basePrice,
            created_date: istDate,
          },
        });
      }

      inserted.push({
        name,
        brand_id,
        category,
        product_code: final_product_code,
        openingStock,
        sellingPrice,
      });
    }

    res.status(200).json({
      message: "✅ Local Excel Import Completed",
      insertedCount: inserted.length,
      updatedCount: updated.length,
      skippedCount: skipped.length,
      inserted,
      updated,
      skippedRows: skipped,
    });
  } catch (e) {
    console.error("❌ Error importing local Excel:", e.message);
    res.status(500).json({ error: "Failed to import Excel file." });
  } finally {
    await prisma.$disconnect();
  }
};

module.exports = {
  manageBrand,
  viewbrands,
  productmgmt,
  updatedProduct,
  type_prodlist,
  getProductList,
  getProductDetails,
  getCategories,
  addCategories,
  categoryMasterview,
  updateSpecs,
  manageCategories,
  deleteproduct,
  getspec,
  tagParentProduct,
  productapprove,
  productapprovelist,
  productadd,
  prod_typelist,
  productvarient,
  uploadFile,

  importFromLocalExcel,
};
