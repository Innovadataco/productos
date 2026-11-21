import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import "./tablero/tablero.css";

// next/font descarga las fuentes al construir y las sirve desde la app: ninguna visita sale a Google.
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--fuente-display", display: "swap" });
const cuerpo = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--fuente-cuerpo", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--fuente-mono", display: "swap" });

export const metadata: Metadata = {
  title: "008 · Mi portafolio",
  description: "Seguimiento personal del portafolio (solo lectura).",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CO" className={`${display.variable} ${cuerpo.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
