const pool = require('../config/database');

// GET /api/favorites
exports.getMyFavorites = async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [countRows] = await pool.query(
      'SELECT COUNT(*) as total FROM favorites WHERE user_id = ?', [req.user.id]
    );

    const [favorites] = await pool.query(
      `SELECT f.id as favorite_id, f.created_at as favorited_at, p.*,
              (SELECT image_url FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order LIMIT 1) as main_image,
              u.first_name as seller_first_name, u.last_name as seller_last_name
       FROM favorites f
       JOIN properties p ON f.property_id = p.id
       JOIN users u ON p.seller_id = u.id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, parseInt(limit), offset]
    );

    res.json({
      data: favorites,
      pagination: {
        total: countRows[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countRows[0].total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener favoritos' });
  }
};

// POST /api/favorites/:propertyId
exports.toggle = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const [existing] = await pool.query(
      'SELECT id FROM favorites WHERE user_id = ? AND property_id = ?',
      [req.user.id, propertyId]
    );

    if (existing.length) {
      await pool.query('DELETE FROM favorites WHERE id = ?', [existing[0].id]);
      return res.json({ favorited: false, message: 'Removido de favoritos' });
    }

    await pool.query(
      'INSERT INTO favorites (user_id, property_id) VALUES (?, ?)',
      [req.user.id, propertyId]
    );
    res.json({ favorited: true, message: 'Agregado a favoritos' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar favoritos' });
  }
};

// GET /api/favorites/check/:propertyId
exports.check = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM favorites WHERE user_id = ? AND property_id = ?',
      [req.user.id, req.params.propertyId]
    );
    res.json({ favorited: rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar favorito' });
  }
};
