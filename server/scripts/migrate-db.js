require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const db = require('../services/db');

const migrationsDirectory = path.join(__dirname, '../../db/migrations');

async function main() {
  const files = (await fs.readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  await db.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  for (const filename of files) {
    const alreadyApplied = await db.query(
      'select 1 from schema_migrations where filename = $1',
      [filename],
    );
    if (alreadyApplied.rowCount) {
      console.log(`Skipped ${filename} (already applied)`);
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDirectory, filename), 'utf8');
    await db.withTransaction(async (client) => {
      await client.query(sql);
      await client.query(
        'insert into schema_migrations (filename) values ($1)',
        [filename],
      );
    });
    console.log(`Applied ${filename}`);
  }
}

main()
  .catch((error) => {
    console.error(`Database migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.closePool());
