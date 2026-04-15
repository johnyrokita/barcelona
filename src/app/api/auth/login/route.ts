import { loginUser, createUserSession, AuthError } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password, totpCode } = (await request.json()) as {
      email?: string;
      password?: string;
      totpCode?: string;
    };

    if (!email || !password) {
      throw new AuthError("Email and password are required", 400);
    }

    const user = await loginUser({ email, password, totpCode });
    await createUserSession(user.id);

    return Response.json({
      ok: true,
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to sign in",
        requiresTwoFactor:
          error instanceof AuthError ? error.requiresTwoFactor : false,
      },
      { status },
    );
  }
}
