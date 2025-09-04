const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const winston = require('winston');
const fs = require('fs');

const { format, subMonths } = require('date-fns');
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

const staff_attendence = async (req, res) => {
    try {
        const { staff_id } = req.body
        const date = new Date()
        // const check_in = new time()
        // const check_out = new time()
        const attendence_data = await prisma.staff_attendence.create({
            data: {
                staff_id: staff_id,
                date: date,
                // check_in:date,
                // check_out:check_out
            }
        })
        console.log("attendence_data-----", attendence_data)
        res.status(200).json({
            error: false,
            success: true,
            message: "successfully added the attendence_details",
            data: attendence_data
        })

    } catch (err) {
        logger.error(`An error occurred: ${err.message} in staff_attendence api`);
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error",

        })
    }finally {
        await prisma.$disconnect();
      }
}

//checkin
const staff_checkin = async (req, res) => {
    try {
        const { staff_id } = req.body
        const currentDate = new Date();
        const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
        const istDate = new Date(currentDate.getTime() + istOffset);
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();
        const dateOnly = new Date(year, month - 1, day);
        const dateOnlyString = dateOnly.toLocaleDateString();

        const checkin_info = await prisma.staff_attendence.create({
            data: {
                staff_id: staff_id,
                date: dateOnlyString,
                check_in: istDate

            }
        })
        res.status(200).json({
            error: false,
            success: true,
            message: "checkin time added",
            data: checkin_info
        })

    } catch (err) {
        logger.error(`An error occurred: ${err.message} in staff_checkin api`);
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error"
        })
    }finally {
        await prisma.$disconnect();
      }
}

//checkout
// const staff_checkout = async(req,res)=>{
//     try{
//         const {staff_id} =req.body
//         const check_out =  new Date();
//         const checkout_info = await prisma.staff_attendence.update({
//             where:{
//                 staff_id:staff_id
//             },
//             data:{

//                check_out:check_out

//             }
//         })
//         console.log("checkout_info------",checkout_info)
//         res.status(200).json({
//             error:false,
//             success:true,
//             message:"checkout time added",
//            data:checkout_info
//         })

//     }catch(err){
//         console.log("error----",err)
//         res.status(500).json({
//             message:"internal server error"
//           })
//     }
// }

//applying leave by staff
const staff_leave = async (req, res) => {
    try {
        const { staff_id, leave_type, from_date, to_date, remarks } = req.body
        const currentDate = new Date();
        const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
        const istDate = new Date(currentDate.getTime() + istOffset);

        const leave_data = await prisma.staff_leave.create({
            data: {
                staff_id: staff_id,
                leave_type: leave_type,
                time: istDate,
                created_by: staff_id,
                created_date: istDate,
                from_date: from_date,
                to_date: to_date,
                remarks: remarks,
                status: "pending"
            }
        })
        res.status(200).json({
            error: false,
            success: true,
            message: "successfull",
            data: leave_data
        })
    } catch (err) {
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error"
        })
        logger.error(`An error occurred: ${err.message} in staff_leave api`);
    }finally {
        await prisma.$disconnect();
      }
}

//approval of leave by admin
const leave_approval = async (req, res) => {
    try {
        const { staff_id, modified_by, status, id } = req.body
        const currentDate = new Date();


        const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;


        const istDate = new Date(currentDate.getTime() + istOffset);
        console.log('IST Date:', istDate);

        const approval_data = await prisma.staff_leave.updateMany({
            where: {
                id: id,
                staff_id: staff_id
            },
            data: {
                modified_by: modified_by,
                modified_date: istDate,
                status: status
            }
        })
        console.log("approval_data-----", approval_data)
        let successMessage = ''
        if (status === 'accepted') {
            successMessage = "Successfully accepted"
        } else if (status === 'rejected') {
            successMessage = "Successfully rejected"
        }


        //         const leaveType = approval_data[0]?.leave_type
        //         let balancecheck = 0

        //         if(status === 'accepted'){
        //             if(leaveType === "cl"){
        //                 balancecheck = -1
        //             }
        //             if(leaveType === "sl"){
        //                 balancecheck = -1
        //             }
        //             if(leaveType === "el"){
        //                 balancecheck = -1
        //             }
        //         }
        //         const leave_check = await prisma.leave_balance.update({
        //             where: {
        //               staff_id:89
        //             },
        //             data: {
        //                 cl_balance: { increment: leaveType === "cl" ? balancecheck : 0 },
        //                 sl_balance: { increment: leaveType === "sl" ? balancecheck : 0 },
        //                 el_balance: { increment: leaveType === "el" ? balancecheck : 0 }
        //             }
        //           });

        //    console.log("leave_check------",leave_check)

        res.status(200).json({
            error: false,
            success: true,
            message: successMessage,
            data: approval_data
        })

    } catch (err) {
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error"
        })
        logger.error(`An error occurred: ${err.message} in newsaleorders api`);
    }finally {
        await prisma.$disconnect();
      }
}

