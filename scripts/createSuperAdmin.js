// scripts/createSuperadmin.js
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

async function createSuperadmin() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'bookdb'
  });

  const saltRounds = 10;
  const password = await bcrypt.hash('admin123', saltRounds);
  
  await connection.query(
    'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
    ['superadmin', 'admin@example.com', password, 'superadmin']
  );

  console.log('Superadmin created!');
  console.log('Email: admin@example.com');
  console.log('Password: admin123');

  await connection.end();
}

createSuperadmin().catch(console.error);
