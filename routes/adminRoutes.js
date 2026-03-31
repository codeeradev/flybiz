const express = require('express');
const router = express.Router();

const { adminLogin, getAllUsers } = require('../controllers/adminController');
const verifyAdminToken = require('../middleware/isAdmin');

router.post('/login', adminLogin);
router.get('/users', verifyAdminToken, getAllUsers);

module.exports = router;