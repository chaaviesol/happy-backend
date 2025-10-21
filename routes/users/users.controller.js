const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const path = require("path");
const { stringify } = require("querystring");
const { isDate } = require("util/types");
const winston = require("winston");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { response } = require("express");
require("dotenv").config();

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

const addUsers = async (request, response) => {
  console.log("rttt", request.body);
  try {
    const {
      type: type,
      name: name,
      password: password,
      email: email,
      exp: exp,
      mob: mob,
      landline: landline,
      website: website,
      address: address,
      prod_type: prod_type,
      gst: gst,
      sup_code: sup_code,
      tradename: tradename,
      Tradeoption: Tradeoption,
      grade :grade
    } = request.body;
    if (type && name && mob) {
      // Example usage:
      // const mobileNumber = mob;
      // if (validateMobileNumber(mobileNumber)) {
      //   console.log('Valid mobile number');
      // } else {
      //   console.log('Invalid mobile number');
      //   const resptext = "Invalid mobile number"
      //   return response.send(resptext);
      // }
      // function validateMobileNumber(mobileNumber) {
      //   // Regular expression for a valid 10-digit Indian mobile number
      //   const mobileNumberRegex = /^[6-9]\d{9}$/;

      //   return mobileNumberRegex.test(mobileNumber);
      // }
      // Example usage:
      // const email_id = email;
      // if (validateEmail(email_id)) {
      //   console.log('Valid email address');
      // } else {
      //   console.log('Invalid email address');
      //   const resptext = "Invalid email address"
      //   return response.send(resptext);
      // }
      // function validateEmail(email_id) {
      //   // Regular expression for a simple email validation
      //   const emailRegex = /^[^\s@]+@gmail\.com$/;

      //   return emailRegex.test(email_id);
      // }

      const u_approved = "Y";
      const u_active = "Y";
      const u_flagged = "N";

      const maxIdResult = await prisma.users.findFirst({
        select: {
          id: true,
        },
        orderBy: {
          id: "desc",
        },
      });

      const new_id = maxIdResult ? maxIdResult.id + 1 : 1;
      let user_type_upper = type.toUpperCase();
      const recentUserResults = await prisma.users.findMany({
        select: {
          id: true,
          created_date: true,
        },
        where: {
          user_type: user_type_upper,
          created_date: {
            gte: new Date(istDate.getFullYear(), 0, 1),
            lt: new Date(istDate.getFullYear() + 1, 0, 1),
          },
        },
        orderBy: {
          id: "desc",
        },
      });

      const month = ("0" + (istDate.getMonth() + 1)).slice(-2);
      let new_user_id = 1;

      if (recentUserResults) {
        new_user_id = recentUserResults.length + 1;
      } else if (recentUserResults == null || recentUserResults == undefined) {
        // Handle the case when there are no matching records
        new_user_id = 1;
      }

      const u_id =
        type.toUpperCase() +
        istDate.getFullYear() +
        month +
        ("0000" + new_user_id).slice(-4);

      const hashedPass = await bcrypt.hash(password, 5);
      await prisma.users.create({
        data: {
          id: new_id,
          user_id: u_id,
          user_name: name,
          password: hashedPass,
          email: email,
          yearsinbusiness: exp,
          mobile: mob,
          landline: landline,
          website: website,
          address: address,
          created_date: istDate,
          last_accessed_date: istDate,
          updated_date: istDate,
          product_type: prod_type,
          is_approved: u_approved,
          is_active: u_active,
          user_type: type.toUpperCase(),
          gst_num: gst,
          is_user_flagged: u_flagged,
          trade_name: tradename,
          sup_code: sup_code,
          trade_option: Tradeoption,
          grade:grade
        },
      });

      const respText =
        "User with ID " + u_id + " is created";
      const notification = await prisma.adm_notification.create({
        data: {
          text: respText,
          sender: new_id,
          read: "N",
          type: "UR",
          created_date: istDate,
          verification_id: u_id,
        },
      });
      response.status(201).json(respText);
    } else {
      logger.error(`All fields are mandatory in addUsers api`);
      response.status(500).json("All fields are mandatory");
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in addUsers api`);
    response.status(500).json("An error occurred");
  } finally {
    await prisma.$disconnect();
  }
};

const updateuser = async (request, response) => {
  try {
    const user_id = request.body.user_id;

    const updatelog = await prisma.users.findUnique({
      where: {
        user_id: user_id,
      },
    });

    if (!updatelog) {
      const respText = "User not found!";
      response.status(201).json(respText);
    } else {
      const {
        user_name,
        password,
        email,
        yearsinbusiness,
        mobile,
        landline,
        website,
        address,
        grade
      } = request.body;

      try {
        const updatedUser = await prisma.users.update({
          where: {
            user_id: user_id,
          },
          data: {
            user_name: user_name,
            password: password,
            email: email,
            yearsinbusiness: yearsinbusiness,
            mobile: mobile,
            landline: landline,
            website: website,
            address: address,
            updated_date: istDate,
            grade:grade
          },
        });
        const respText = user_name + " updated successfully";
        response.status(201).json({ message: respText, data: updatedUser });
      } catch (err) {
        response.status(500).json("Internal Server Error");
      }
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in updateuser api`);
    response.status(500).json(error.message);
  } finally {
    await prisma.$disconnect();
  }
};

