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

const user_access = async (request, response) => {
    console.log(request.body);
    const usertype = "SU";
    const access_list = request.body.access_list;

    try {
        if (usertype === "SU") {
            if (!access_list) {
                response
                    .status(404)
                    .json({ error: "access_list is undefined" });
                logger.error(
                    "access_list is undefined in user_access api"
                );
                return;
            }

            const all_data = await prisma.user_access.findMany();

            // Identify records to delete
            const recordsToDelete = all_data.filter(dbRecord => {
                const existsInFrontend = access_list.some(
                    frontendRecord =>
                        frontendRecord.user_type.toUpperCase() ===
                        dbRecord.user_type &&
                        frontendRecord.division === dbRecord.division &&
                        frontendRecord.department === dbRecord.department
                );
                console.log("existsInFrontend", existsInFrontend);
                return !existsInFrontend;
            });

            // Delete extra records
            for (const recordToDelete of recordsToDelete) {
                await prisma.user_access.delete({
                    where: { id: recordToDelete.id },
                });
                console.log("access deleted", recordToDelete);
            }

            for (let i = 0; i < access_list.length; i++) {
                if (
                    access_list[i].user_type &&
                    access_list[i].division &&
                    access_list[i].department &&
                    access_list[i].access
                ) {
                    const existingAccess = await prisma.user_access.findFirst({
                        where: {
                            user_type: access_list[i].user_type.toUpperCase(),
                            division: access_list[i].division,
                            department: access_list[i].department,
                        },
                    });

                    if (existingAccess) {
                        const updatedAccess = await prisma.user_access.update({
                            where: { id: existingAccess.id },
                            data: {
                                access: access_list[i].access,
                            },
                        });

                        console.log("access updated", updatedAccess);
                    } else {
                        const id = await prisma.user_access.findFirst({
                            select: {
                                id: true,
                            },
                            orderBy: {
                                id: 'desc',
                            },
                        });
                        const new_id = id ? id.id + 1 : 1;

                        const access_create = await prisma.user_access.create({
                            data: {
                                id: new_id,
                                user_type: access_list[i].user_type.toUpperCase(),
                                division: access_list[i].division,
                                department: access_list[i].department,
                                access: access_list[i].access,
                            },
                        });
                    }
                }
            }
            response.status(200).json({ success: true });
        } else {
            logger.error(`Unauthorized- in user_access api`);
            response
                .status(403)
                .json({ error: "Unauthorized. You are not a super admin" });
        }
    } catch (error) {
        console.log(error);
        response.status(500).json({ error: "Internal server error" });
        logger.error(
            `Internal server error: ${error.message} in user_access api`
        );
    }finally {
        await prisma.$disconnect();
      }
};

const view_access = async (request, response) => {
    console.log("view_access");
    const usertype = "SU"
    try {
        if (usertype === "SU") {
            const access_view = await prisma.user_access.findMany({
                orderBy: {
                    id: 'asc'
                }
            })
            response.status(200).json(access_view)
        }
        else {
            logger.error(`Unauthorized- in view_access api`);
            response
                .status(403)
                .json({ error: "Unauthorized. You are not a super admin" });
        }
    }
    catch (error) {
        console.log(error);
        response.status(500).json({ error: "Internal server error" });
        logger.error(
            `Internal server error: ${error.message} in view_access api`
        );
    }finally {
        await prisma.$disconnect();
      }
}



module.exports = { user_access, view_access }