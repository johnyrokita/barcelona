import { AuthError, createUserSession, registerUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = (await request.json()) as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      throw new AuthError("Email and password are required", 400);
    }

    const result = await registerUser({ email, password });

    if (result.autoApproved) {
      await createUserSession(result.user.id);
    }

    return Response.json({
      ok: true,
      data: {
        autoApproved: result.autoApproved,
      },
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to register",
      },
      { status },
    );
  }
}
