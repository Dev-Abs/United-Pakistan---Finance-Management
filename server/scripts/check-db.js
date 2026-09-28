require('dotenv').config();
const db = require('../services/db');

async function main() {
  const result = await db.query(`
    select
      current_database() as database_name,
      current_user as database_user,
      current_setting('server_version') as server_version
  `);
  const connection = result.rows[0];
  console.log(`Connected to ${connection.database_name} as ${connection.database_user} (Postgres ${connection.server_version})`);
}

main()
  .catch((error) => {
    console.error(`Database connection failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.closePool());
