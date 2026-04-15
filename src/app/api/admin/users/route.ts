import { AuthError, listPendingApprovalUsers, requireApiUser } from "@/lib/auth";

export async function GET() {
  try {
    await requireApiUser({ admin: true });

    return Response.json({
      ok: true,
      data: listPendingApprovalUsers(),
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to load pending users",
      },
      { status },
    );
  }
}