const deleteuser = async (request, response) => {
  try {
    const user_id = request.body.user_id;
    const userdel = await prisma.users.findFirst({
      where: {
        user_id: user_id,
      },
    });

    if (!userdel) {
      const respText = "User not found!";
      response.status(201).json(respText);
    } else {
      const updatedRecord = await prisma.users.update({
        where: {
          user_id: user_id,
        },
        data: {
          is_active: "N",
        },
      });
      const respText = "User deleted!";
      response.status(201).json(respText);
    }
  } catch (err) {
    logger.error(`Internal server error: ${err.message} in deleteuser api`);
    response.status(500).json("Internal Server Error");
  } finally {
    await prisma.$disconnect();
  }
};

////////admin/////////////
const addadmin = async (request, response) => {
  // const usertype = request.user.userType
  const usertype = "SU";
  try {
    if (usertype === "SU" || usertype === "ADM") {
      const {
        type: type,
        user_name: user_name,
        Password: Password,
        email: email,
        mobile: mobile,
        department: department,
        division: division,
      } = request.body;
      if (type && user_name && Password && email && mobile && division) {
        const up_type = type.toUpperCase();

        // Example usage:
        const mobileNumber = mobile;
        if (validateMobileNumber(mobileNumber)) {
          console.log("Valid mobile number");
        } else {
          console.log("Invalid mobile number");
          const resptext = "Invalid mobile number";
          return response.send(resptext);
        }
        function validateMobileNumber(mobileNumber) {
          // Regular expression for a valid 10-digit Indian mobile number
          const mobileNumberRegex = /^[6-9]\d{9}$/;

          return mobileNumberRegex.test(mobileNumber);
        }
        // Example usage:
        const email_id = email;
        if (validateEmail(email_id)) {
          console.log("Valid email address");
        } else {
          console.log("Invalid email address");
          const resptext = "Invalid email address";
          return response.send(resptext);
        }
        function validateEmail(email_id) {
          // Regular expression for a simple email validation
          const emailRegex = /^[^\s@]+@gmail\.com$/;

          return emailRegex.test(email_id);
        }

        const hasedpass = bcrypt.hashSync(Password, 5);
        const u_created = new Date();

        const maxIdResult = await prisma.users.aggregate({
          _max: {
            id: true,
          },
        });
        const new_id = maxIdResult._max.id + 1;
        const recentUserResult = await prisma.users.findFirst({
          select: {
            id: true,
            created_date: true,
          },
          where: {
            user_type: type,
            // created_date: {
            //   gte: new Date(u_created.getFullYear(), 0, 1),
            //   lt: new Date(u_created.getFullYear() + 1, 0, 1),
            // },
          },
          orderBy: {
            id: "desc",
          },
        });
        const month = ("0" + (u_created.getMonth() + 1)).slice(-2);
        let new_user_id = 1;

        if (recentUserResult) {
          new_user_id = recentUserResult.id + 1;
        } else {
          // Handle the case when there are no matching records
          new_user_id = 1;
        }
        const ad_id =
          type.toUpperCase() +
          u_created.getFullYear() +
          month +
          ("0000" + new_user_id).slice(-4);

        const admin = await prisma.users.create({
          data: {
            id: new_id,
            user_id: ad_id,
            user_name: user_name,
            password: hasedpass,
            email: email,
            mobile: mobile,
            user_type: up_type,
            is_active: "Y",
            created_date: istDate,
          },
        });
        const createStaffUserResponse = await prisma.staff_users.create({
          data: {
            user_id: ad_id,
            division: division,
            department: department,
          },
        });
        response.status(200).json({
          success: true,
          message: "success",
        });
        const respText = "Success";
        // const notification = await prisma.adm_notification.create({
        //   data: {
        //     text: respText,
        //     sender: new_id,
        //     read: "N",
        //     type: "UR",
        //     created_date: istDate,
        //     verification_id: ad_id
        //   }
        // })
      } else {
        logger.error(`All fields are mandatory in addadmin api`);
        response.status(500).json("All fields are mandatory");
      }
    } else {
      logger.error(`Unauthorized- in addadmin api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not a super admin" });
    }
  } catch (error) {
    response.status(500).json(error.message);
    logger.error(`Internal server error: ${error.message} in addadmin api`);
  } finally {
    await prisma.$disconnect();
  }
};

////////////addsuperadmin///////////////////////////////////
const superadmin = async (request, response) => {
  const usertype = request.user.userType;

  try {
    if (usertype === "SU" || usertype === "ADM") {
      const {
        user_name: user_name,
        password: password,
        email: email,
        mobile: mobile,
        // division: division
      } = request.body;
      const type = "ADM";
      if (type && user_name && password && email && mobile) {
        const up_type = "SU";
        // const u_approved = "N";
        // const u_active = "N";
        // const u_flagged = "N";
        // const ad_created = new Date();

        const mobileNumber = mobile;
        if (validateMobileNumber(mobileNumber)) {
          console.log("Valid mobile number");
        } else {
          console.log("Invalid mobile number");
          const resptext = "Invalid mobile number";
          return response.send(resptext);
        }
        function validateMobileNumber(mobileNumber) {
          // Regular expression for a valid 10-digit Indian mobile number
          const mobileNumberRegex = /^[6-9]\d{9}$/;

          return mobileNumberRegex.test(mobileNumber);
        }
        // Example usage:
        const email_id = email;
        if (validateEmail(email_id)) {
          console.log("Valid email address");
        } else {
          console.log("Invalid email address");
          const resptext = "Invalid email address";
          return response.send(resptext);
        }
        function validateEmail(email_id) {
          // Regular expression for a simple email validation
          const emailRegex = /^[^\s@]+@gmail\.com$/;

          return emailRegex.test(email_id);
        }
        const hasedpass = bcrypt.hashSync(password, 5);
        const u_created = new Date();

        const maxIdResult = await prisma.users.aggregate({
          _max: {
            id: true,
          },
        });
        const new_id = maxIdResult._max.id + 1;
        const recentUserResult = await prisma.users.findFirst({
          select: {
            id: true,
            created_date: true,
          },
          where: {
            user_type: type,
          },
          orderBy: {
            id: "desc",
          },
        });
        const month = ("0" + (u_created.getMonth() + 1)).slice(-2);
        let new_user_id = 1;

        if (recentUserResult) {
          new_user_id = recentUserResult.id + 1;
        } else {
          new_user_id = 1;
        }
        const ad_id =
          type.toUpperCase() +
          u_created.getFullYear() +
          month +
          ("0000" + new_user_id).slice(-4);

        const admin = await prisma.users.create({
          data: {
            id: new_id,
            user_id: ad_id,
            user_name: user_name,
            password: hasedpass,
            email: email,
            mobile: mobile,
            user_type: up_type,
            is_active: "Y",
            created_date: istDate,
          },
        });
        response.status(200).json({
          message: "successfully registered",
          success: true,
          error: false,
        });
      } else {
        logger.error(`All fields are mandatory in superadmin api`);
        response.status(500).json("All fields are mandatory");
      }
    } else {
      logger.error(`Unauthorized- in superadmin api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not a super admin" });
    }
  } catch (error) {
    console.log(error);
    response.status(500).json(error.message);
    logger.error(`Internal server error: ${error.message} in addadmin api`);
  } finally {
    await prisma.$disconnect();
  }
};

const viewSuppliers = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const prod_category = request.body.main_type;
      const category = "%" + prod_category + "%";
      const user_type = "SUP";

      const suppliers = await prisma.users.findMany({
        select: {
          user_id: true,
          trade_name: true,
          product_type: true,
        },
        where: {
          user_type: user_type,
          is_approved: "Y",
        },
      });

      let suppArray = [];
      for (i = 0; i < suppliers.length; i++) {
        if (suppliers[i].product_type) {
          const prodTypesArray = Object.values(suppliers[i].product_type);
          if (prodTypesArray.includes(prod_category)) {
            let supData = {
              user_id: suppliers[i].user_id,
              trade_name: suppliers[i].trade_name,
            };

            suppArray.push(supData);
          }
        }
      }

      response.status(200).json(suppArray);
    } else {
      logger.error(`Unauthorized- in viewSuppliers api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in viewSuppliers api`
    );
    response.status(500).json(error.message);
  } finally {
    await prisma.$disconnect();
  }
};

