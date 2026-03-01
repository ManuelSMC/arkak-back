const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const crypto = require('crypto');

// ============ DASHBOARD ============
exports.getDashboard = async (req, res) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
    const monthEnd = dayjs().endOf('month').format('YYYY-MM-DD');

    const [[{ totalProperties }]] = await pool.query('SELECT COUNT(*) as totalProperties FROM properties');
    const [[{ activeProperties }]] = await pool.query('SELECT COUNT(*) as activeProperties FROM properties WHERE status = "activa"');
    const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) as totalUsers FROM users');
    const [[{ totalClients }]] = await pool.query('SELECT COUNT(*) as totalClients FROM users WHERE role = "cliente"');
    const [[{ totalSellers }]] = await pool.query('SELECT COUNT(*) as totalSellers FROM users WHERE role = "vendedor"');
    const [[{ totalAppointments }]] = await pool.query('SELECT COUNT(*) as totalAppointments FROM appointments');

    // Pending seller requests
    const [[{ pendingRequests }]] = await pool.query(
      'SELECT COUNT(*) as pendingRequests FROM seller_requests WHERE status = "pendiente"'
    );

    // Stats this month
    const [[{ newUsersThisMonth }]] = await pool.query(
      'SELECT COUNT(*) as newUsersThisMonth FROM users WHERE created_at BETWEEN ? AND ?',
      [monthStart, monthEnd]
    );
    const [[{ newPropertiesThisMonth }]] = await pool.query(
      'SELECT COUNT(*) as newPropertiesThisMonth FROM properties WHERE created_at BETWEEN ? AND ?',
      [monthStart, monthEnd]
    );

    // Recent registrations
    const [recentUsers] = await pool.query(
      'SELECT id, email, first_name, last_name, role, created_at FROM users ORDER BY created_at DESC LIMIT 5'
    );

    // Recent properties
    const [recentProperties] = await pool.query(
      `SELECT p.id, p.title, p.city, p.status, p.price,
              CONCAT(u.first_name, ' ', u.last_name) as seller_name,
              (SELECT image_url FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order LIMIT 1) as main_image
       FROM properties p JOIN users u ON p.seller_id = u.id
       ORDER BY p.created_at DESC LIMIT 5`
    );

    res.json({
      totalProperties, activeProperties, totalUsers, totalClients, totalSellers,
      totalAppointments, pendingRequests,
      newUsersThisMonth, newPropertiesThisMonth,
      recentUsers, recentProperties,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Error al obtener datos del dashboard' });
  }
};

