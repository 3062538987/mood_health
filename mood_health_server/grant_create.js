const mysql = require('mysql2/promise');

(async () => {
  const pool = await mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'Jyf350721$',
  });

  try {
    await pool.query("GRANT CREATE ON *.* TO 'mood_app'@'%'");
    await pool.query('FLUSH PRIVILEGES');
    console.log('CREATE privilege granted to mood_app.');
  } finally {
    await pool.end();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});