///////////userdetails/////////
const viewUserDetails = async (request, response) => {
  const user_id = request.body.user_id;
  try {
    if (user_id) {
      const viewuser = await prisma.users.findFirst({
        where: {
          user_id: user_id,
        },
      });
      response.status(201).json(viewuser);
    } else {
      logger.error("user_id is undefined in viewUserDetails api");
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in viewUserDetails api`
    );
    response.status(500).json(error.message);
  } finally {
    await prisma.$disconnect();
  }
};

const userApproval = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "SU" || usertype === "ADM") {
      const user_id = request.body.user_id;
      const approvalflag = request.body.approvalflag;
      const mod_date = new Date();
      const sup_code = request.body.sup_code;

      if (approvalflag == null) {
        const respText = "Error! Approval cannot be null";
        response.status(201).json(respText);
      } else {
        await prisma.users.update({
          where: {
            user_id: user_id,
          },
          data: {
            is_active: approvalflag,
            is_approved: approvalflag,
            sup_code: sup_code,
            updated_date: mod_date,
          },
        });

        const user = await prisma.users.findUnique({
          where: {
            user_id: user_id,
          },
          select: {
            id: true,
            user_name: true,
            trade_name: true,
          },
        });
        let respText = "";
        if (approvalflag == "Y") {
          const respText = `${user.user_name} from M/s ${user.trade_name} is now an approved user`;

          const notification = await prisma.cus_notification.create({
            data: {
              text: respText,
              receiver: user.id,
              read: "N",
              type: "UR",
              created_date: istDate,
              verification_id: user_id,
            },
          });
          response.status(201).json(respText);
        } else if (approvalflag == "N") {
          const respText = `M/s ${user.trade_name} has been made inactive`;
          const notification = await prisma.cus_notification.create({
            data: {
              text: respText,
              receiver: user.id,
              read: "N",
              type: "UR",
              created_date: istDate,
              verification_id: user_id,
            },
          });
          response.status(201).json(respText);
        }
      }
    } else {
      logger.error(`Unauthorized- in userApproval api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in userApproval api`);
    response.status(500).json(error.message);
  } finally {
    await prisma.$disconnect();
  }
};

const approveUsersList = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "SU" || usertype === "ADM") {
      const approved = "N";
      const approveusers = await prisma.users.findMany({
        where: {
          is_approved: approved,
        },
        orderBy: {
          id: "desc",
        },
      });
      const filteredUsers = approveusers.filter(
        (user) => user.user_type !== "ADM"
      );
      response.status(200).json(filteredUsers);
    } else {
      logger.error(`Unauthorized- in approveUsersList api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    response.status(500).json(error.message);
    logger.error(
      `Internal server error: ${error.message} in approveUsersList api`
    );
  } finally {
    await prisma.$disconnect();
  }
};

const getSingleDataById = async (request, response) => {
  // const usertype=request.user.userType
  try {
    // if(usertype==="ADM" || usertype==="SU"){
    const id = request.params.id;
    const viewuser = await prisma.users.findMany({
      where: {
        id: parseInt(id),
      },
    });

    if (viewuser) {
      response.status(200).json(viewuser);
    } else {
      response.status(404).json({ error: "Data not found" });
    }
    // }else{
    //   logger.error(`Unauthorized- in getSingleDataById api`);
    //   return response
    //     .status(403)
    //     .json({ message: "Unauthorized. You are not an admin" });
    // }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in getSingleDataById api`
    );
    response.status(500).json({ error: "An error occurred" });
  } finally {
    await prisma.$disconnect();
  }
};

