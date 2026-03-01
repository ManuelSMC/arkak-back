const pool = require('../config/database');

// GET /api/properties  (public - with filters)
exports.getAll = async (req, res) => {
  try {
    const {
      operation_type, property_type, min_price, max_price,
      bedrooms, bathrooms, min_area, max_area, neighborhood,
      city, sort, page = 1, limit = 12, search, featured,
    } = req.query;

    let where = ['p.status = "activa"'];
    let params = [];

    if (operation_type) { where.push('p.operation_type = ?'); params.push(operation_type); }
    if (property_type) { where.push('p.property_type = ?'); params.push(property_type); }
    if (min_price) { where.push('p.price >= ?'); params.push(parseFloat(min_price)); }
    if (max_price) { where.push('p.price <= ?'); params.push(parseFloat(max_price)); }
    if (bedrooms) { where.push('p.bedrooms >= ?'); params.push(parseInt(bedrooms)); }
    if (bathrooms) { where.push('p.bathrooms >= ?'); params.push(parseInt(bathrooms)); }
    if (min_area) { where.push('p.total_area >= ?'); params.push(parseFloat(min_area)); }
    if (max_area) { where.push('p.total_area <= ?'); params.push(parseFloat(max_area)); }
    if (neighborhood) { where.push('p.neighborhood LIKE ?'); params.push(`%${neighborhood}%`); }
    if (city) { where.push('p.city LIKE ?'); params.push(`%${city}%`); }
    if (featured === 'true') { where.push('p.is_featured = 1'); }
    if (search) {
      where.push('MATCH(p.title, p.description, p.neighborhood, p.city) AGAINST(? IN BOOLEAN MODE)');
      params.push(search);
    }

    let orderBy = 'p.created_at DESC';
    if (sort === 'price_asc') orderBy = 'p.price ASC';
    else if (sort === 'price_desc') orderBy = 'p.price DESC';
    else if (sort === 'views') orderBy = 'p.view_count DESC';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // Count total
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM properties p ${whereClause}`, params
    );
    const total = countRows[0].total;

    // Fetch properties with first image and seller info
    const [properties] = await pool.query(
      `SELECT p.*, 
              u.first_name as seller_first_name, u.last_name as seller_last_name, u.avatar_url as seller_avatar,
              (SELECT image_url FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order LIMIT 1) as main_image
       FROM properties p
       JOIN users u ON p.seller_id = u.id
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: properties,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get properties error:', err);
    res.status(500).json({ error: 'Error al obtener propiedades' });
  }
};

// GET /api/properties/:id (public)
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const [properties] = await pool.query(
      `SELECT p.*, 
              u.id as seller_user_id, u.first_name as seller_first_name, u.last_name as seller_last_name,
              u.avatar_url as seller_avatar, u.phone as seller_phone, u.email as seller_email,
              u.bio as seller_bio, u.years_experience as seller_years_experience,
              u.rating as seller_rating, u.rating_count as seller_rating_count
       FROM properties p
       JOIN users u ON p.seller_id = u.id
       WHERE p.id = ?`,
      [id]
    );

    if (!properties.length) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    // Get images
    const [images] = await pool.query(
      'SELECT id, image_url, sort_order FROM property_images WHERE property_id = ? ORDER BY sort_order',
      [id]
    );

    // Increment view count
    await pool.query('UPDATE properties SET view_count = view_count + 1 WHERE id = ?', [id]);

    res.json({ ...properties[0], images });
  } catch (err) {
    console.error('Get property error:', err);
    res.status(500).json({ error: 'Error al obtener propiedad' });
  }
};

