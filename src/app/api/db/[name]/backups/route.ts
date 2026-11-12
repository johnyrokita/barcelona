import { AuthError, requireApiUser } from "@/lib/auth";
import { listDatabases, ProjectProvisioningError } from "@/lib/pg";
import { listBackupsForDatabase } from "@/lib/backups";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      name: string;
    }>;
  },
) {
  try {
    await requireApiUser();
    const { name } = await context.params;
    const databaseName = name;
    const databases = await listDatabases();

    if (!databases.includes(databaseName)) {
      return Response.json(
        {
          ok: false,
          error: "Database not found",
        },
        { status: 404 },
      );
    }

    const backups = await listBackupsForDatabase(databaseName);

    return Response.json({
      ok: true,
      data: backups,
    });
  } catch (error) {
    const status =
      error instanceof AuthError || error instanceof ProjectProvisioningError
        ? error.status
        : 500;

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to load backups",
      },
      { status },
    );
  }
}
