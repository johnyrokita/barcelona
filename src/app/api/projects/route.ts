import type { DatabaseRow } from "@/lib/database-types";
import { AuthError, requireApiUser } from "@/lib/auth";
import {
  ProjectProvisioningError,
  cleanupProvisionedProject,
  listDatabaseRows,
  provisionProject,
} from "@/lib/pg";
import { createManagedProject, listManagedProjects } from "@/lib/sqlite";

export async function GET() {
  try {
    await requireApiUser();
    const [databases, managedProjects] = await Promise.all([
      listDatabaseRows(),
      Promise.resolve(listManagedProjects()),
    ]);

    const managedByDatabase = new Map(
      managedProjects.map((project) => [project.databaseName, project]),
    );

    const rows: DatabaseRow[] = databases.map((database) => {
      const managedProject = managedByDatabase.get(database.name);

      return {
        ...database,
        isManaged: Boolean(managedProject),
        managedSlug: managedProject?.slug,
        createdAt: managedProject?.createdAt,
      };
    });

    return Response.json({
      ok: true,
      data: rows,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load projects",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const { slug } = (await request.json()) as {
      slug?: string;
    };

    if (!slug) {
      throw new ProjectProvisioningError("Project slug is required");
    }

    const project = await provisionProject(slug);

    try {
      createManagedProject({
        slug: project.slug,
        databaseName: project.databaseName,
        roleName: project.roleName,
        passwordPlaintext: project.password,
      });
    } catch (error) {
      await cleanupProvisionedProject({
        databaseName: project.databaseName,
        roleName: project.roleName,
      });

      throw new ProjectProvisioningError(
        error instanceof Error
          ? `Provisioning succeeded but metadata storage failed: ${error.message}`
          : "Provisioning succeeded but metadata storage failed",
        500,
      );
    }

    return Response.json({
      ok: true,
      data: project,
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
            : "Failed to create project",
      },
      { status },
    );
  }
}