//requesting for claims by staff
const staff_claims = async (req, res) => {
    console.log("req----", req)
    try {
        const { staff_id, claim_type, claim_amount, remarks } = req.body
        const currentDate = new Date();
        const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
        const istDate = new Date(currentDate.getTime() + istOffset);

        const claim_data = await prisma.staff_claims.create({
            data: {
                staff_id: staff_id,
                claim_type: claim_type,
                claim_amount: claim_amount,
                created_date: istDate,
                created_by: staff_id,
                remarks: remarks
            }
        })
        console.log("claim_data-----", claim_data)
        res.status(200).json({
            error: false,
            success: true,
            message: "successfully added the claim",
            data: claim_data
        })

    } catch (err) {
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error"
        })
        logger.error(`An error occurred: ${err.message} in staff_claims api`);
    }finally {
        await prisma.$disconnect();
      }
}

//approval of claim by admin
const claim_approval = async (req, res) => {

    try {
        const { id, status, modified_by } = req.body
        const currentDate = new Date();


        const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;


        const istDate = new Date(currentDate.getTime() + istOffset);
        console.log('IST Date:', istDate);
        const approval_data = await prisma.staff_claims.updateMany({
            where: {
                id: id,
            },
            data: {
                claim_status: status,
                modified_by: modified_by,
                modified_date: istDate
            }
        })
        console.log("approval_data-----", approval_data)
        let Statusmessage = ''
        if (status === 'accepted') {
            Statusmessage = "successfully accepted the claim"
        } else if (status === 'rejected') {
            Statusmessage = "successfully rejected"
        }


        res.status(200).json({
            error: false,
            success: true,
            message: Statusmessage,
            data: approval_data
        })

    } catch (err) {
        logger.error(`An error occurred: ${err.message} in claim_approval api`);
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error"
        })
    }finally {
        await prisma.$disconnect();
      }
}

//leave_balance for staff
const leave_balance = async (req, res) => {
    try {
        const { staff_id } = req.body
        const leave_data = await prisma.leave_balance.findMany({
            where: {
                staff_id: staff_id
            }
        })
        console.log('leave_data-----', leave_data)
        res.status(200).json({
            error: false,
            success: true,
            message: "successfull",
            data: leave_data
        })

    } catch (err) {
        logger.error(`An error occurred: ${err.message} in leave_balance api`);
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error"
        })
    }
}

//for adding staff
const adding_staff = async (req, res) => {
    try {
        const { first_name, middle_name, last_name, gender, date_of_birth, mobile_phone, company_email, start_date, division, department, address_line1,
            address_line2, city, state, pin_code, notes, bank_ifsc, bank_name, branch_name, name_on_account, account_number,
            father_name, mother_name, marital_status, status, id_proof, employer_id } = req.body

        const staff_data = await prisma.staff.create({
            data: {
                first_name: first_name,
                middle_name: middle_name,
                last_name: last_name,
                gender: gender,
                date_of_birth: date_of_birth,
                mobile_phone: mobile_phone,
                company_email: company_email,
                start_date: start_date,
                division: division,
                department: department,
                address_line1: address_line1,
                address_line2: address_line2,
                city: city,
                state: state,
                pin_code: pin_code,
                notes: notes,
                bank_ifsc: bank_ifsc,
                bank_name: bank_name,
                branch_name: branch_name,
                name_on_account: name_on_account,
                account_number: account_number,
                father_name: father_name,
                mother_name: mother_name,
                marital_status: marital_status,
                status: status,
                id_proof: id_proof,
                employer_id: employer_id
            }
        })
        console.log("staff_data----", staff_data)
        res.status(200).json({
            error: false,
            success: true,
            message: "successfully added",
            data: staff_data
        })

    } catch (err) {
        logger.error(`An error occurred: ${err.message} in adding_staff api`);
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error"
        })
    }
}

//getting the claim of individual staff
const claim_details = async (req, res) => {
    try {
        const { staff_id } = req.body
        const claim_info = await prisma.staff_claims.findMany({
            where: {
                staff_id: staff_id
            }
        })
        console.log("claim_info-----", claim_info)
        res.status(200).json({
            error: false,
            success: true,
            message: "successfull,",
            data: claim_info
        })

    } catch (err) {
        logger.error(`An error occurred: ${err.message} in claim_details api`);
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error"

        })
    }
}

