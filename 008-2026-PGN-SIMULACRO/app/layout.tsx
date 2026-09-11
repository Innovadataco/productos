import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simulacro PGN 2026 · INNOVADATACO",
  description:
    "Simulacros de examen PGN 2026 — Asesor TIC (Conv. 52) y Procuradora Judicial (Conv. 89)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <main className="mx-auto min-h-screen w-full max-w-[440px] px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
