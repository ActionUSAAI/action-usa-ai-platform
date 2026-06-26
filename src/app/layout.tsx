import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACTION USA AI - Gestión de Casos",
  description: "Portal de Gestión de Casos de Inmigración - ACTION USA AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
