const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function seed() {
  try {
    console.log('🌱 Seeding ArkaK database...');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    await pool.query(
      `INSERT IGNORE INTO users (email, password, first_name, last_name, role, is_active, is_verified)
       VALUES (?, ?, ?, ?, 'admin', 1, 1)`,
      ['admin@arkak.com', adminPassword, 'Admin', 'ArkaK']
    );

    // Create sample seller
    const sellerPassword = await bcrypt.hash('vendedor123', 12);
    const [sellerResult] = await pool.query(
      `INSERT IGNORE INTO users (email, password, first_name, last_name, phone, role, is_active, is_verified, bio, years_experience)
       VALUES (?, ?, ?, ?, ?, 'vendedor', 1, 1, ?, ?)`,
      ['vendedor@arkak.com', sellerPassword, 'Carlos', 'Mendoza', '+52 555 123 4567',
       'Agente inmobiliario con amplia experiencia en el mercado residencial y comercial. Especializado en propiedades premium.', 8]
    );

    // Create sample client
    const clientPassword = await bcrypt.hash('cliente123', 12);
    await pool.query(
      `INSERT IGNORE INTO users (email, password, first_name, last_name, phone, role, is_active, is_verified)
       VALUES (?, ?, ?, ?, ?, 'cliente', 1, 1)`,
      ['cliente@arkak.com', clientPassword, 'María', 'González', '+52 555 987 6543']
    );

    // Get seller ID
    const [sellers] = await pool.query("SELECT id FROM users WHERE email = 'vendedor@arkak.com'");
    if (!sellers.length) {
      console.log('⚠️  Seller not found, skipping property seeds.');
      process.exit(0);
    }
    const sellerId = sellers[0].id;

    // Create default seller schedule (Mon-Fri 9:00-18:00)
    for (let day = 1; day <= 5; day++) {
      await pool.query(
        `INSERT IGNORE INTO seller_schedules (seller_id, day_of_week, is_active, start_time, end_time, slot_duration)
         VALUES (?, ?, 1, '09:00:00', '18:00:00', 30)`,
        [sellerId, day]
      );
    }

    // Create sample properties
    const sampleProperties = [
      {
        title: 'Casa Moderna en Colinas del Bosque',
        description: 'Hermosa casa moderna con acabados de lujo, amplios espacios y jardín privado. Ubicada en una de las zonas más exclusivas de la ciudad con acceso a parques y centros comerciales.',
        price: 4500000, operation_type: 'venta', property_type: 'casa',
        street: 'Av. de las Colinas 234', neighborhood: 'Colinas del Bosque', city: 'Guadalajara', state: 'Jalisco', zip_code: '44610',
        latitude: 20.6736, longitude: -103.3440,
        total_area: 350, built_area: 280, bedrooms: 4, bathrooms: 3, half_bathrooms: 1,
        parking_spaces: 2, year_built: 2022, has_garden: 1, has_pool: 1, has_security: 1, is_featured: 1,
      },
      {
        title: 'Departamento con Vista Panorámica',
        description: 'Elegante departamento en piso 15 con impresionante vista a la ciudad. Cocina integral, pisos de mármol y amenidades de primer nivel. Ideal para profesionales.',
        price: 18000, operation_type: 'renta', property_type: 'departamento',
        street: 'Blvd. Puerta de Hierro 5000', neighborhood: 'Puerta de Hierro', city: 'Guadalajara', state: 'Jalisco', zip_code: '45116',
        latitude: 20.7050, longitude: -103.3923,
        total_area: 120, built_area: 110, bedrooms: 2, bathrooms: 2, half_bathrooms: 1,
        parking_spaces: 1, year_built: 2020, is_furnished: 1, has_security: 1, is_featured: 1,
      },
      {
        title: 'Terreno en Zona de Plusvalía',
        description: 'Excelente terreno en zona de alta plusvalía con todos los servicios disponibles. Ideal para desarrollo habitacional o comercial. Escrituración inmediata.',
        price: 2800000, operation_type: 'venta', property_type: 'terreno',
        street: 'Carr. a Colotlán km 15', neighborhood: 'La Venta', city: 'Zapopan', state: 'Jalisco', zip_code: '45220',
        latitude: 20.7500, longitude: -103.4000,
        total_area: 500, bedrooms: 0, bathrooms: 0, parking_spaces: 0,
      },
      {
        title: 'Local Comercial en Plaza Premier',
        description: 'Amplio local comercial en plaza de alto tráfico. Ideal para restaurante, boutique o servicios profesionales. Incluye estacionamiento para clientes.',
        price: 35000, operation_type: 'renta', property_type: 'local_comercial',
        street: 'Av. Vallarta 3200', neighborhood: 'Vallarta Poniente', city: 'Guadalajara', state: 'Jalisco', zip_code: '44130',
        latitude: 20.6800, longitude: -103.3750,
        total_area: 200, built_area: 180, bedrooms: 0, bathrooms: 2, parking_spaces: 4,
        year_built: 2019, has_security: 1,
      },
      {
        title: 'Residencia de Lujo en Country Club',
        description: 'Espectacular residencia con alberca infinity, gimnasio privado y sala de cine. Materiales importados y domótica de última generación. Vistas al campo de golf.',
        price: 12000000, operation_type: 'venta', property_type: 'casa',
        street: 'Circuito del Country 78', neighborhood: 'Country Club', city: 'Guadalajara', state: 'Jalisco', zip_code: '44610',
        latitude: 20.6900, longitude: -103.3600,
        total_area: 800, built_area: 600, bedrooms: 6, bathrooms: 5, half_bathrooms: 2,
        parking_spaces: 4, year_built: 2023, has_garden: 1, has_pool: 1, has_storage: 1, has_security: 1, is_furnished: 1, is_featured: 1,
      },
      {
        title: 'Departamento Económico Centro',
        description: 'Cómodo departamento en el centro histórico. Cerca de transporte público, mercados y servicios. Ideal para estudiantes o parejas jóvenes.',
        price: 8500, operation_type: 'renta', property_type: 'departamento',
        street: 'Calle Morelos 456', neighborhood: 'Centro Histórico', city: 'Guadalajara', state: 'Jalisco', zip_code: '44100',
        latitude: 20.6720, longitude: -103.3440,
        total_area: 65, built_area: 60, bedrooms: 1, bathrooms: 1, parking_spaces: 0,
        year_built: 2015,
      },
    ];

    for (const prop of sampleProperties) {
      const columns = Object.keys(prop).join(', ');
      const placeholders = Object.keys(prop).map(() => '?').join(', ');
      await pool.query(
        `INSERT INTO properties (seller_id, ${columns}) VALUES (?, ${placeholders})`,
        [sellerId, ...Object.values(prop)]
      );
    }

    console.log('✅ Seed completed successfully!');
    console.log('\n📋 Test accounts:');
    console.log('   Admin:    admin@arkak.com / admin123');
    console.log('   Vendedor: vendedor@arkak.com / vendedor123');
    console.log('   Cliente:  cliente@arkak.com / cliente123');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();
