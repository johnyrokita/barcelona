import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import path from "path";

import type { AuthUser, ManagedProject } from "@/lib/database-types";
import { decryptManagedSecret, encryptManagedSecret } from "@/lib/secrets";

const dataDir = path.join(process.cwd(), "data");
const sqlitePath = path.join(dataDir, "barcelona.sqlite");

let sqlite: Database.Database | null = null;

function getSqlite() {
  if (sqlite) {
    return sqlite;
  }

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  sqlite = new Database(sqlitePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      slug TEXT PRIMARY KEY,
      database_name TEXT NOT NULL UNIQUE,
      role_name TEXT NOT NULL UNIQUE,
      password_plaintext TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_approved INTEGER NOT NULL DEFAULT 0,
      two_factor_enabled INTEGER NOT NULL DEFAULT 0,
      totp_secret TEXT,
      two_factor_confirmed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      approved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  ensureColumn(sqlite, "users", "two_factor_enabled", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(sqlite, "users", "totp_secret", "TEXT");
  ensureColumn(sqlite, "users", "two_factor_confirmed_at", "TEXT");

  return sqlite;
}

function ensureColumn(
  db: Database.Database,
  tableName: string,
  columnName: string,
  definition: string,
) {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName});`)
    .all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

function mapUser(row: {
  id: number;
  email: string;
  is_admin: number;
  is_approved: number;
  two_factor_enabled: number;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
}): AuthUser {
  return {
    id: row.id,
    email: row.email,
    isAdmin: row.is_admin === 1,
    isApproved: row.is_approved === 1,
    twoFactorEnabled: row.two_factor_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
  };
}

function mapProject(row: {
  slug: string;
  database_name: string;
  role_name: string;
  password_plaintext: string;
  created_at: string;
  updated_at: string;
}): ManagedProject {
  return {
    slug: row.slug,
    databaseName: row.database_name,
    roleName: row.role_name,
    passwordPlaintext: decryptManagedSecret(row.password_plaintext),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listManagedProjects(): ManagedProject[] {
  const db = getSqlite();
  const rows = db
    .prepare(
      `
        SELECT slug, database_name, role_name, password_plaintext, created_at, updated_at
        FROM projects
        ORDER BY created_at DESC;
      `,
    )
    .all() as Array<{
      slug: string;
      database_name: string;
      role_name: string;
      password_plaintext: string;
      created_at: string;
      updated_at: string;
    }>;

  return rows.map(mapProject);
}

export function getManagedProjectBySlug(slug: string): ManagedProject | null {
  const db = getSqlite();
  const row = db
    .prepare(
      `
        SELECT slug, database_name, role_name, password_plaintext, created_at, updated_at
        FROM projects
        WHERE slug = ?;
      `,
    )
    .get(slug) as
    | {
        slug: string;
        database_name: string;
        role_name: string;
        password_plaintext: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  return row ? mapProject(row) : null;
}

export function getManagedProjectByDatabaseName(
  databaseName: string,
): ManagedProject | null {
  const db = getSqlite();
  const row = db
    .prepare(
      `
        SELECT slug, database_name, role_name, password_plaintext, created_at, updated_at
        FROM projects
        WHERE database_name = ?;
      `,
    )
    .get(databaseName) as
    | {
        slug: string;
        database_name: string;
        role_name: string;
        password_plaintext: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  return row ? mapProject(row) : null;
}

export function createManagedProject(input: {
  slug: string;
  databaseName: string;
  roleName: string;
  passwordPlaintext: string;
}): ManagedProject {
  const db = getSqlite();
  const now = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO projects (
        slug,
        database_name,
        role_name,
        password_plaintext,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?);
    `,
  ).run(
    input.slug,
    input.databaseName,
    input.roleName,
    encryptManagedSecret(input.passwordPlaintext),
    now,
    now,
  );

  return {
    slug: input.slug,
    databaseName: input.databaseName,
    roleName: input.roleName,
    passwordPlaintext: input.passwordPlaintext,
    createdAt: now,
    updatedAt: now,
  };
}

