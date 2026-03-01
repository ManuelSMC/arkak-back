const { Router } = require('express');
const appointmentCtrl = require('../controllers/appointmentController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.get('/available-slots', appointmentCtrl.getAvailableSlots);
router.get('/my', authenticate, appointmentCtrl.getMyAppointments);
router.post('/', authenticate, authorize('cliente'), appointmentCtrl.create);
router.put('/:id/cancel', authenticate, appointmentCtrl.cancel);

module.exports = router;
