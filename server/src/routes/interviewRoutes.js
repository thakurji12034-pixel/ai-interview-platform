const router = require('express').Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  createSchema,
  updateSchema,
  statusSchema,
} = require('../validators/interviewValidator');
const ctrl = require('../controllers/interviewController');

router.use(auth); // is file ke saare routes login mange

router.post('/', authorize('interviewer'), validate(createSchema), ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.patch('/:id', authorize('interviewer'), validate(updateSchema), ctrl.update);
router.patch('/:id/status', validate(statusSchema), ctrl.updateStatus);

module.exports = router;