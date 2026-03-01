const { Router } = require('express');
const { body } = require('express-validator');
const adminCtrl = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = Router();

// Admin-only routes
router.get('/dashboard', authenticate, authorize('admin'), adminCtrl.getDashboard);
router.get('/users', authenticate, authorize('admin'), adminCtrl.getUsers);
router.post('/users', authenticate, authorize('admin'), [
  body('email').isEmail().withMessage('Email inválido'),
  body('first_name').trim().notEmpty().withMessage('Nombre es obligatorio'),
  body('last_name').trim().notEmpty().withMessage('Apellido es obligatorio'),
  validate,
], adminCtrl.createUser);
router.put('/users/:id', authenticate, authorize('admin'), adminCtrl.updateUser);
router.delete('/users/:id', authenticate, authorize('admin'), adminCtrl.deleteUser);
router.get('/admin/properties', authenticate, authorize('admin'), adminCtrl.getAllProperties);
router.put('/admin/properties/:id', authenticate, authorize('admin'), adminCtrl.updateAdminProperty);
router.delete('/admin/properties/:id', authenticate, authorize('admin'), adminCtrl.deleteAdminProperty);

// Seller requests
router.post('/seller-requests', [
  body('email').isEmail().withMessage('Email inválido'),
  body('first_name').trim().notEmpty().withMessage('Nombre es obligatorio'),
  body('last_name').trim().notEmpty().withMessage('Apellido es obligatorio'),
  validate,
], adminCtrl.createSellerRequest);
router.get('/seller-requests', authenticate, authorize('admin'), adminCtrl.getSellerRequests);
router.put('/seller-requests/:id/approve', authenticate, authorize('admin'), adminCtrl.approveSellerRequest);
router.put('/seller-requests/:id/reject', authenticate, authorize('admin'), adminCtrl.rejectSellerRequest);

// Seller dashboard
router.get('/seller/dashboard', authenticate, authorize('vendedor'), adminCtrl.getSellerDashboard);

// Notifications (any authenticated user)
router.get('/notifications', authenticate, adminCtrl.getNotifications);
router.put('/notifications/:id/read', authenticate, adminCtrl.markNotificationRead);
router.put('/notifications/read-all', authenticate, adminCtrl.markAllNotificationsRead);

// Public seller profile
router.get('/sellers/:id/profile', adminCtrl.getSellerProfile);

module.exports = router;
