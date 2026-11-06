import type { Metadata } from "next";
import { AuthSessionProvider } from "@/src/providers/AuthSessionProvider";
import ToastProvider from "@/src/providers/ToastProvider";
import { ThemeProvider } from "@/src/providers/ThemeProvider";
import "./globals.css";



export const metadata: Metadata = {
  title: "SyncVela | Secure Workspace",
  description: "Enterprise-grade real-time communication engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
    return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const saved = localStorage.getItem("syncvela-theme"); const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches; const theme = saved === "dark" || saved === "light" ? saved : prefersDark ? "dark" : "light"; document.documentElement.classList.toggle("dark", theme === "dark"); document.documentElement.style.colorScheme = theme; } catch {} })();`,
          }}
        />
      </head>
      <body

        className="font-sans antialiased bg-background text-foreground"

      >
        <ThemeProvider>
          <AuthSessionProvider>
            {children}
            <ToastProvider />
          </AuthSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
