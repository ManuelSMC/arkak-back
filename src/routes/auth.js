const { Router } = require('express');
const { body } = require('express-validator');
const authCtrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');
const validate = require('../middleware/validate');

const router = Router();

router.post('/register', [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('first_name').trim().notEmpty().withMessage('Nombre es obligatorio'),
  body('last_name').trim().notEmpty().withMessage('Apellido es obligatorio'),
  validate,
], authCtrl.register);

router.post('/login', [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña es obligatoria'),
  validate,
], authCtrl.login);

router.get('/me', authenticate, authCtrl.getMe);
router.post('/verify/:token', authCtrl.verifyAccount);
router.post('/forgot-password', [body('email').isEmail(), validate], authCtrl.forgotPassword);
router.post('/reset-password/:token', [body('password').isLength({ min: 6 }), validate], authCtrl.resetPassword);
router.put('/change-password', authenticate, [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 6 }),
  validate,
], authCtrl.changePassword);
router.put('/profile', authenticate, uploadAvatar.single('avatar'), authCtrl.updateProfile);

module.exports = router;
