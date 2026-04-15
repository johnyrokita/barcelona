import { AuthError, removePendingUser, requireApiUser } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    await requireApiUser({ admin: true });
    const { id } = await context.params;
    const userId = Number(id);

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AuthError("Invalid user id", 400);
    }

    removePendingUser(userId);

    return Response.json({
      ok: true,
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to remove user",
      },
      { status },
    );
  }
}
