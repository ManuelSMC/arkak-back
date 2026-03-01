const pool = require('../config/database');
const { sendMail } = require('../config/email');
const emailTemplates = require('../utils/emailTemplates');
const dayjs = require('dayjs');

// Helper: generate time slots
function generateSlots(startTime, endTime, durationMinutes) {
  const slots = [];
  let current = dayjs(`2000-01-01 ${startTime}`);
  const end = dayjs(`2000-01-01 ${endTime}`);
  while (current.add(durationMinutes, 'minute').isBefore(end) || current.add(durationMinutes, 'minute').isSame(end)) {
    slots.push({
      start: current.format('HH:mm:ss'),
      end: current.add(durationMinutes, 'minute').format('HH:mm:ss'),
    });
    current = current.add(durationMinutes, 'minute');
  }
  return slots;
}

// GET /api/appointments/available-slots?seller_id=X&date=YYYY-MM-DD
exports.getAvailableSlots = async (req, res) => {
  try {
    const { seller_id, date } = req.query;
    if (!seller_id || !date) {
      return res.status(400).json({ error: 'seller_id y date son requeridos' });
    }

    const targetDate = dayjs(date);
    if (targetDate.isBefore(dayjs(), 'day')) {
      return res.status(400).json({ error: 'La fecha no puede ser en el pasado' });
    }

    const dayOfWeek = targetDate.day(); // 0=Sun

    // Get seller schedule for this day
    const [schedules] = await pool.query(
      'SELECT * FROM seller_schedules WHERE seller_id = ? AND day_of_week = ? AND is_active = 1',
      [seller_id, dayOfWeek]
    );
    if (!schedules.length) {
      return res.json({ slots: [], message: 'El vendedor no tiene disponibilidad este día' });
    }

    const schedule = schedules[0];
    const allSlots = generateSlots(schedule.start_time, schedule.end_time, schedule.slot_duration);

    // Get blocked slots for this date
    const [blocked] = await pool.query(
      'SELECT start_time, end_time FROM blocked_slots WHERE seller_id = ? AND blocked_date = ?',
      [seller_id, date]
    );

    // Get existing appointments for this date
    const [appointments] = await pool.query(
      `SELECT start_time, end_time FROM appointments 
       WHERE seller_id = ? AND appointment_date = ? AND status = 'confirmada'`,
      [seller_id, date]
    );

    // Filter available slots
    const available = allSlots.map(slot => {
      const isBlocked = blocked.some(b => {
        if (!b.start_time && !b.end_time) return true; // full day block
        return slot.start >= b.start_time && slot.start < b.end_time;
      });
      const isBooked = appointments.some(a =>
        slot.start >= a.start_time && slot.start < a.end_time
      );
      return { ...slot, available: !isBlocked && !isBooked };
    });

    res.json({ slots: available, schedule });
  } catch (err) {
    console.error('Get available slots error:', err);
    res.status(500).json({ error: 'Error al obtener horarios disponibles' });
  }
};

// POST /api/appointments (cliente)
exports.create = async (req, res) => {
  try {
    const { property_id, seller_id, appointment_date, start_time, end_time, notes } = req.body;

    // Validate date is not in the past
    if (dayjs(appointment_date).isBefore(dayjs(), 'day')) {
      return res.status(400).json({ error: 'La fecha de la cita no puede ser en el pasado' });
    }

    // Validate seller schedule
    const dayOfWeek = dayjs(appointment_date).day();
    const [schedules] = await pool.query(
      'SELECT * FROM seller_schedules WHERE seller_id = ? AND day_of_week = ? AND is_active = 1',
      [seller_id, dayOfWeek]
    );
    if (!schedules.length) {
      return res.status(400).json({ error: 'El vendedor no tiene disponibilidad este día' });
    }
    const schedule = schedules[0];
    if (start_time < schedule.start_time || end_time > schedule.end_time) {
      return res.status(400).json({ error: 'La cita está fuera del horario laboral del vendedor' });
    }

    // Check blocked slots
    const [blocked] = await pool.query(
      `SELECT id FROM blocked_slots 
       WHERE seller_id = ? AND blocked_date = ? 
       AND ((start_time IS NULL) OR (? >= start_time AND ? < end_time))`,
      [seller_id, appointment_date, start_time, start_time]
    );
    if (blocked.length) {
      return res.status(400).json({ error: 'Este horario está bloqueado por el vendedor' });
    }

    // Check double booking
    const [existing] = await pool.query(
      `SELECT id FROM appointments 
       WHERE seller_id = ? AND appointment_date = ? AND start_time = ? AND status = 'confirmada'`,
      [seller_id, appointment_date, start_time]
    );
    if (existing.length) {
      return res.status(400).json({ error: 'Este horario ya está reservado' });
    }

    // Create appointment
    const [result] = await pool.query(
      `INSERT INTO appointments (property_id, client_id, seller_id, appointment_date, start_time, end_time, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [property_id, req.user.id, seller_id, appointment_date, start_time, end_time, notes || null]
    );

    // Get details for email
    const [clients] = await pool.query('SELECT id, email, first_name, last_name FROM users WHERE id = ?', [req.user.id]);
    const [sellers] = await pool.query('SELECT id, email, first_name, last_name FROM users WHERE id = ?', [seller_id]);
    const [properties] = await pool.query('SELECT id, title FROM properties WHERE id = ?', [property_id]);

    const appt = { appointment_date, start_time, end_time };

    // Send emails to both parties
    const clientEmail = emailTemplates.appointmentConfirmClient(clients[0], sellers[0], properties[0], appt);
    const sellerEmail = emailTemplates.appointmentConfirmSeller(clients[0], sellers[0], properties[0], appt);
    await Promise.all([sendMail(clientEmail), sendMail(sellerEmail)]);

    // Create notification for seller
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES (?, ?, ?, 'cita', ?)`,
      [
        seller_id,
        'Nueva cita agendada',
        `${clients[0].first_name} ${clients[0].last_name} agendó una cita para ${properties[0].title}`,
        `/vendedor/agenda`,
      ]
    );

    res.status(201).json({
      message: 'Cita agendada exitosamente',
      appointment: { id: result.insertId, ...appt, property_id, seller_id, status: 'confirmada' },
    });
  } catch (err) {
    console.error('Create appointment error:', err);
    res.status(500).json({ error: 'Error al agendar cita' });
  }
};