// POST /api/properties (vendedor)
exports.create = async (req, res) => {
  try {
    const {
      title, description, price, operation_type, property_type,
      street, neighborhood, city, state, zip_code, latitude, longitude,
      total_area, built_area, bedrooms, bathrooms, half_bathrooms,
      parking_spaces, year_built,
      has_garden, has_pool, has_storage, has_security, is_furnished,
    } = req.body;

    const [result] = await pool.query(
      `INSERT INTO properties 
       (seller_id, title, description, price, operation_type, property_type,
        street, neighborhood, city, state, zip_code, latitude, longitude,
        total_area, built_area, bedrooms, bathrooms, half_bathrooms,
        parking_spaces, year_built,
        has_garden, has_pool, has_storage, has_security, is_furnished)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, title, description, price, operation_type, property_type,
        street, neighborhood, city, state, zip_code, latitude || null, longitude || null,
        total_area, built_area || null, bedrooms || 0, bathrooms || 0, half_bathrooms || 0,
        parking_spaces || 0, year_built || null,
        has_garden ? 1 : 0, has_pool ? 1 : 0, has_storage ? 1 : 0, has_security ? 1 : 0, is_furnished ? 1 : 0,
      ]
    );

    // Handle uploaded images
    if (req.files && req.files.length > 0) {
      const imageValues = req.files.map((file, index) => [
        result.insertId, `/uploads/properties/${file.filename}`, index,
      ]);
      await pool.query(
        'INSERT INTO property_images (property_id, image_url, sort_order) VALUES ?',
        [imageValues]
      );
    }

    const [created] = await pool.query('SELECT * FROM properties WHERE id = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error('Create property error:', err);
    res.status(500).json({ error: 'Error al crear propiedad' });
  }
};

// PUT /api/properties/:id (vendedor/admin)
exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    // Check ownership or admin
    const [existing] = await pool.query('SELECT seller_id FROM properties WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (req.user.role !== 'admin' && existing[0].seller_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permisos para editar esta propiedad' });
    }

    const fields = [
      'title', 'description', 'price', 'operation_type', 'property_type',
      'street', 'neighborhood', 'city', 'state', 'zip_code', 'latitude', 'longitude',
      'total_area', 'built_area', 'bedrooms', 'bathrooms', 'half_bathrooms',
      'parking_spaces', 'year_built',
      'has_garden', 'has_pool', 'has_storage', 'has_security', 'is_furnished', 'status',
    ];

    const updates = [];
    const params = [];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        const boolFields = ['has_garden', 'has_pool', 'has_storage', 'has_security', 'is_furnished'];
        params.push(boolFields.includes(field) ? (req.body[field] ? 1 : 0) : req.body[field]);
      }
    }

    if (req.user.role === 'admin' && req.body.is_featured !== undefined) {
      updates.push('is_featured = ?');
      params.push(req.body.is_featured ? 1 : 0);
    }

    if (updates.length) {
      params.push(id);
      await pool.query(`UPDATE properties SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // Handle new uploaded images
    if (req.files && req.files.length > 0) {
      const [maxOrder] = await pool.query(
        'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM property_images WHERE property_id = ?',
        [id]
      );
      const startOrder = maxOrder[0].max_order + 1;
      const imageValues = req.files.map((file, index) => [
        id, `/uploads/properties/${file.filename}`, startOrder + index,
      ]);
      await pool.query(
        'INSERT INTO property_images (property_id, image_url, sort_order) VALUES ?',
        [imageValues]
      );
    }

    const [updated] = await pool.query('SELECT * FROM properties WHERE id = ?', [id]);
    const [images] = await pool.query(
      'SELECT id, image_url, sort_order FROM property_images WHERE property_id = ? ORDER BY sort_order',
      [id]
    );
    res.json({ ...updated[0], images });
  } catch (err) {
    console.error('Update property error:', err);
    res.status(500).json({ error: 'Error al actualizar propiedad' });
  }
};

// DELETE /api/properties/:id
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query('SELECT seller_id FROM properties WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (req.user.role !== 'admin' && existing[0].seller_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar esta propiedad' });
    }
    await pool.query('DELETE FROM properties WHERE id = ?', [id]);
    res.json({ message: 'Propiedad eliminada exitosamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar propiedad' });
  }
};

// DELETE /api/properties/:id/images/:imageId
exports.removeImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;
    const [existing] = await pool.query('SELECT seller_id FROM properties WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (req.user.role !== 'admin' && existing[0].seller_id !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    await pool.query('DELETE FROM property_images WHERE id = ? AND property_id = ?', [imageId, id]);
    res.json({ message: 'Imagen eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar imagen' });
  }
};

// GET /api/properties/seller/mine (vendedor)
exports.getMyProperties = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    let where = ['p.seller_id = ?'];
    let params = [req.user.id];

    if (status) { where.push('p.status = ?'); params.push(status); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = 'WHERE ' + where.join(' AND ');

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM properties p ${whereClause}`, params
    );

    const [properties] = await pool.query(
      `SELECT p.*,
              (SELECT image_url FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order LIMIT 1) as main_image
       FROM properties p ${whereClause}
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: properties,
      pagination: {
        total: countRows[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countRows[0].total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener propiedades' });
  }
};
