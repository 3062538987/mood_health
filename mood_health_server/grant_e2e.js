const mysql = require('mysql2/promise');

(async () => {
  const pool = await mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'Jyf350721$',
  });

  try {
    await pool.query("GRANT ALL PRIVILEGES ON mood_health_e2e.* TO 'mood_app'@'%'");
    await pool.query('FLUSH PRIVILEGES');
    console.log('Privileges granted to mood_app on mood_health_e2e.');
  } finally {
    await pool.end();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});