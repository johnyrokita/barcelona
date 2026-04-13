import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function listDatabases() {
  const result = await pool.query(`
    SELECT datname
    FROM pg_database
    WHERE datistemplate = false
    ORDER BY datname;
  `);

  if (result.rowCount === 0) {
    return [];
  }

  return result.rows.map((db) => db.datname);
}
