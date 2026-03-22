import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "LeadsNeoForge — AI Lead Generation & Automation",
  description:
    "AI-powered lead generation and marketing automation platform: Reddit monitoring, LinkedIn outreach, content creation, and multi-channel campaigns.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
          <Toaster position="bottom-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
