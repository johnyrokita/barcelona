import { Footer } from "./footer";
import { Header } from "./header";

export async function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 sm:px-6">
      <Header />
      {children}
    </div>
  );
}