// ============ USERS CRUD ============
exports.getUsers = async (req, res) => {
  try {
    const { role, is_active, search, page = 1, limit = 20 } = req.query;
    let where = [];
    let params = [];

    if (role) { where.push('role = ?'); params.push(role); }
    if (is_active !== undefined) { where.push('is_active = ?'); params.push(parseInt(is_active)); }
    if (search) {
      where.push('(first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM users ${whereClause}`, params);
    const [users] = await pool.query(
      `SELECT id, email, first_name, last_name, phone, role, is_active, is_verified, avatar_url, created_at
       FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: users,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, is_active, first_name, last_name, phone } = req.body;

    const updates = [];
    const params = [];
    if (role) { updates.push('role = ?'); params.push(role); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (first_name) { updates.push('first_name = ?'); params.push(first_name); }
    if (last_name) { updates.push('last_name = ?'); params.push(last_name); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone || null); }

    if (!updates.length) return res.status(400).json({ error: 'No hay campos para actualizar' });
    params.push(id);

    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    const [rows] = await pool.query(
      'SELECT id, email, first_name, last_name, phone, role, is_active, is_verified FROM users WHERE id = ?', [id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = ? AND role != "admin"', [req.params.id]);
    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};

// ============ PROPERTIES MANAGEMENT ============
exports.getAllProperties = async (req, res) => {
  try {
    const { status, seller_id, search, page = 1, limit = 20 } = req.query;
    let where = [];
    let params = [];

    if (status) { where.push('p.status = ?'); params.push(status); }
    if (seller_id) { where.push('p.seller_id = ?'); params.push(seller_id); }
    if (search) { where.push('(p.title LIKE ? OR p.city LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM properties p ${whereClause}`, params);

    const [properties] = await pool.query(
      `SELECT p.*, u.first_name as seller_first_name, u.last_name as seller_last_name,
              (SELECT image_url FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order LIMIT 1) as main_image
       FROM properties p JOIN users u ON p.seller_id = u.id
       ${whereClause} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: properties,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener propiedades' });
  }
};

// ============ ADMIN PROPERTY UPDATE ============
exports.updateAdminProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, is_featured } = req.body;
    const updates = [];
    const params = [];
    if (status) { updates.push('status = ?'); params.push(status); }
    if (is_featured !== undefined) { updates.push('is_featured = ?'); params.push(is_featured ? 1 : 0); }
    if (!updates.length) return res.status(400).json({ error: 'No hay campos para actualizar' });
    params.push(id);
    await pool.query(`UPDATE properties SET ${updates.join(', ')} WHERE id = ?`, params);
    const [rows] = await pool.query('SELECT * FROM properties WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Propiedad no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Update admin property error:', err);
    res.status(500).json({ error: 'Error al actualizar propiedad' });
  }
};

exports.deleteAdminProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query('SELECT id FROM properties WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Propiedad no encontrada' });
    await pool.query('DELETE FROM properties WHERE id = ?', [id]);
    res.json({ message: 'Propiedad eliminada exitosamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar propiedad' });
  }
};

// ============ APPOINTMENTS MANAGEMENT ============
exports.getAllAppointments = async (req, res) => {
  try {
    const { status, from_date, to_date, seller_id, page = 1, limit = 20 } = req.query;
    let where = [];
    let params = [];

    if (status) { where.push('a.status = ?'); params.push(status); }
    if (from_date) { where.push('a.appointment_date >= ?'); params.push(from_date); }
    if (to_date) { where.push('a.appointment_date <= ?'); params.push(to_date); }
    if (seller_id) { where.push('a.seller_id = ?'); params.push(seller_id); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM appointments a ${whereClause}`, params);

    const [appointments] = await pool.query(
      `SELECT a.*, p.title as property_title,
              c.first_name as client_first_name, c.last_name as client_last_name,
              s.first_name as seller_first_name, s.last_name as seller_last_name
       FROM appointments a
       JOIN properties p ON a.property_id = p.id
       JOIN users c ON a.client_id = c.id
       JOIN users s ON a.seller_id = s.id
       ${whereClause} ORDER BY a.appointment_date DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: appointments,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener citas' });
  }
};

// ============ NOTIFICATIONS ============
exports.getNotifications = async (req, res) => {
  try {
    const [notifications] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    const [[{ unread }]] = await pool.query(
      'SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ data: notifications, unread });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Notificación marcada como leída' });
  } catch (err) {
    res.status(500).json({ error: 'Error al marcar notificación' });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
};

// ============ SELLER DASHBOARD ============
exports.getSellerDashboard = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const today = dayjs().format('YYYY-MM-DD');

    const [[{ totalProperties }]] = await pool.query(
      'SELECT COUNT(*) as totalProperties FROM properties WHERE seller_id = ?', [sellerId]
    );
    const [[{ activeProperties }]] = await pool.query(
      'SELECT COUNT(*) as activeProperties FROM properties WHERE seller_id = ? AND status = "activa"', [sellerId]
    );
    const [[{ totalViews }]] = await pool.query(
      'SELECT COALESCE(SUM(view_count), 0) as totalViews FROM properties WHERE seller_id = ?', [sellerId]
    );
    const [[{ upcomingAppointments }]] = await pool.query(
      'SELECT COUNT(*) as upcomingAppointments FROM appointments WHERE seller_id = ? AND appointment_date >= ? AND status = "confirmada"',
      [sellerId, today]
    );

    const [nextAppointments] = await pool.query(
      `SELECT a.id, a.appointment_date, a.start_time, a.end_time, a.status,
              p.title as property_title,
              c.first_name as client_first_name, c.last_name as client_last_name
       FROM appointments a
       JOIN properties p ON a.property_id = p.id
       JOIN users c ON a.client_id = c.id
       WHERE a.seller_id = ? AND a.appointment_date >= ? AND a.status = 'confirmada'
       ORDER BY a.appointment_date, a.start_time LIMIT 5`,
      [sellerId, today]
    );

    res.json({
      totalProperties, activeProperties, totalViews, upcomingAppointments,
      nextAppointments,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener dashboard' });
  }
};

// ============ PUBLIC SELLER PROFILE ============
exports.getSellerProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const [sellers] = await pool.query(
      `SELECT id, first_name, last_name, avatar_url, bio, years_experience, rating, rating_count, phone, email, created_at
       FROM users WHERE id = ? AND role = 'vendedor' AND is_active = 1`,
      [id]
    );
    if (!sellers.length) return res.status(404).json({ error: 'Vendedor no encontrado' });

    const [[{ propertyCount }]] = await pool.query(
      'SELECT COUNT(*) as propertyCount FROM properties WHERE seller_id = ? AND status = "activa"', [id]
    );

    const [properties] = await pool.query(
      `SELECT p.*,
              (SELECT image_url FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order LIMIT 1) as main_image
       FROM properties p WHERE p.seller_id = ? AND p.status = 'activa' ORDER BY p.created_at DESC`,
      [id]
    );

    res.json({ ...sellers[0], active_properties: propertyCount, properties });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener perfil del vendedor' });
  }
};

// ============ SELLER REQUESTS ============
// POST /api/seller-requests (public)
exports.createSellerRequest = async (req, res) => {
  try {
    const { email, first_name, last_name, phone, bio, years_experience, message } = req.body;

    // Check if email already exists as user
    const [existingUser] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length) {
      return res.status(400).json({ error: 'Ya existe una cuenta con este correo electrónico' });
    }

    // Check if there's already a pending request
    const [existingReq] = await pool.query(
      'SELECT id FROM seller_requests WHERE email = ? AND status = "pendiente"', [email]
    );
    if (existingReq.length) {
      return res.status(400).json({ error: 'Ya tienes una solicitud pendiente de revisión' });
    }

    const [result] = await pool.query(
      `INSERT INTO seller_requests (email, first_name, last_name, phone, bio, years_experience, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, first_name, last_name, phone || null, bio || null, years_experience || null, message || null]
    );

    // Notify admins
    const [admins] = await pool.query('SELECT id FROM users WHERE role = "admin"');
    for (const admin of admins) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link)
         VALUES (?, 'Nueva solicitud de vendedor', ?, 'sistema', '/admin/solicitudes')`,
        [admin.id, `${first_name} ${last_name} (${email}) quiere ser vendedor`]
      );
    }

    res.status(201).json({ message: 'Solicitud enviada exitosamente. Te notificaremos cuando sea revisada.' });
  } catch (err) {
    console.error('Create seller request error:', err);
    res.status(500).json({ error: 'Error al enviar solicitud' });
  }
};

// GET /api/seller-requests (admin)
exports.getSellerRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let where = [];
    let params = [];
    if (status) { where.push('status = ?'); params.push(status); }
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM seller_requests ${whereClause}`, params);
    const [requests] = await pool.query(
      `SELECT * FROM seller_requests ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: requests,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
};

// PUT /api/seller-requests/:id/approve (admin)
exports.approveSellerRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const [requests] = await pool.query('SELECT * FROM seller_requests WHERE id = ? AND status = "pendiente"', [id]);
    if (!requests.length) return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });

    const request = requests[0];

    // Generate temporary password
    const tempPassword = crypto.randomBytes(4).toString('hex'); // 8 char random
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Create user account
    const [result] = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, phone, role, is_active, is_verified, must_change_password, bio, years_experience)
       VALUES (?, ?, ?, ?, ?, 'vendedor', 1, 1, 1, ?, ?)`,
      [request.email, hashedPassword, request.first_name, request.last_name, request.phone, request.bio, request.years_experience]
    );

    // Mark request as approved
    await pool.query(
      'UPDATE seller_requests SET status = "aprobada", reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      [req.user.id, id]
    );

    console.log(`[SELLER APPROVED] ${request.email} - Temp password: ${tempPassword}`);

    res.json({
      message: 'Solicitud aprobada. Se creó la cuenta del vendedor.',
      user: { email: request.email, first_name: request.first_name, last_name: request.last_name },
      tempPassword, // In production, this would be sent by email only
    });
  } catch (err) {
    console.error('Approve seller request error:', err);
    res.status(500).json({ error: 'Error al aprobar solicitud' });
  }
};

// PUT /api/seller-requests/:id/reject (admin)
exports.rejectSellerRequest = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE seller_requests SET status = "rechazada", reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      [req.user.id, id]
    );
    res.json({ message: 'Solicitud rechazada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al rechazar solicitud' });
  }
};

// ============ ADMIN CREATE USER ============
exports.createUser = async (req, res) => {
  try {
    const { email, first_name, last_name, phone, role } = req.body;

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(400).json({ error: 'El correo electrónico ya está registrado' });

    const tempPassword = crypto.randomBytes(4).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    const userRole = ['cliente', 'vendedor', 'admin'].includes(role) ? role : 'cliente';

    const [result] = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, phone, role, is_active, is_verified, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1, 1)`,
      [email, hashedPassword, first_name, last_name, phone || null, userRole]
    );

    console.log(`[USER CREATED BY ADMIN] ${email} - Temp password: ${tempPassword}`);

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: { id: result.insertId, email, first_name, last_name, role: userRole },
      tempPassword,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};
