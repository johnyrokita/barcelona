import type { Metadata } from "next";
import { Fira_Code, Inter } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/footer";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import packageJson from "../../package.json";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: "variable",
});

const mono = Fira_Code({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: "variable",
});

export const metadata: Metadata = {
  title: "Barcelona",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const releaseVersion =
    process.env.RELEASE_VERSION ??
    process.env.NEXT_PUBLIC_RELEASE_VERSION ??
    packageJson.version;
  const commitHash =
    process.env.COMMIT_SHA ??
    process.env.NEXT_PUBLIC_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    null;

  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex flex-col min-h-dvh">
            <div className="flex-1">{children}</div>

            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 sm:px-6">
              <Footer version={releaseVersion} commitHash={commitHash} />
            </div>
          </div>

          <Toaster position="bottom-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
