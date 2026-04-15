import { AuthError, confirmTwoFactorSetup, requireApiUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const { token } = (await request.json()) as { token?: string };

    if (!token) {
      throw new AuthError("Verification code is required", 400);
    }

    confirmTwoFactorSetup(user.id, token);

    return Response.json({
      ok: true,
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to enable 2FA",
      },
      { status },
    );
  }
}
