const router = require('express').Router();
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { registerSchema, loginSchema } = require('../validators/authValidator');
const {
  register,
  login,
  refresh,
  logout,
  me,
} = require('../controllers/authController');

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', auth, me);

// Sirf role guard test karne ke liye, baad me hata denge
router.get('/interviewer-check', auth, authorize('interviewer'), (req, res) => {
  res.json({ message: 'Welcome, interviewer' });
});

module.exports = router;