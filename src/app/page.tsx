import { Container } from "@/components/container";
import { requirePageUser } from "@/lib/auth";
import { Home } from "./home";

export default async function Page() {
  const user = await requirePageUser();

  return (
    <Container>
      <Home currentUser={user} />
    </Container>
  );
}
