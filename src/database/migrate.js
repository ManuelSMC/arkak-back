const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function migrate() {
  try {
    // Run main schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    const statements = schema.split(';').filter(s => s.trim().length > 0);

    console.log('🔄 Running ArkaK database migration...');
    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (err) {
        if (!err.message.includes('already exists') && !err.message.includes('Duplicate')) {
          console.warn('⚠️  Statement warning:', err.message.substring(0, 100));
        }
      }
    }

    // Run migration v2
    const v2Path = path.join(__dirname, 'migration_v2.sql');
    if (fs.existsSync(v2Path)) {
      console.log('🔄 Running migration v2...');
      const v2 = fs.readFileSync(v2Path, 'utf-8');
      const v2Statements = v2.split(';').filter(s => s.trim().length > 0);
      for (const statement of v2Statements) {
        try {
          await pool.query(statement);
        } catch (err) {
          if (!err.message.includes('already exists') && !err.message.includes('Duplicate')) {
            console.warn('⚠️  V2 warning:', err.message.substring(0, 100));
          }
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
