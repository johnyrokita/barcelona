import { stat } from "fs/promises";

import { AuthError, requireApiUser } from "@/lib/auth";
import {
  BackupFileError,
  deleteBackupFile,
  readBackupFile,
} from "@/lib/backups";

export async function GET(request: Request) {
  try {
    await requireApiUser();

    const url = new URL(request.url);
    const fileName = url.searchParams.get("file") ?? "";
    const backup = await readBackupFile(fileName);
    const fileStats = await stat(backup.filePath);

    if (!fileStats.isFile()) {
      throw new BackupFileError("Backup file not found", 404);
    }

    return new Response(backup.fileBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(fileStats.size),
        "Content-Disposition": `attachment; filename="${backup.fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const status =
      error instanceof AuthError || error instanceof BackupFileError
        ? error.status
        : 500;

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to download backup",
      },
      { status },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await requireApiUser();

    const url = new URL(request.url);
    const fileName = url.searchParams.get("file") ?? "";
    const backup = await deleteBackupFile(fileName);

    return Response.json({
      ok: true,
      data: {
        fileName: backup.fileName,
      },
    });
  } catch (error) {
    const status =
      error instanceof AuthError || error instanceof BackupFileError
        ? error.status
        : 500;

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete backup",
      },
      { status },
    );
  }
}
