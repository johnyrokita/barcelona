import { Container } from "@/components/container";
import { notFound } from "next/navigation";

import { requirePageUser } from "@/lib/auth";
import { listBackupsForDatabase } from "@/lib/backups";
import { buildProjectConnectionStrings, listDatabaseRows } from "@/lib/pg";
import { getManagedProjectByDatabaseName } from "@/lib/sqlite";
import { DatabaseDetail } from "./database-detail";

export default async function Page({
  params,
}: {
  params: Promise<{
    name: string;
  }>;
}) {
  await requirePageUser();

  const { name } = await params;
  const [databases, backups] = await Promise.all([
    listDatabaseRows(),
    listBackupsForDatabase(name),
  ]);

  const database = databases.find((entry) => entry.name === name);

  if (!database) {
    notFound();
  }

  const managedProject = getManagedProjectByDatabaseName(name);
  const credentials = managedProject
      ? {
          slug: managedProject.slug,
          databaseName: managedProject.databaseName,
          roleName: managedProject.roleName,
          password: managedProject.passwordPlaintext,
          ...buildProjectConnectionStrings({
            databaseName: managedProject.databaseName,
            roleName: managedProject.roleName,
            password: managedProject.passwordPlaintext,
          }),
          createdAt: managedProject.createdAt,
      }
    : null;

  return (
    <Container>
      <DatabaseDetail
        database={{
          ...database,
          isManaged: Boolean(managedProject),
          managedSlug: managedProject?.slug,
          createdAt: managedProject?.createdAt,
        }}
        credentials={credentials}
        backups={backups}
      />
    </Container>
  );
}
