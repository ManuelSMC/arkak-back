const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { sendMail } = require('../config/email');
const emailTemplates = require('../utils/emailTemplates');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone, role } = req.body;

    // Check if user exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationToken = uuidv4();
    const userRole = ['cliente', 'vendedor'].includes(role) ? role : 'cliente';

    const [result] = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, phone, role, verification_token)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, first_name, last_name, phone || null, userRole, verificationToken]
    );

    const user = { id: result.insertId, email, first_name, last_name, role: userRole };

    // Send verification email
    const emailData = emailTemplates.verification(user, verificationToken);
    await sendMail(emailData);

    const token = generateToken(user);

    res.status(201).json({
      message: 'Registro exitoso. Revisa tu correo para verificar tu cuenta.',
      token,
      user: { id: user.id, email, first_name, last_name, role: userRole },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query(
      'SELECT id, email, password, first_name, last_name, role, is_active, is_verified, avatar_url, must_change_password FROM users WHERE email = ?',
      [email]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Tu cuenta ha sido desactivada. Contacta al administrador.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_verified: user.is_verified,
        avatar_url: user.avatar_url,
        must_change_password: !!user.must_change_password,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, email, first_name, last_name, phone, avatar_url, role, is_active, is_verified,
              bio, years_experience, rating, rating_count, must_change_password, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

// POST /api/auth/verify/:token
exports.verifyAccount = async (req, res) => {
  try {
    const { token } = req.params;
    const [rows] = await pool.query('SELECT id FROM users WHERE verification_token = ?', [token]);
    if (!rows.length) {
      return res.status(400).json({ error: 'Token de verificación inválido' });
    }
    await pool.query('UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?', [rows[0].id]);
    res.json({ message: 'Cuenta verificada exitosamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar cuenta' });
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const [rows] = await pool.query('SELECT id, email, first_name FROM users WHERE email = ?', [email]);
    if (!rows.length) {
      return res.json({ message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña.' });
    }
    const user = rows[0];
    const resetToken = uuidv4();
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await pool.query(
      'UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?',
      [resetToken, expires, user.id]
    );

    const emailData = emailTemplates.resetPassword(user, resetToken);
    await sendMail(emailData);

    res.json({ message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
};

// POST /api/auth/reset-password/:token
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const [rows] = await pool.query(
      'SELECT id FROM users WHERE reset_password_token = ? AND reset_password_expires > NOW()',
      [token]
    );
    if (!rows.length) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await pool.query(
      'UPDATE users SET password = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?',
      [hashedPassword, rows[0].id]
    );

    res.json({ message: 'Contraseña restablecida exitosamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al restablecer contraseña' });
  }
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(current_password, rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }
    const hashed = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?', [hashed, req.user.id]);
    res.json({ message: 'Contraseña cambiada exitosamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
};

// PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, phone, bio, years_experience } = req.body;
    const avatar_url = req.file ? `/uploads/avatars/${req.file.filename}` : undefined;

    let query = 'UPDATE users SET first_name = ?, last_name = ?, phone = ?';
    const params = [first_name, last_name, phone || null];

    if (req.user.role === 'vendedor') {
      query += ', bio = ?, years_experience = ?';
      params.push(bio || null, years_experience || null);
    }
    if (avatar_url) {
      query += ', avatar_url = ?';
      params.push(avatar_url);
    }
    query += ' WHERE id = ?';
    params.push(req.user.id);

    await pool.query(query, params);

    const [updated] = await pool.query(
      'SELECT id, email, first_name, last_name, phone, avatar_url, role, bio, years_experience FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
};
