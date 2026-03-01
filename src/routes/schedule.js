const { Router } = require('express');
const scheduleCtrl = require('../controllers/scheduleController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.get('/my', authenticate, authorize('vendedor'), scheduleCtrl.getMySchedule);
router.put('/my', authenticate, authorize('vendedor'), scheduleCtrl.updateMySchedule);
router.get('/blocked', authenticate, authorize('vendedor'), scheduleCtrl.getBlockedSlots);
router.post('/blocked', authenticate, authorize('vendedor'), scheduleCtrl.createBlockedSlot);
router.delete('/blocked/:id', authenticate, authorize('vendedor'), scheduleCtrl.removeBlockedSlot);

module.exports = router;
