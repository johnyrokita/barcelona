import { AuthError, getTwoFactorSetup, requireApiUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireApiUser();
    const setup = await getTwoFactorSetup(user.id);

    return Response.json({
      ok: true,
      data: setup,
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to prepare two-factor setup",
      },
      { status },
    );
  }
}
