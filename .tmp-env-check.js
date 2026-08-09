const fs = require('fs')
const out = {
  MYSQL_PORT: process.env.MYSQL_PORT,
  E2E_MYSQL_PORT: process.env.E2E_MYSQL_PORT,
  MYSQL_DATABASE: process.env.MYSQL_DATABASE,
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
}
fs.writeFileSync('.tmp-env-check-output.json', JSON.stringify(out, null, 2))
console.log(JSON.stringify(out))
// keep running briefly
setTimeout(() => {}, 3000)
