const express = require('express')
const { user_access ,view_access} = require('./user_access.controller')
const useraccessRouter = express.Router()


useraccessRouter.post('/',user_access)
useraccessRouter.get('/view',view_access)



module.exports = useraccessRouter