import crypto from "crypto";
import { Client, Pool } from "pg";

import type { DatabaseRow, DatabaseStats } from "@/lib/database-types";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const reservedNames = new Set(["postgres", "template0", "template1"]);

export class ProjectProvisioningError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ProjectProvisioningError";
    this.status = status;
  }
}

export async function listDatabases() {
  const result = await pool.query<{
    datname: string;
  }>(`
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

export async function listDatabaseRows(): Promise<
  Array<Omit<DatabaseRow, "isManaged" | "managedSlug" | "createdAt">>
> {
  const result = await pool.query<{
    name: string;
    owner: string;
    size_bytes: string;
    active_connections: string;
  }>(`
    SELECT
      d.datname AS name,
      pg_catalog.pg_get_userbyid(d.datdba) AS owner,
      pg_database_size(d.datname)::text AS size_bytes,
      COUNT(a.pid)::text AS active_connections
    FROM pg_database d
    LEFT JOIN pg_stat_activity a
      ON a.datname = d.datname
      AND a.pid <> pg_backend_pid()
    WHERE d.datistemplate = false
    GROUP BY d.datname, d.datdba
    ORDER BY d.datname;
  `);

  return result.rows.map((row) => ({
    name: row.name,
    owner: row.owner,
    sizeBytes: Number(row.size_bytes),
    activeConnections: Number(row.active_connections),
  }));
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  const [databaseCountResult, totalSizeResult, activeConnectionsResult, versionResult] =
    await Promise.all([
      pool.query<{
        count: string;
      }>(`
        SELECT COUNT(*)::text AS count
        FROM pg_database
        WHERE datistemplate = false;
      `),
      pool.query<{
        total_size_bytes: string;
      }>(`
        SELECT COALESCE(SUM(pg_database_size(datname)), 0)::text AS total_size_bytes
        FROM pg_database
        WHERE datistemplate = false;
      `),
      pool.query<{
        active_connections: string;
      }>(`
        SELECT COUNT(*)::text AS active_connections
        FROM pg_stat_activity
        WHERE datname IS NOT NULL;
      `),
      pool.query<{
        version: string;
      }>(`
        SELECT current_setting('server_version') AS version;
      `),
    ]);

  return {
    databaseCount: Number(databaseCountResult.rows[0]?.count ?? 0),
    totalSizeBytes: Number(totalSizeResult.rows[0]?.total_size_bytes ?? 0),
    activeConnections: Number(
      activeConnectionsResult.rows[0]?.active_connections ?? 0,
    ),
    postgresVersion: versionResult.rows[0]?.version ?? "unknown",
  };
}

export function normalizeProjectSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  if (!slug) {
    throw new ProjectProvisioningError("Project slug is required");
  }

  if (!/^[a-z][a-z0-9_]{1,62}$/.test(slug)) {
    throw new ProjectProvisioningError(
      "Project slug must start with a letter and contain only lowercase letters, numbers, and underscores",
    );
  }

  if (reservedNames.has(slug) || slug.startsWith("pg_")) {
    throw new ProjectProvisioningError("Project slug is reserved");
  }

  return slug;
}

export async function provisionProject(slugInput: string) {
  const slug = normalizeProjectSlug(slugInput);
  const password = generatePassword();
  const databaseName = slug;
  const roleName = slug;

  const controlUrl = getRequiredDatabaseUrl();
  const controlClient = await pool.connect();

  let databaseCreated = false;
  let roleCreated = false;

  const connectionStrings = buildProjectConnectionStrings({
    databaseName,
    roleName,
    password,
  });

  try {
    const [databaseExists, roleExists] = await Promise.all([
      databaseOrRoleExists(
        controlClient,
        "SELECT 1 FROM pg_database WHERE datname = $1 LIMIT 1;",
        databaseName,
      ),
      databaseOrRoleExists(
        controlClient,
        "SELECT 1 FROM pg_roles WHERE rolname = $1 LIMIT 1;",
        roleName,
      ),
    ]);

    if (databaseExists || roleExists) {
      throw new ProjectProvisioningError(
        "A database or role with that slug already exists",
        409,
      );
    }

    await controlClient.query(
      `CREATE ROLE ${quoteIdentifier(roleName)} WITH LOGIN PASSWORD ${quoteLiteral(password)};`,
    );
    roleCreated = true;

    await controlClient.query(
      `CREATE DATABASE ${quoteIdentifier(databaseName)} OWNER ${quoteIdentifier(roleName)};`,
    );
    databaseCreated = true;

    await controlClient.query(
      `GRANT ALL PRIVILEGES ON DATABASE ${quoteIdentifier(databaseName)} TO ${quoteIdentifier(roleName)};`,
    );

    const schemaClient = new Client({
      connectionString: buildConnectionString({
        baseUrl: controlUrl,
        databaseName,
      }),
    });

    try {
      await schemaClient.connect();
      await schemaClient.query(
        `GRANT ALL ON SCHEMA public TO ${quoteIdentifier(roleName)};`,
      );
      await schemaClient.query(
        `ALTER SCHEMA public OWNER TO ${quoteIdentifier(roleName)};`,
      );
    } finally {
      await schemaClient.end().catch(() => undefined);
    }

    return {
      slug,
      databaseName,
      roleName,
      password,
      ...connectionStrings,
    };
  } catch (error) {
    if (databaseCreated || roleCreated) {
      await rollbackProvisioning(controlClient, {
        databaseCreated,
        databaseName,
        roleCreated,
        roleName,
      });
    }

    throw error;
  } finally {
    controlClient.release();
  }
}

export async function cleanupProvisionedProject(input: {
  databaseName: string;
  roleName: string;
}) {
  const controlClient = await pool.connect();

  try {
    await rollbackProvisioning(controlClient, {
      databaseCreated: true,
      databaseName: input.databaseName,
      roleCreated: true,
      roleName: input.roleName,
    });
  } finally {
    controlClient.release();
  }
}

export function buildConnectionString(input: {
  baseUrl?: string;
  databaseName: string;
  roleName?: string;
  password?: string;
  target?: "postgres" | "pgbouncer";
}) {
  const url = new URL(input.baseUrl ?? getRequiredDatabaseUrl());
  const connectionTarget = getConnectionTarget(input.target);

  if (connectionTarget) {
    url.hostname = connectionTarget.hostname;
    url.port = connectionTarget.port;
  }

  url.pathname = `/${input.databaseName}`;

  if (input.roleName) {
    url.username = input.roleName;
  }

  if (input.password) {
    url.password = input.password;
  }

  return url.toString();
}

export function buildProjectConnectionStrings(input: {
  databaseName: string;
  roleName: string;
  password: string;
}) {
  const pgbouncerTarget = getConnectionTarget("pgbouncer");

  return {
    postgresConnectionString: buildConnectionString({
      databaseName: input.databaseName,
      roleName: input.roleName,
      password: input.password,
      target: "postgres",
    }),
    pgbouncerConnectionString: pgbouncerTarget
      ? buildConnectionString({
          databaseName: input.databaseName,
          roleName: input.roleName,
          password: input.password,
          target: "pgbouncer",
        })
      : undefined,
  };
}

async function databaseOrRoleExists(
  client: {
    query: (
      text: string,
      values?: unknown[],
    ) => Promise<{ rowCount: number | null }>;
  },
  query: string,
  value: string,
) {
  const result = await client.query(query, [value]);
  return (result.rowCount ?? 0) > 0;
}

async function rollbackProvisioning(
  client: {
    query: (text: string, values?: unknown[]) => Promise<unknown>;
  },
  input: {
    databaseCreated: boolean;
    databaseName: string;
    roleCreated: boolean;
    roleName: string;
  },
) {
  try {
    if (input.databaseCreated) {
      await client.query(
        `
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = $1 AND pid <> pg_backend_pid();
        `,
        [input.databaseName],
      );
      await client.query(
        `DROP DATABASE IF EXISTS ${quoteIdentifier(input.databaseName)};`,
      );
    }
  } catch {
    // Keep rollback best-effort so we can still try the role cleanup.
  }

  try {
    if (input.roleCreated) {
      await client.query(
        `DROP ROLE IF EXISTS ${quoteIdentifier(input.roleName)};`,
      );
    }
  } catch {
    // Keep rollback best-effort.
  }
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string) {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}

function generatePassword() {
  return crypto.randomBytes(24).toString("base64url");
}

function getRequiredDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new ProjectProvisioningError("DATABASE_URL is not configured", 500);
  }

  return databaseUrl;
}

function getConnectionTarget(target: "postgres" | "pgbouncer" | undefined) {
  if (!target) {
    return null;
  }

  const rawValue =
    target === "pgbouncer"
      ? process.env.PGBOUNCER_CONNECTION_HOST
      : process.env.POSTGRES_CONNECTION_HOST;

  if (!rawValue) {
    return null;
  }

  const [hostname, port = ""] = rawValue.trim().split(":");

  if (!hostname) {
    return null;
  }

  return {
    hostname,
    port,
  };
}
