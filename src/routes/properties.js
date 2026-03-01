const { Router } = require('express');
const propertyCtrl = require('../controllers/propertyController');
const { authenticate, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = Router();

// Public routes
router.get('/', propertyCtrl.getAll);
router.get('/:id', propertyCtrl.getById);

// Seller routes
router.get('/seller/mine', authenticate, authorize('vendedor'), propertyCtrl.getMyProperties);
router.post('/', authenticate, authorize('vendedor'), upload.array('images', 20), propertyCtrl.create);
router.put('/:id', authenticate, authorize('vendedor', 'admin'), upload.array('images', 20), propertyCtrl.update);
router.delete('/:id', authenticate, authorize('vendedor', 'admin'), propertyCtrl.remove);
router.delete('/:id/images/:imageId', authenticate, authorize('vendedor', 'admin'), propertyCtrl.removeImage);

module.exports = router;