//for checkout
const attendence_list = async (req, res) => {
    try {
        const { staff_id } = req.body
        const date = new Date()
        const currentDate = new Date();


        const istOffset = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;


        const istDate = new Date(currentDate.getTime() + istOffset);
        console.log('IST Date:', istDate);
        const last_update = await prisma.staff_attendence.findFirst({
            where: {
                staff_id: staff_id
            },
            orderBy: {
                check_in: "desc"
            }
        })
        if (last_update && !last_update.check_out) {
            const update_checkout = await prisma.staff_attendence.update({
                where: {
                    id: last_update.id,
                },
                data: {
                    check_out: istDate
                }

            })
            console.log("update_checkout------", update_checkout)
            // res.status(200).json({
            //     message:"successfull"
            // })
            const checkin_time = new Date(last_update.check_in)
            const checkout_time = istDate
            const time_interval = checkout_time - checkin_time
            const total_hours = time_interval / (1000 * 60 * 60)
            const total_interval = total_hours * 3600

            const total_inminutes = (total_interval / (60))
            console.log("total_inminutes----", total_inminutes)

            const time_update = await prisma.staff_attendence.update({
                where: {
                    id: last_update.id
                },
                data: {
                    total_interval: total_inminutes
                }
            })
            console.log("time_update-----", time_update)
            res.status(200).json({
                message: "successfull"
            })
        } else {
            const new_checkin = await prisma.staff_attendence.create({
                data: {
                    staff_id: staff_id,
                    check_in: istDate
                }
            })
            console.log("new_checkin-----", new_checkin)
            res.status(200).json({
                error: false,
                success: true,
                message: "successfull",
                data: new_checkin
            })
        }


    } catch (err) {
        logger.error(`An error occurred: ${err.message} in attendence_list api`);
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error"
        })
    }
}

//for getting the complete checkin checkout history of a single staff
const complete_checkindata = async (req, res) => {
    try {
        const { staff_id } = req.body
        const staff_checkindata = await prisma.staff_attendence.findMany({
            where: {
                staff_id: staff_id
            }
        })
        res.status(200).json({
            error: false,
            success: true,
            message: "successfull",
            data: staff_checkindata
        })

    } catch (err) {
        logger.error(`An error occurred: ${err.message} in complete_checkindata api`);
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error"
        })
    }

}

//to get the complete data in attendence table
const complete_attendence = async (req, res) => {
    try {
        const complete_data = await prisma.staff_attendence.findMany()
        res.status(200).json({
            message: "successfull",
            data: complete_data
        })

    } catch (err) {
        logger.error(`An error occurred: ${err.message} in complete_attendence api`);
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error"
        })
    }
}

//to get the status of leave
const leave_status = async (req, res) => {
    try {
        const { staff_id } = req.body
        const status_data = await prisma.staff_leave.findMany({
            where: {
                staff_id: staff_id
            }
        })
        res.status(200).json({
            data: status_data
        })

    } catch (err) {
        logger.error(`An error occurred: ${err.message} in leave_status api`);
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error"
        })
    }
}

//to get the first getin and lastcheckoutdata
const checkin_checkout = async (req, res) => {
    try {
        // Fetch user attendances
        const userAttendances = await prisma.staff_attendence.findMany();

        // Group attendances by staff_id and date
        const groupedAttendances = userAttendances.reduce((groups, attendance) => {
            const staff_id = attendance.staff_id;
            const date = attendance.date;

            if (!groups[staff_id]) {
                groups[staff_id] = {};
            }
            if (!groups[staff_id][date]) {
                groups[staff_id][date] = {
                    staff_id,
                    first_checkin: null,
                    last_checkout: null,
                    total_hours: 0,
                    date,
                };
            }
            if (attendance.check_in) {
                if (
                    !groups[staff_id][date].first_checkin ||
                    attendance.check_in < groups[staff_id][date].first_checkin
                ) {
                    groups[staff_id][date].first_checkin = attendance.check_in;
                }
            }

            if (attendance.check_out) {
                if (
                    !groups[staff_id][date].last_checkout ||
                    attendance.check_out > groups[staff_id][date].last_checkout
                ) {
                    groups[staff_id][date].last_checkout = attendance.check_out;
                }
            }

            return groups;
        }, {});

        // Calculate total hours and format the response array
        const responseArray = [];

        for (const staff_id in groupedAttendances) {
            for (const date in groupedAttendances[staff_id]) {
                const attendanceData = groupedAttendances[staff_id][date];
                if (attendanceData.first_checkin && attendanceData.last_checkout) {
                    const calculateTime = attendanceData.last_checkout - attendanceData.first_checkin;
                    const calculateHours = calculateTime / (1000 * 60 * 60);
                    attendanceData.total_hours = calculateHours;
                    responseArray.push(attendanceData);
                }
            }
        }

        res.status(200).json({
            success: true,
            error: false,
            message: "Successfully calculated hours worked",
            data: responseArray,
        });
    } catch (err) {
        logger.error(`An error occurred: ${err.message} in checkin_checkout api`);
        res.status(500).json({
            error: true,
            success: false,
            message: "Internal server error",
        });
    }
};

