import { Container } from "@/components/container";
import { requirePageUser } from "@/lib/auth";
import { CreateDatabaseForm } from "./create-database-form";

export default async function Page() {
  await requirePageUser();

  return (
    <Container>
      <CreateDatabaseForm />
    </Container>
  );
}