export function countUsers() {
  const db = getSqlite();
  const row = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM users;
      `,
    )
    .get() as { count: number };

  return row.count;
}

export function getUserByEmail(email: string): (AuthUser & {
  passwordHash: string;
  totpSecret: string | null;
}) | null {
  const db = getSqlite();
  const row = db
    .prepare(
      `
        SELECT
          id,
          email,
          password_hash,
          is_admin,
          is_approved,
          two_factor_enabled,
          totp_secret,
          created_at,
          updated_at,
          approved_at
        FROM users
        WHERE email = ?;
      `,
    )
    .get(email) as
    | {
        id: number;
        email: string;
        password_hash: string;
        is_admin: number;
        is_approved: number;
        two_factor_enabled: number;
        totp_secret: string | null;
        created_at: string;
        updated_at: string;
        approved_at: string | null;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    ...mapUser(row),
    passwordHash: row.password_hash,
    totpSecret: row.totp_secret,
  };
}

export function getUserById(id: number): AuthUser | null {
  const db = getSqlite();
  const row = db
    .prepare(
      `
        SELECT id, email, is_admin, is_approved, two_factor_enabled, created_at, updated_at, approved_at
        FROM users
        WHERE id = ?;
      `,
    )
    .get(id) as
    | {
        id: number;
        email: string;
        is_admin: number;
        is_approved: number;
        two_factor_enabled: number;
        created_at: string;
        updated_at: string;
        approved_at: string | null;
      }
    | undefined;

  return row ? mapUser(row) : null;
}

export function createUser(input: {
  email: string;
  passwordHash: string;
  isAdmin: boolean;
  isApproved: boolean;
}): AuthUser {
  const db = getSqlite();
  const now = new Date().toISOString();
  const approvedAt = input.isApproved ? now : null;
  const result = db
    .prepare(
      `
        INSERT INTO users (
          email,
          password_hash,
          is_admin,
          is_approved,
          two_factor_enabled,
          created_at,
          updated_at,
          approved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `,
    )
    .run(
      input.email,
      input.passwordHash,
      input.isAdmin ? 1 : 0,
      input.isApproved ? 1 : 0,
      0,
      now,
      now,
      approvedAt,
    );

  return {
    id: Number(result.lastInsertRowid),
    email: input.email,
    isAdmin: input.isAdmin,
    isApproved: input.isApproved,
    twoFactorEnabled: false,
    createdAt: now,
    updatedAt: now,
    approvedAt,
  };
}

export function listPendingUsers(): AuthUser[] {
  const db = getSqlite();
  const rows = db
    .prepare(
      `
        SELECT id, email, is_admin, is_approved, two_factor_enabled, created_at, updated_at, approved_at
        FROM users
        WHERE is_approved = 0
        ORDER BY created_at ASC;
      `,
    )
    .all() as Array<{
      id: number;
      email: string;
      is_admin: number;
      is_approved: number;
      two_factor_enabled: number;
      created_at: string;
      updated_at: string;
      approved_at: string | null;
    }>;

  return rows.map(mapUser);
}

export function approveUser(userId: number): AuthUser | null {
  const db = getSqlite();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `
        UPDATE users
        SET is_approved = 1, updated_at = ?, approved_at = ?
        WHERE id = ?;
      `,
    )
    .run(now, now, userId);

  if (result.changes === 0) {
    return null;
  }

  return getUserById(userId);
}

export function deletePendingUser(userId: number) {
  const db = getSqlite();
  const result = db
    .prepare(
      `
        DELETE FROM users
        WHERE id = ?
          AND is_approved = 0;
      `,
    )
    .run(userId);

  return result.changes > 0;
}

export function createSession(input: {
  tokenHash: string;
  userId: number;
  expiresAt: string;
}) {
  const db = getSqlite();
  db.prepare(
    `
      INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?);
    `,
  ).run(
    input.tokenHash,
    input.userId,
    input.expiresAt,
    new Date().toISOString(),
  );
}

export function getSessionUserByTokenHash(tokenHash: string): AuthUser | null {
  const db = getSqlite();
  const row = db
    .prepare(
      `
        SELECT
          u.id,
          u.email,
          u.is_admin,
          u.is_approved,
          u.two_factor_enabled,
          u.created_at,
          u.updated_at,
          u.approved_at
        FROM sessions s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?
          AND s.expires_at > ?;
      `,
    )
    .get(tokenHash, new Date().toISOString()) as
    | {
        id: number;
        email: string;
        is_admin: number;
        is_approved: number;
        two_factor_enabled: number;
        created_at: string;
        updated_at: string;
        approved_at: string | null;
      }
    | undefined;

  return row ? mapUser(row) : null;
}

export function getUserWithTotpById(id: number): (AuthUser & {
  totpSecret: string | null;
  twoFactorConfirmedAt: string | null;
}) | null {
  const db = getSqlite();
  const row = db
    .prepare(
      `
        SELECT
          id,
          email,
          is_admin,
          is_approved,
          two_factor_enabled,
          totp_secret,
          two_factor_confirmed_at,
          created_at,
          updated_at,
          approved_at
        FROM users
        WHERE id = ?;
      `,
    )
    .get(id) as
    | {
        id: number;
        email: string;
        is_admin: number;
        is_approved: number;
        two_factor_enabled: number;
        totp_secret: string | null;
        two_factor_confirmed_at: string | null;
        created_at: string;
        updated_at: string;
        approved_at: string | null;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    ...mapUser(row),
    totpSecret: row.totp_secret,
    twoFactorConfirmedAt: row.two_factor_confirmed_at,
  };
}

export function setUserTotpSecret(userId: number, secret: string) {
  const db = getSqlite();
  db.prepare(
    `
      UPDATE users
      SET totp_secret = ?, two_factor_enabled = 0, two_factor_confirmed_at = NULL, updated_at = ?
      WHERE id = ?;
    `,
  ).run(secret, new Date().toISOString(), userId);
}

export function enableUserTwoFactor(userId: number) {
  const db = getSqlite();
  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE users
      SET two_factor_enabled = 1, two_factor_confirmed_at = ?, updated_at = ?
      WHERE id = ?;
    `,
  ).run(now, now, userId);
}

export function disableUserTwoFactor(userId: number) {
  const db = getSqlite();
  db.prepare(
    `
      UPDATE users
      SET two_factor_enabled = 0, totp_secret = NULL, two_factor_confirmed_at = NULL, updated_at = ?
      WHERE id = ?;
    `,
  ).run(new Date().toISOString(), userId);
}

export function deleteSession(tokenHash: string) {
  const db = getSqlite();
  db.prepare(
    `
      DELETE FROM sessions
      WHERE token_hash = ?;
    `,
  ).run(tokenHash);
}

export function deleteExpiredSessions() {
  const db = getSqlite();
  db.prepare(
    `
      DELETE FROM sessions
      WHERE expires_at <= ?;
    `,
  ).run(new Date().toISOString());
}
