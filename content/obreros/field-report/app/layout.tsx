import type { Metadata } from "next";
import "./globals.css";
import "./participant.css";
import "./demo.css";

export const metadata: Metadata = {
  title: "Mensajeros CGV — Ministerio y apoyo",
  description: "Conoce y apoya a los Mensajeros de CGV que sirven en ministerio.",
  referrer: "no-referrer",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
