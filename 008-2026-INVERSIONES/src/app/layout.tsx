import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono, Manrope } from "next/font/google";
import { connection } from "next/server";
import type { ReactNode } from "react";
import "./tablero/tablero.css";

// next/font descarga las fuentes al construir y las sirve desde la app: ninguna visita sale a Google.
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--fuente-display", display: "swap" });
const cuerpo = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--fuente-cuerpo", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--fuente-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Inversiones",
  description: "Seguimiento personal del portafolio (solo lectura).",
  robots: { index: false, follow: false },
  // Sin favicon todavía: un ícono vacío evita el pedido a /favicon.ico (404 en la consola).
  icons: { icon: "data:," },
};

/**
 * Todo se renderiza por pedido (D-014): la CSP lleva un nonce distinto en cada uno, y una página
 * prerenderizada (el 404, la de error) saldría sin nonce y, con `strict-dynamic`, no hidrataría.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  return (
    <html lang="es-CO" className={`${display.variable} ${cuerpo.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
