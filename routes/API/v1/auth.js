const express = require('express');
const { checkPassword } = require('../../../../controllers/admin/dashboard');
const router = express.Router({mergeParams:true})


router.post('/login', checkPassword)


module.exports = router;
