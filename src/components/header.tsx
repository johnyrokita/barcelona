import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "./logout-button";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className=" py-4 border-b flex items-center justify-between font-mono w-full pt-5">
      <Link href="/">
        <h1 className="text-xl font-semibold">Barcelona</h1>
      </Link>
      <nav className="flex items-center gap-3 tracking-wider">
        <Link
          href="/"
          className="text-lime-600 dark:text-lime-500 hover:underline"
        >
          Home
        </Link>
        <span>·</span>
        <Link
          href="/settings"
          className="text-lime-600 dark:text-lime-500 hover:underline"
        >
          Settings
        </Link>
        {user ? (
          <>
            <span>·</span>
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <LogoutButton />
          </>
        ) : null}
      </nav>
    </header>
  );
}
