const pool = require('../config/database');

// GET /api/schedule/my
exports.getMySchedule = async (req, res) => {
  try {
    const [schedules] = await pool.query(
      'SELECT * FROM seller_schedules WHERE seller_id = ? ORDER BY day_of_week',
      [req.user.id]
    );
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener agenda' });
  }
};

// PUT /api/schedule/my (upsert weekly schedule)
exports.updateMySchedule = async (req, res) => {
  try {
    const { schedule } = req.body; // Array of { day_of_week, is_active, start_time, end_time, slot_duration }

    if (!Array.isArray(schedule)) {
      return res.status(400).json({ error: 'Se requiere un array de horarios' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const day of schedule) {
        const { day_of_week, is_active, start_time, end_time, slot_duration } = day;

        if (![30, 45, 60].includes(slot_duration)) {
          throw new Error('La duración del slot debe ser 30, 45 o 60 minutos');
        }

        await connection.query(
          `INSERT INTO seller_schedules (seller_id, day_of_week, is_active, start_time, end_time, slot_duration)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE is_active = ?, start_time = ?, end_time = ?, slot_duration = ?`,
          [
            req.user.id, day_of_week, is_active ? 1 : 0, start_time, end_time, slot_duration,
            is_active ? 1 : 0, start_time, end_time, slot_duration,
          ]
        );
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    const [updated] = await pool.query(
      'SELECT * FROM seller_schedules WHERE seller_id = ? ORDER BY day_of_week',
      [req.user.id]
    );
    res.json(updated);
  } catch (err) {
    console.error('Update schedule error:', err);
    res.status(500).json({ error: err.message || 'Error al actualizar agenda' });
  }
};

// GET /api/schedule/blocked
exports.getBlockedSlots = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    let where = ['seller_id = ?'];
    let params = [req.user.id];
    if (from_date) { where.push('blocked_date >= ?'); params.push(from_date); }
    if (to_date) { where.push('blocked_date <= ?'); params.push(to_date); }

    const [slots] = await pool.query(
      `SELECT * FROM blocked_slots WHERE ${where.join(' AND ')} ORDER BY blocked_date, start_time`,
      params
    );
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener bloqueos' });
  }
};

// POST /api/schedule/blocked
exports.createBlockedSlot = async (req, res) => {
  try {
    const { blocked_date, start_time, end_time, reason } = req.body;
    const [result] = await pool.query(
      `INSERT INTO blocked_slots (seller_id, blocked_date, start_time, end_time, reason)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, blocked_date, start_time || null, end_time || null, reason || null]
    );
    res.status(201).json({ id: result.insertId, blocked_date, start_time, end_time, reason });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear bloqueo' });
  }
};

// DELETE /api/schedule/blocked/:id
exports.removeBlockedSlot = async (req, res) => {
  try {
    await pool.query('DELETE FROM blocked_slots WHERE id = ? AND seller_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Bloqueo eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar bloqueo' });
  }
};
