import {
  AuthError,
  requireApiUser,
} from "@/lib/auth";
import {
  ProjectProvisioningError,
  buildProjectConnectionStrings,
  normalizeProjectSlug,
} from "@/lib/pg";
import { getManagedProjectBySlug } from "@/lib/sqlite";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      slug: string;
    }>;
  },
) {
  try {
    await requireApiUser();
    const { slug: slugParam } = await context.params;
    const slug = normalizeProjectSlug(slugParam);
    const project = getManagedProjectBySlug(slug);

    if (!project) {
      return Response.json(
        {
          ok: false,
          error: "Managed project not found",
        },
        { status: 404 },
      );
    }

    return Response.json({
      ok: true,
      data: {
        slug: project.slug,
        databaseName: project.databaseName,
        roleName: project.roleName,
        password: project.passwordPlaintext,
        ...buildProjectConnectionStrings({
          databaseName: project.databaseName,
          roleName: project.roleName,
          password: project.passwordPlaintext,
        }),
        createdAt: project.createdAt,
      },
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
          error instanceof Error
            ? error.message
            : "Failed to load project credentials",
      },
      { status },
    );
  }
}
