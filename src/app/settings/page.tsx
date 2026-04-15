import { Container } from "@/components/container";
import { requirePageUser } from "@/lib/auth";
import { SettingsPanel } from "./settings-panel";

export default async function Page() {
  const user = await requirePageUser();

  return (
    <Container>
      <SettingsPanel currentUser={user} />
    </Container>
  );
}