// PUT /api/appointments/:id/cancel
exports.cancel = async (req, res) => {
  try {
    const { id } = req.params;
    const [appointments] = await pool.query(
      `SELECT a.*, p.title as property_title 
       FROM appointments a JOIN properties p ON a.property_id = p.id 
       WHERE a.id = ?`,
      [id]
    );
    if (!appointments.length) return res.status(404).json({ error: 'Cita no encontrada' });

    const appt = appointments[0];
    if (appt.status !== 'confirmada') {
      return res.status(400).json({ error: 'Esta cita ya fue cancelada o completada' });
    }

    // Check user is participant
    const isClient = appt.client_id === req.user.id;
    const isSeller = appt.seller_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isClient && !isSeller && !isAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Client must cancel 24h in advance
    if (isClient) {
      const apptDateTime = dayjs(`${appt.appointment_date} ${appt.start_time}`);
      const hoursUntil = apptDateTime.diff(dayjs(), 'hour');
      if (hoursUntil < 24) {
        return res.status(400).json({ error: 'Las citas solo pueden cancelarse con al menos 24 horas de anticipación' });
      }
    }

    const cancelledBy = isClient ? 'cliente' : (isSeller ? 'vendedor' : 'admin');
    await pool.query(
      `UPDATE appointments SET status = 'cancelada', cancelled_by = ?, cancelled_at = NOW() WHERE id = ?`,
      [cancelledBy, id]
    );

    // Notify the other party
    const [clients] = await pool.query('SELECT id, email, first_name FROM users WHERE id = ?', [appt.client_id]);
    const [sellers] = await pool.query('SELECT id, email, first_name FROM users WHERE id = ?', [appt.seller_id]);

    const property = { title: appt.property_title };
    const apptData = { appointment_date: appt.appointment_date, start_time: appt.start_time };

    if (isClient) {
      try { await sendMail(emailTemplates.appointmentCancelled(sellers[0], property, apptData)); } catch (e) { console.warn('Email failed:', e.message); }
    } else {
      try { await sendMail(emailTemplates.appointmentCancelled(clients[0], property, apptData)); } catch (e) { console.warn('Email failed:', e.message); }
    }

    res.json({ message: 'Cita cancelada exitosamente' });
  } catch (err) {
    console.error('Cancel appointment error:', err);
    res.status(500).json({ error: 'Error al cancelar cita' });
  }
};

// GET /api/appointments/my (client or seller)
exports.getMyAppointments = async (req, res) => {
  try {
    const { status, from_date, to_date, page = 1, limit = 10 } = req.query;
    const isVendedor = req.user.role === 'vendedor';
    let where = [isVendedor ? 'a.seller_id = ?' : 'a.client_id = ?'];
    let params = [req.user.id];

    if (status) { where.push('a.status = ?'); params.push(status); }
    if (from_date) { where.push('a.appointment_date >= ?'); params.push(from_date); }
    if (to_date) { where.push('a.appointment_date <= ?'); params.push(to_date); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = 'WHERE ' + where.join(' AND ');

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM appointments a ${whereClause}`, params
    );

    const [appointments] = await pool.query(
      `SELECT a.*, 
              p.title as property_title, p.street as property_address,
              (SELECT image_url FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order LIMIT 1) as property_image,
              c.first_name as client_first_name, c.last_name as client_last_name, c.email as client_email, c.phone as client_phone,
              s.first_name as seller_first_name, s.last_name as seller_last_name, s.email as seller_email, s.phone as seller_phone
       FROM appointments a
       JOIN properties p ON a.property_id = p.id
       JOIN users c ON a.client_id = c.id
       JOIN users s ON a.seller_id = s.id
       ${whereClause}
       ORDER BY a.appointment_date ASC, a.start_time ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: appointments,
      pagination: {
        total: countRows[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countRows[0].total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener citas' });
  }
};
