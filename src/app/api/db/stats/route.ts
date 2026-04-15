import { AuthError, requireApiUser } from "@/lib/auth";
import { getDatabaseStats } from "@/lib/pg";

export async function GET() {
  try {
    await requireApiUser();
    const stats = await getDatabaseStats();

    return Response.json({
      ok: true,
      data: stats,
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load PostgreSQL stats",
      },
      { status },
    );
  }
}
