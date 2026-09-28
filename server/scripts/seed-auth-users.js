require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('../services/db');
const { validateNewPassword } = require('../services/auth');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function insertUserIfMissing(client, { email, password, role, sectorId, createdBy }) {
  const existing = await client.query(
    'select id, sector_id, role from users where lower(btrim(email))=lower(btrim($1))',
    [email],
  );
  if (existing.rowCount) {
    const user = existing.rows[0];
    if (user.role !== role || (user.sector_id == null ? null : Number(user.sector_id)) !== sectorId) {
      throw new Error(`Existing user has incompatible role or sector: ${email}`);
    }
    if (String(process.env.SEED_AUTH_RESET_PASSWORDS || '').toLowerCase() === 'true') {
      validateNewPassword(password);
      const hash = await bcrypt.hash(password, 12);
      await client.query(
        'update users set password_hash=$1, must_change_password=true where id=$2',
        [hash, user.id],
      );
      return { id: user.id, inserted: false, passwordReset: true };
    }
    return { id: user.id, inserted: false, passwordReset: false };
  }
  validateNewPassword(password);
  const hash = await bcrypt.hash(password, 12);
  const result = await client.query(`
    insert into users (sector_id, email, password_hash, role, must_change_password, created_by)
    values ($1,$2,$3,$4,true,$5)
    returning id
  `, [sectorId, email, hash, role, createdBy || null]);
  return { id: result.rows[0].id, inserted: true };
}

async function main() {
  const superAdminEmail = required('SUPER_ADMIN_EMAIL');
  const superAdminPassword = required('SUPER_ADMIN_PASSWORD');
  const secretaryEmail = required('SEED_SECRETARY_EMAIL');
  const secretaryPassword = required('SEED_SECRETARY_PASSWORD');
  const sectorSlug = String(process.env.SEED_SECTOR_SLUG || 'united-pakistan').trim();

  const result = await db.withTransaction(async (client) => {
    const sectorResult = await client.query('select id from sectors where slug=$1 and active=true', [sectorSlug]);
    if (sectorResult.rowCount !== 1) throw new Error(`Active seed sector not found: ${sectorSlug}`);
    const sectorId = Number(sectorResult.rows[0].id);
    const superAdmin = await insertUserIfMissing(client, {
      email: superAdminEmail, password: superAdminPassword, role: 'super_admin', sectorId: null,
    });
    const secretary = await insertUserIfMissing(client, {
      email: secretaryEmail, password: secretaryPassword, role: 'secretary', sectorId, createdBy: superAdmin.id,
    });
    await client.query('update sectors set created_by=coalesce(created_by,$1) where id=$2', [superAdmin.id, sectorId]);
    return { sectorId, superAdminInserted: superAdmin.inserted, secretaryInserted: secretary.inserted };
  });
  console.log(JSON.stringify({ seeded: true, ...result }));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Auth seed failed: ${error.message}`);
    process.exitCode = 1;
  }).finally(() => db.closePool());
}

module.exports = { insertUserIfMissing };
