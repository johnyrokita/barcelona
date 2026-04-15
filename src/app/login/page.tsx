import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function Page() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return (
    <main className="flex flex-col min-h-screen items-center justify-center px-4 gap-4 pt-20">
      <div className="flex-1 flex flex-col items-center justify-center">
        <h1 className="font-mono text-4xl font-bold select-none">Barcelona</h1>
      </div>
      <LoginForm />
      <div className="flex-1" />
    </main>
  );
}
