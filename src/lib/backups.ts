import { readdir, readFile, rm, stat } from "fs/promises";
import path from "path";

import type { BackupEntry } from "@/lib/database-types";

const backupsDir = path.join(process.cwd(), "backups");

export class BackupFileError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "BackupFileError";
    this.status = status;
  }
}

export async function listBackupsForDatabase(
  databaseName: string,
): Promise<BackupEntry[]> {
  const prefix = `${databaseName}-`;

  try {
    const entries = await readdir(backupsDir, {
      withFileTypes: true,
      recursive: false,
    });

    const backups = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.startsWith(prefix))
        .map(async (entry) => {
          const filePath = path.join(backupsDir, entry.name);
          const stats = await stat(filePath);

          return {
            fileName: entry.name,
            filePath,
            sizeBytes: stats.size,
            createdAt: stats.mtime.toISOString(),
          } satisfies BackupEntry;
        }),
    );

    return backups.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  } catch {
    return [];
  }
}

export async function readBackupFile(fileName: string) {
  const filePath = resolveBackupFilePath(fileName);
  const fileBuffer = await readFile(filePath);

  return {
    fileName,
    filePath,
    fileBuffer,
  };
}

export async function deleteBackupFile(fileName: string) {
  const filePath = resolveBackupFilePath(fileName);
  await rm(filePath);

  return {
    fileName,
    filePath,
  };
}

function resolveBackupFilePath(fileName: string) {
  const trimmedFileName = fileName.trim();

  if (!trimmedFileName) {
    throw new BackupFileError("Backup file name is required", 400);
  }

  if (path.basename(trimmedFileName) !== trimmedFileName) {
    throw new BackupFileError("Invalid backup file name", 400);
  }

  if (trimmedFileName.includes(path.sep) || trimmedFileName.includes("/")) {
    throw new BackupFileError("Invalid backup file name", 400);
  }

  const filePath = path.resolve(backupsDir, trimmedFileName);
  const relativePath = path.relative(backupsDir, filePath);

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new BackupFileError("Invalid backup file path", 400);
  }

  return filePath;
}