const supplierCodes = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const type = request.body.type;
      const users = await prisma.users.findMany({
        where: {
          user_type: type,
          sup_code: {
            not: null,
          },
        },
        select: {
          sup_code: true,
        },
      });

      const respText = users.map((user) => user.sup_code);
      response.status(201).json(respText);
    } else {
      logger.error(`Unauthorized- in supplierCodes api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in supplierCodes api`
    );
    response.status(500).json(error.message);
  } finally {
    await prisma.$disconnect();
  }
};

const userFeedback = async (request, response) => {
  const usertype = request.user.userType;
  const id = request.user.id;
  try {
    if (usertype === "SU" || usertype === "ADM") {
      const {
        method,
        user_id,
        old_status,
        new_status,
        is_active,
        is_user_flagged,
        post,
      } = request.body;
      const post_by = parseInt(request.body.post_by);
      const post_date = new Date();

      if (method && user_id) {
        switch (method) {
          case "add":
            // Insert into user_feeback table
            await prisma.user_feeback.create({
              data: {
                user_id,
                feedback_text: post,
                created_by: post_by,
                old_status,
                new_status,
                created_date: post_date,
              },
            });
            const respText = "Feedback added";
            // const notification = await prisma.adm_notification.create({
            //   data: {
            //     text: respText,
            //     sender: id,
            //     read: "N",
            //     type: "FB",
            //     created_date: istDate,
            //     verification_id: user_id
            //   }
            // })
            // Update users table
            await prisma.users.update({
              where: { id: user_id },
              data: {
                is_active,
                updated_date: istDate,
                is_user_flagged,
              },
            });

            response.status(201).json("Feedback added");
            break;

          case "view":
            const userFeedbacks = await prisma.user_feeback.findMany({
              where: { user_id },
              orderBy: {
                id: "desc",
              },
            });
            response.status(200).json(userFeedbacks);
            break;

          case "flag":
          case "feedback":
            await prisma.user_feeback.create({
              data: {
                user_id,
                feedback_text: post,
                created_by: post_by,
                old_status,
                new_status,
                created_date: istDate,
              },
            });
            await prisma.users.update({
              where: { id: user_id },
              data: {
                is_active,
                updated_date: istDate,
                is_user_flagged,
              },
            });
            response
              .status(201)
              .json(method === "flag" ? "User flagged" : "Feedback added");
            break;

          default:
            response.status(400).json({ message: "Invalid method" });
        }
      } else {
        logger.error(`method and user_id are mandatory- in userFeedback api`);
      }
    } else {
      logger.error(`Unauthorized- in userFeedback api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in userFeedback api`);
    response
      .status(500)
      .json({ error: "An error occurred while processing the request." });
  } finally {
    await prisma.$disconnect();
  }
};

///////////////
const userDetails = async (request, response) => {
  // const usertype=request.user.userType
  try {
    // if(usertype==="ADM" || usertype==="SU"){
    let u_id = request.body.id;
    if (u_id) {
      const user = await prisma.users.findUnique({
        where: {
          id: u_id,
        },
      });
      if (!user) {
        response.status(404).json({ error: "User not found" });
      } else {
        response.status(201).json(user);
      }
    } else {
      const division = request.body.division;
      const user_type = request.body.user_type.toUpperCase();

      if (!user_type || typeof user_type !== "string") {
        response.status(400).json({ error: "Invalid user_type" });
        return;
      } else {
        if (!division) {
          const suppliers = await prisma.users.findMany({
            where: {
              user_type: {
                equals: user_type,
              },
            },
          });

          response.status(201).json(suppliers);
        } else {
          const suppliers = await prisma.users.findMany({
            where: {
              user_type: {
                equals: user_type,
              },
              is_approved: "Y",
            },
          });
          let suppArray = [];
          for (i = 0; i < suppliers.length; i++) {
            if (suppliers[i].product_type) {
              const prodTypesArray = Object.values(suppliers[i].product_type);
              if (prodTypesArray.includes(division)) {
                let supData = {
                  supFullData: suppliers[i],
                };

                suppArray.push(supData.supFullData);
              }
            }
          }

          response.status(200).json(suppArray);
        }
      }
    }
    // }else{
    //   logger.error(`Unauthorized- in userDetails api`);
    //   return response
    //     .status(403)
    //     .json({ message: "Unauthorized. You are not an admin" });
    // }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in userDetails api`);
    response.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const userApprovalbyID = async (request, response) => {
  const u_id = request.params.id;
  const email = request.body.email;
  const approval = request.body.approvalflag;

  if (!email || !approval) {
    response.status(400).json({
      error: "All fields are mandatory!",
    });
    throw new Error("All fields are mandatory!");
  } else {
    const mod_date = new Date();

    try {
      const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
      let password = "";

      for (let i = 0; i < 8; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        password += characters.charAt(randomIndex);
      }
      const hashedPass = await bcrypt.hash(password, 5);
      const updatedUser = await prisma.users.update({
        where: { user_id: u_id },
        data: {
          is_approved: approval,
          is_active: approval,
          updated_date: mod_date,
          password: hashedPass,
        },
        select: {
          user_name: true,
        },
      });

      if (updatedUser) {
        const username = updatedUser.user_name;
        response.status(200).json({
          success: true,
          error: false,
          message: "user approved successfully",
        });

        // Mailing section
        const transporter = nodemailer.createTransport({
          host: "smtp.zoho.in",
          port: 465,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
          },
          secure: true,
          tls: {
            rejectUnauthorized: false,
          },
        });
        const handlebarOptions = {
          viewEngine: {
            partialsDir: path.resolve("./views"),
            defaultLayout: false,
          },
          viewPath: path.resolve("./views"),
        };
        transporter.use("compile", hbs(handlebarOptions));
        let mailOptions = {
          from: "support@chaavie.com", // sender address
          to: email,
          subject: "OTP Mail", // Subject line
          template: "user_approve_mail",
          context: {
            username: username,
            password: password,
          },
        };
        transporter.sendMail(mailOptions, function (err, info) {
          if (err) {
            return;
          }
        });
      } else {
        response.status(404).json({
          error: true,
          success: false,
          message: "No user found!",
        });
      }
    } catch (err) {
      logger.error(
        `Internal server error: ${err.message} in userApprovalbyID api`
      );
      throw err;
    }
  }
};

/* user login --------------------------------------------- */
const userLogin = async (request, response) => {
  const { email, password } = request.body;
  console.log("loginnnn");
  if (!email || !password) {
    return response.status(401).json({
      error: true,
      success: false,
      message: "Email and password required",
    });
  }

  try {
    const user = await prisma.users.findFirst({
      where: { email: email },
    });
    console.log("user=======================", user);
    if (!user) {
      return response.status(401).json({
        error: true,
        success: false,
        message: "Incorrect Email or password!",
      });
    }

    const user_id = user.user_id;
    const logged_id = user.id;
    const hashedDbPassword = user.password;
    const type = user.user_type;

    // Compare the provided password with the hashed password from the database
    bcrypt.compare(password, hashedDbPassword, async function (err, result) {
      if (err) {
        return response.status(500).json({
          error: true,
          success: false,
          message: "Password hashing error",
        });
      }

      if (!result) {
        return response.status(401).json({
          error: true,
          success: false,
          message: "Please check your password!",
        });
      }

      const refreshTokenPayload = {
        id: logged_id,
        userType: type,
      };

      const accessTokenPayload = {
        id: logged_id,
        userType: type,
      };

      const refreshTokenOptions = {
        expiresIn: "900m",
      };

      const accessTokenOptions = {
        expiresIn: "5m",
      };

      const refreshToken = jwt.sign(
        refreshTokenPayload,
        process.env.REFRESH_TOKEN_SECRET,
        refreshTokenOptions
      );

      const accessToken = jwt.sign(
        accessTokenPayload,
        process.env.ACCESS_TOKEN_SECRET,
        accessTokenOptions
      );
      const currentDate = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(currentDate.getTime() + istOffset);

      const createTimeStamp = async () => {
        await prisma.login_timestamp.create({
          data: {
            user_id: logged_id,
            created_date: istDate,
          },
        });
      };

      await createTimeStamp();
      const staff = await prisma.staff_users.findFirst({
        where: {
          user_id: user_id,
        },
        select: {
          division: true,
          department: true,
        },
      });

      console.log(staff);

      const access = await prisma.user_access.findFirst({
        where: {
          user_type: user.user_type,
          division: staff?.division,
          department: {
            equals: staff?.department,
            mode: "insensitive",
          },
        },
      });

      console.log("access=====", access);

      const division = staff?.division;
      const user_access = access?.access;
      console.log("user_accessuser_accessuser_access", user_access);
      if (division) {
        if (user_access) {
          return response.status(200).json({
            success: true,
            error: false,
            message: "Login successful",
            userType: type,
            logged_id: logged_id,
            user: true,
            division: division,
            access: user_access,
            refreshToken,
            accessToken,
          });
        } else {
          return response.status(200).json({
            success: true,
            error: false,
            message: "Login successful",
            userType: type,
            user: true,
            logged_id: logged_id,
            division: division,
            refreshToken,
            accessToken,
          });
        }
      } else {
        return response.status(200).json({
          success: true,
          error: false,
          message: "Login successful",
          userType: type,
          logged_id: logged_id,
          refreshToken,
          accessToken,
        });
      }
    });
  } catch (error) {
    console.log("errr", error);
    logger.error(`Internal server error: ${error.message} in userLogin api`);
    return response.status(500).json({
      error: true,
      success: false,
      message: "Internal Server Error!",
    });
  } finally {
    await prisma.$disconnect();
  }
};

/* user login ---------------------------------------------frgtpwd */
const forgotPwd = async (request, response) => {
  const { email } = request.body;
  try {
    if (email) {
      const user = await prisma.users.findFirst({
        where: {
          email: email,
        },
        select: {
          user_name: true,
          user_id: true,
        },
      });

      if (!user) {
        response.status(404).json({ error: "User not found" });
      } else {
        const characters =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        let otp = "";

        for (let i = 0; i < 5; i++) {
          const randomIndex = Math.floor(Math.random() * characters.length);
          otp += characters.charAt(randomIndex);
        }
        const hashedOtp = await bcrypt.hash(otp, 5);
        await prisma.users.update({
          where: {
            user_name: user.user_name,
          },
          data: {
            temp_otp: hashedOtp,
          },
        });

        // Mailing section
        const transporter = nodemailer.createTransport({
          host: "smtp.zoho.in",
          port: 465,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
          },
          secure: true,
          tls: {
            rejectUnauthorized: false,
          },
        });
        const handlebarOptions = {
          viewEngine: {
            partialsDir: path.resolve("./views"),
            defaultLayout: false,
          },
          viewPath: path.resolve("./views"),
        };
        transporter.use("compile", hbs(handlebarOptions));
        let mailOptions = {
          from: "support@chaavie.com",
          to: email, // Use the user's email here
          subject: "OTP Mail",
          template: "user_temp_otp",
          context: {
            username: user.user_name, // Use the user_name from the user object
            otp: otp,
          },
        };
        transporter.sendMail(mailOptions, function (err, info) {
          if (err) {
            return;
          }
          response.status(201).json({
            success: true,
            error: false,
            message: "OTP sent successfully",
            data: user.user_id,
          });
        });
      }
    } else {
      logger.error(`email is undefined in forgotPwd `);
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in forgotPwd api`);
    response.send(error);
  } finally {
    await prisma.$disconnect();
  }
};

/* login with temporary otp */
const otpLogin = async (request, response) => {
  const { email, otp } = request.body;

  if (!email || !otp) {
    logger.error(`email or otp field is empty in otpLogin api`);
    response.status(400).json({
      error: true,
      message: "email or otp field is empty",
    });
    return;
  }
  try {
    const user = await prisma.users.findFirst({
      where: {
        email: email,
      },
      select: {
        temp_otp: true,
      },
    });

    if (!user) {
      response.status(400).json({
        error: true,
        message: "no user found!",
      });
    } else {
      const dbOtp = user.temp_otp;
      const result = await bcrypt.compare(otp, dbOtp);
      if (!result) {
        logger.error(`otp is not matching -in otpLogin api`);
        response.status(401).json({
          error: true,
          message: "otp is not matching!",
        });
      } else {
        response.status(200).json({
          success: true,
          message: "Login successful",
        });
      }
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in otpLogin api`);
    response.status(500).json({
      error: true,
      msg: "Internal server error",
    });
  } finally {
    await prisma.$disconnect();
  }
};

/*/ ------------reset-password---------/*/
const resetPwd = async (request, response) => {
  const user_id = request.params.id; // Convert the id to an integer
  const password = request.body.password;

  if (!user_id || !password) {
    return response.status(400).json({
      error: true,
      message: "Please check fields",
    });
  }
  try {
    const hashedPass = await bcrypt.hash(password, 5);
    // Update the user's password using Prisma's update function
    const update = await prisma.users.update({
      where: {
        user_id: user_id,
      },
      data: {
        password: hashedPass,
        updated_date: istDate,
      },
    });
    response.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    response.status(500).json({
      error: true,
      msg: "Internal server error",
    });
    logger.error(`Internal server error: ${error.message} in resetPwd api`);
  } finally {
    await prisma.$disconnect();
  }
};

const userProfile = async (request, response) => {
  let u_id = request.params.id;
  try {
    if (u_id) {
      const user = await prisma.users.findFirst({
        where: {
          user_id: {
            equals: u_id,
          },
        },
      });

      if (user) {
        response.status(200).json({
          success: true,
          error: false,
          data: user,
        });
      } else {
        logger.error(`No user found! in userProfile api`);
        response.status(404).json({
          error: true,
          success: false,
          message: "No user found!",
        });
      }
    } else {
      logger.error("user_id is undefined in userProfile api");
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in userProfile api`);
    response.status(500).json({
      error: true,
      message: "Internal Server Error!",
    });
  } finally {
    await prisma.$disconnect();
  }
};

const editUser = async (request, response) => {
  const u_id = request.params.id;
  const { prod_type, website, landline, mobile } = request.body;

  if (!prod_type || !website || !landline || !mobile) {
    logger.error(`All fields are required in editUser api`);
    throw new Error("All fields are required");
  }
  try {
    if (u_id) {
      const user = await prisma.users.findUnique({
        where: { user_id: u_id },
      });

      if (!user) {
        response.status(404).json({
          error: true,
          success: false,
          message: "No user found",
        });
      } else {
        const response = await prisma.users.update({
          where: { user_id: u_id },
          data: {
            product_type: prod_type,
            website: website,
            landline: landline,
            mobile: mobile,
            updated_date: istDate,
          },
        });

        if (response) {
          response.status(200).json({
            success: true,
            error: false,
            message: "Successfully updated",
          });
        }
      }
    } else {
      logger.error("user_id is undefined in editUser api");
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in editUser api`);
    response.status(500).json({
      error: true,
      success: false,
      message: "Internal Server Error!",
    });
  } finally {
    await prisma.$disconnect();
  }
};

const supplieredit = async (request, response) => {
  console.log("reee", request.body);
  const u_id = request.params.id;
  const { prod_type, website, address, account_number, ifsc_code } =
    request.body;
  const landline = request.body.landline;
  const mobile = request.body.mobile;

  if (!prod_type || !landline || !mobile || !address) {
    response.status(400).json({
      success: true,
      error: false,
      message: "All fields are required",
    });

    throw new Error("All fields are required");
  }
  try {
    if (u_id) {
      const user = await prisma.users.findFirst({
        where: { user_id: u_id },
      });

      if (!user) {
        response.status(404).json({
          error: true,
          success: false,
          message: "No user found",
        });
      } else {
        const update = await prisma.users.update({
          where: { user_id: u_id },
          select: {
            bank__details: {
              account_number: account_number,
              ifsc_code: ifsc_code,
            },
          },
          data: {
            product_type: prod_type,
            website: website,
            landline: landline.toString(),
            mobile: mobile.toString(),
            address: address,
            updated_date: istDate,
          },
        });

        if (update) {
          response.status(200).json({
            success: true,
            error: false,
            message: "Successfully updated",
          });
        }
      }
    } else {
      logger.error("user_id is undefined in supplieredit api");
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in supplieredit api`);
    response.status(500).json({
      error: true,
      success: false,
      message: "Internal Server Error!",
    });
  } finally {
    await prisma.$disconnect();
  }
};

///////////////bank_detailss---add/////////////////////
const bankdetailsadd = async (request, response) => {
  const u_id = request.params.id;
  const { account_number, account_type, ifsc_code } = request.body;

  if (!account_number || !account_type || !ifsc_code) {
    logger.error("All fields are required in bankdetailsadd api");
    throw new Error("All fields are required");
  }

  try {
    if (u_id) {
      const user = await prisma.users.findFirst({
        where: { user_id: u_id },
      });
      if (!user) {
        response.status(404).json({
          error: true,
          success: false,
          message: "No user found",
        });
      } else {
        const response = await prisma.bank__details.create({
          data: {
            user_id: u_id,
            account_number: account_number,
            account_type: account_type,
            ifsc_code: ifsc_code,
          },
        });

        if (response) {
          response.status(200).json({
            success: true,
            error: false,
            message: "Successfully added",
          });
        }
      }
    } else {
      logger.error("user_id is undefined in bankdetailsadd api");
    }
  } catch (error) {
    response.status(500).json({
      error: true,
      success: false,
      message: "Internal Server Error!",
    });
    logger.error(
      `Internal server error: ${error.message} in bankdetailsadd api`
    );
  } finally {
    await prisma.$disconnect();
  }
};

const Users = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const viewuser = await prisma.users.findMany({
        orderBy: {
          id: "desc",
        },
      });
      response.status(201).json(viewuser);
    } else {
      logger.error(`Unauthorized- in Users api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in Users api`);
    response.status(500).json(error.message);
  } finally {
    await prisma.$disconnect();
  }
};

const Customers_view = async (request, response) => {
  console.log("first");
  const usertype = request.user.userType;
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const user_type = "CUS";
      const viewuser = await prisma.users.findMany({
        where: {
          user_type: user_type,
        },
        orderBy: {
          id: "desc",
        },
      });
      response.status(201).json(viewuser);
    } else {
      logger.error(`Unauthorized- in Customers_view api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(
      `Internal server error: ${error.message} in Customers_view api`
    );
    response.status(500).json(error.message);
  } finally {
    await prisma.$disconnect();
  }
};

const users_types = async (request, response) => {
  const usertype = request.user.userType;
  try {
    if (usertype === "ADM" || usertype === "SU") {
      const types = await prisma.users.findMany({
        where: {
          is_active: "Y",
        },
        select: {
          user_type: true,
          user_id: true,
        },
        orderBy: {
          id: "desc",
        },
      });

      const groupedTypes = types.reduce((acc, user) => {
        const { user_type, user_id } = user;

        if (!acc[user_type]) {
          acc[user_type] = {
            // user_ids: [],
            count: 0,
          };
        }

        // acc[user_type].user_ids.push(user_id);
        acc[user_type].count++;

        return acc;
      }, {});
      response.status(200).json(groupedTypes);
    } else {
      logger.error(`Unauthorized- in Customers_view api`);
      return response
        .status(403)
        .json({ message: "Unauthorized. You are not an admin" });
    }
  } catch (error) {
    logger.error(`Internal server error: ${error.message} in users_types api`);
    response.status(500).json(error.message);
  } finally {
    await prisma.$disconnect();
  }
};

const customertransaction = async (req, res) => {

  const usertype = req.body.user_type;
  const userid = req.body.user_id;

  try {
    let userData;
    let transactions = [];

    if (usertype === "CUS") {
      // 🧾 Fetch customer details with sales orders and payments
      userData = await prisma.users.findFirst({
        where: { id: userid },
        select: {
          id: true,
          trade_name: true,
          user_name: true,
          mobile: true,
          sales_order_new: {
            select: {
              sales_id: true,
              so_number: true,
              total_amount: true,
              created_date: true,
              so_payment: {
                select: {
                  payment_id: true,
                  amount: true,
                  created_date: true,
                },
              },
            },
          },
        },
      });

      const orders = userData.sales_order_new || [];

      // 📊 Convert string amounts to numbers before summation
      const totalAmount = orders.reduce(
        (sum, o) => sum + parseFloat(o.total_amount || 0),
        0
      );

      const paidAmount = orders.reduce((sum, o) => {
        const payments = o.so_payment || [];
        const totalPaid = payments.reduce(
          (pSum, pay) => pSum + parseFloat(pay.amount || 0),
          0
        );
        return sum + totalPaid;
      }, 0);

      const outstanding = totalAmount - paidAmount;

      // 🧾 Prepare transaction history
      transactions = orders.map((o) => ({
        order_id: o.sales_id,
        order_number: o.so_number,
        order_date: o.created_date,
        total_amount: parseFloat(o.total_amount || 0),
        payments: o.so_payment.map((p) => ({
          payment_id: p.payment_id,
          payment_amount: parseFloat(p.amount || 0),
          payment_date: p.created_date,
        })),
      }));

      res.status(200).json({
        user: {
          id: userData.id,
          trade_name: userData.trade_name,
          user_name: userData.user_name,
          mobile: userData.mobile,
        },
        total_amount: totalAmount,
        paid_amount: paidAmount,
        outstanding_amount: outstanding,
        transactions,
      });
    } 
    
    else if (usertype === "SUP") {
      // 🧾 Fetch supplier details with purchase orders and payments
      userData = await prisma.users.findFirst({
        where: { id: userid },
        select: {
          id: true,
          trade_name: true,
          user_name: true,
          mobile: true,
          purchase_order: {
            select: {
              po_id: true,
              po_number: true,
              total_amount: true,
              created_date: true,
              po_payment: {
                select: {
                  payment_id: true,
                  amount: true,
                  created_date: true,
                },
              },
            },
          },
        },
      });

      const orders = userData.purchase_order || [];

      const totalAmount = orders.reduce(
        (sum, o) => sum + parseFloat(o.total_amount || 0),
        0
      );

      const paidAmount = orders.reduce((sum, o) => {
        const payments = o.po_payment || [];
        const totalPaid = payments.reduce(
          (pSum, pay) => pSum + parseFloat(pay.amount || 0),
          0
        );
        return sum + totalPaid;
      }, 0);

      const outstanding = totalAmount - paidAmount;

      transactions = orders.map((o) => ({
        order_id: o.po_id,
        order_number: o.po_number,
        order_date: o.created_date,
        total_amount: parseFloat(o.total_amount || 0),
        payments: o.po_payment.map((p) => ({
          payment_id: p.payment_id,
          payment_amount: parseFloat(p.amount || 0),
          payment_date: p.created_date,
        })),
      }));

      res.status(200).json({
        user: {
          id: userData.id,
          trade_name: userData.trade_name,
          user_name: userData.user_name,
          mobile: userData.mobile,
        },
        total_amount: totalAmount,
        paid_amount: paidAmount,
        outstanding_amount: outstanding,
        transactions,
      });
    } 
    
    else {
      res.status(400).json({ error: "Invalid user type" });
    }
  } catch (error) {
    logger.error(`An error occurred: ${error.message} in customertransaction API`);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};


module.exports = {
  addadmin,
  superadmin,
  approveUsersList,
  viewSuppliers,
  userDetails,
  userApproval,
  viewUserDetails,
  updateuser,
  addUsers,
  getSingleDataById,
  supplierCodes,
  userFeedback,
  userProfile,
  deleteuser,
  userApprovalbyID,
  userLogin,
  forgotPwd,
  otpLogin,
  resetPwd,
  editUser,
  supplieredit,
  bankdetailsadd,
  Users,
  Customers_view,
  users_types,
  customertransaction
};
