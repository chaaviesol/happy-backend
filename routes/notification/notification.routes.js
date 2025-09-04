const express = require('express');
const { getadm_notification, getcus_sup__notification, adm_read_notification, notification_types, cus_read_notification, staff_notification, newstaffnotification } = require('./notification.controller');


const notificationRouter = express.Router()


notificationRouter.route('/getadm_notification').post(getadm_notification)
notificationRouter.route('/get_notification').post(getcus_sup__notification)
notificationRouter.route('/admread_notification').post(adm_read_notification)
notificationRouter.route('/cusread_notification').post(cus_read_notification)
notificationRouter.route('/notification_types').post(notification_types)
notificationRouter.route('/staff_notification').post(staff_notification)
notificationRouter.route('/newstaffnotification').post(newstaffnotification)



module.exports = notificationRouter;