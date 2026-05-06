import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SocketProvider } from "@/src/providers/SocketProvider";

// 🛡️ ENTERPRISE FONT: Inter
const inter = Inter({
  variable: "--font-sans", // CSS variable mapped for Tailwind
  subsets: ["latin"],
  display: "swap",
});

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
      <body
        className={`${inter.variable} font-sans antialiased bg-background text-foreground`}
      >
        <SocketProvider>{children}</SocketProvider>
      </body>
    </html>
  );
}
