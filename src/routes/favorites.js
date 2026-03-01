const { Router } = require('express');
const favoriteCtrl = require('../controllers/favoriteController');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.get('/', authenticate, favoriteCtrl.getMyFavorites);
router.post('/:propertyId', authenticate, favoriteCtrl.toggle);
router.get('/check/:propertyId', authenticate, favoriteCtrl.check);

module.exports = router;
