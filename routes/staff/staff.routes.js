const express = require('express')
const staffRouter = express.Router()
const {staff_attendence,staff_checkin,staff_leave,leave_approval,staff_claims,claim_approval,leave_balance,adding_staff,claim_details,attendence_list,complete_checkindata,complete_attendence,leave_status,checkin_checkout,complete_leave,complete_claim
    ,complete_interval,check_data,total_attendence} = require('./staff.controller')


staffRouter.post('/attendence',staff_attendence)
staffRouter.post('/checkin',staff_checkin)

staffRouter.post('/leave',staff_leave)
staffRouter.post('/approval',leave_approval)
staffRouter.post('/claims',staff_claims)
staffRouter.post('/claim_approve',claim_approval)
staffRouter.post('/leave_balance',leave_balance)
staffRouter.post('/add_staff',adding_staff)
staffRouter.post('/claim_data',claim_details)
staffRouter.post('/attendence_list',attendence_list)
staffRouter.post('/complete_data',complete_checkindata)
staffRouter.get('/complete_attendence',complete_attendence)
staffRouter.post('/leave_status',leave_status)
staffRouter.get('/checkin_data',checkin_checkout)
staffRouter.get('/complete_leave',complete_leave)
staffRouter.get('/complete_claim',complete_claim)
staffRouter.post('/interval',complete_interval)
staffRouter.post('/checking',check_data)
staffRouter.post('/total',total_attendence)


 
 




module.exports = staffRouter