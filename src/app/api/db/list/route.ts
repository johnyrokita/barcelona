import { AuthError, requireApiUser } from "@/lib/auth";
import { listDatabases } from "@/lib/pg";

export async function GET() {
  try {
    await requireApiUser();
    const databases = await listDatabases();

    return Response.json({
      ok: true,
      data: databases,
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to load databases",
      },
      { status },
    );
  }
}
