import { listDatabases } from "@/lib/pg";
import { spawn } from "child_process";
import { mkdir } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  const { name } = await request.json();

  if (!name) {
    return Response.json(
      {
        ok: false,
        error: "Database name is required",
      },
      { status: 400 },
    );
  }

  const existingDatabases = await listDatabases();

  if (!existingDatabases.includes(name)) {
    return Response.json(
      {
        ok: false,
        error: "Database not found",
      },
      { status: 404 },
    );
  }

  const postgresUrl = process.env.DATABASE_URL!;
  const databaseUrl = new URL(postgresUrl);
  databaseUrl.pathname = `/${name}`;

  const backupDir = path.join(process.cwd(), "backups");
  const safeTimestamp = new Date().toISOString().replaceAll(":", "-");
  const backupName = path.join(backupDir, `${name}-${safeTimestamp}.sql`);

  const dumpArgs = [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    `--dbname=${databaseUrl.toString()}`,
    `--file=${backupName}`,
  ];

  try {
    await mkdir(backupDir, { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const dumpProcess = spawn("pg_dump", dumpArgs, {
        env: {
          ...process.env,
          PGPASSWORD: process.env.PG_PASSWORD,
        },
      });

      let stderr = "";

      dumpProcess.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      dumpProcess.on("error", reject);
      dumpProcess.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(stderr.trim() || `pg_dump exited with code ${code}`));
      });
    });

    return Response.json({
      ok: true,
      message: `Database ${name} backed up successfully`,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: `Failed to back up database ${name}: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    );
  }
}
