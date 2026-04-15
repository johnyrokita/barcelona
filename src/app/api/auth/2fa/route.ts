import { AuthError, requireApiUser, turnOffTwoFactor } from "@/lib/auth";

export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    const { password } = (await request.json()) as { password?: string };

    if (!password) {
      throw new AuthError("Password is required", 400);
    }

    await turnOffTwoFactor(user.id, password);

    return Response.json({
      ok: true,
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to disable 2FA",
      },
      { status },
    );
  }
}