//for getting complete leave to admin
const complete_leave = async (req, res) => {
    try {
        const complete_data = await prisma.staff_leave.findMany({
            where: {
                OR: [
                    {
                        status: null
                    },
                    {
                        status: {
                            not: {
                                in: ['accepted', 'rejected']
                            }
                        }
                    }
                ]
            }
        });
        res.status(200).json({
            error: false,
            success: true,
            message: "successfull",
            data: complete_data
        })

    } catch (err) {
        logger.error(`An error occurred: ${err.message} in complete_leave api`);
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error"
        })
    }
}

//getting complete claim details to admin
const complete_claim = async (req, res) => {
    try {
        const claim_completedata = await prisma.staff_claims.findMany({
            where: {
                OR: [
                    {
                        claim_status: null
                    }, {
                        claim_status: {
                            not: {
                                in: ["accepted", "rejected"]
                            }
                        }
                    }
                ]
            }
        })
        res.status(200).json({
            error: false,
            success: true,
            message: "successfull",
            data: claim_completedata
        })

    } catch (err) {
        logger.error(`An error occurred: ${err.message} in complete_claim api`);
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error"
        })
    }
}

// alternate way for getting the total interval of checkin and checkout
const complete_interval = async (req, res) => {
    try {
        const { staff_id } = req.body
        if (!staff_id) {
            res.status(400).json({
                message: "staff not found"
            })
        }
        const interval_data = await prisma.staff_attendence.groupBy({
            where: {
                staff_id: staff_id
            },
            by: ['staff_id', 'date'],
            _sum: {
                total_interval: true,
            },
            _min: {
                check_in: true,
            },
            _max: {
                check_out: true
            }
        })
        res.status(200).json({
            error: false,
            success: true,
            message: "successfully calculated the total hours",
            data: interval_data
        })
    } catch (err) {
        logger.error(`An error occurred: ${err.message} in complete_interval api`);
        res.status(400).json({
            message: "internal server error"
        })
    }
}

// for checking the checkin and checkout
const check_data = async (req, res) => {
    try {
        const { staff_id } = req.body
        const check_checkin = await prisma.staff_attendence.findFirst({
            where: {
                staff_id: staff_id,
            },
            orderBy: {
                check_in: "desc"
            }
        })
        if (check_checkin && check_checkin.check_out) {
            res.status(200).json({
                error: false,
                success: true,
                message: "checkout",
                data: check_checkin
            })
        }
        else {
            res.status(200).json({
                error: false,
                success: true,
                message: "checkin",
                data: check_checkin
            })
        }

    } catch (err) {
        logger.error(`An error occurred: ${err.message} in check_data api`);
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error"
        })
    }
}

// attendence
const total_attendence = async (req, res) => {
    try {
        const staff_count = await prisma.staff_users.count()
        const today = new Date()
        today.setHours(0, 0, 0, 0);
        const present_status = await prisma.staff_attendence.findMany({
            where: {
                check_in: {
                    gte: today.toISOString(),
                },
            },
            distinct: ['staff_id'],
        });

        const total_staff_present = present_status.length;
        const total_staffabsent = staff_count - total_staff_present
        res.status(200).json({
            error: false,
            success: true,
            message: "successfull",
            data: {
                total_staff_present,
                total_staffabsent,
                staff_count
            }
        })

    } catch (err) {
        logger.error(`An error occurred: ${err.message} in total_attendence api`);
        res.status(400).json({
            error: true,
            success: false,
            message: "internal server error"
        })
    }
}

module.exports = {
    staff_attendence, staff_checkin, staff_leave, leave_approval, staff_claims, claim_approval, leave_balance, adding_staff, claim_details, attendence_list, complete_checkindata, complete_attendence, leave_status, checkin_checkout, complete_leave, complete_claim,
    complete_interval, check_data, total_attendence
}