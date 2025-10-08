const express = require("express");
const { addadmin, approveUsersList, superadmin, viewSuppliers, userDetails, viewUserDetails, userApproval, updateuser, addUsers, getSingleDataById, supplierCodes, userFeedback, deleteuser, userApprovalbyID, userLogin, forgotPwd, otpLogin, resetPwd, userProfile, editUser, supplieredit, bankdetailsadd, Users, Customers_view, users_types, customertransaction } = require("./users.controller");
const auth = require('../../middleware/Auth/auth')
const usersRoutes = express.Router()

usersRoutes.post('/add', addUsers)
usersRoutes.post('/addadmin',  addadmin)
usersRoutes.post('/superadmin',auth, superadmin)
usersRoutes.post('/deleteuserid', deleteuser)///////n
usersRoutes.post('/singleid/:id', getSingleDataById)//////////n
usersRoutes.post('/getapprovals', auth, approveUsersList)
usersRoutes.post('/viewsup', auth, viewSuppliers)
usersRoutes.post('/viewuserdetails', viewUserDetails)
usersRoutes.post('/userinfo', userDetails)///////dbt
usersRoutes.post('/userapproval', auth, userApproval)
usersRoutes.post('/userupdate', updateuser)
usersRoutes.post('/supcode', auth, supplierCodes)

usersRoutes.post('/userfeedback', auth, userFeedback)
// usersRoutes.post('/viewfeedback',viewfeedback)
usersRoutes.post('/userapprovalbyid/:id', userApprovalbyID)
usersRoutes.post('/userlogin', userLogin)
usersRoutes.post('/forgotPwd', forgotPwd)
usersRoutes.post('/otpLogin', otpLogin)
usersRoutes.post('/resetPwd/:id', resetPwd)
// router
//   .route("/profile/:id")
//   .get(usersRoutes.userProfile)
//   .patch(usersRoutes.editUser);

usersRoutes.get('/profile/:id', userProfile)
usersRoutes.post('/profile/:id', editUser)
usersRoutes.post('/supplieredit/:id', supplieredit)
usersRoutes.post('/bankdetailsadd/:id', bankdetailsadd)

usersRoutes.post('/viewusers', auth, Users)///////////n
usersRoutes.post('/viewcustomers', auth, Customers_view)

usersRoutes.get('/users_types', auth, users_types)
usersRoutes.post("/transactionhistory",auth,customertransaction)

module.exports = usersRoutes       