const express = require('express');
const router = express.Router();

const {
  adminLogin,
  getAllUsers,
  getAdminAIContent,
} = require('../controllers/adminController');
const verifyAdminToken = require('../middleware/isAdmin');

router.post('/login', adminLogin);
router.get('/users', verifyAdminToken, getAllUsers);
router.get('/ai-content', verifyAdminToken, getAdminAIContent);

module.exports = router;