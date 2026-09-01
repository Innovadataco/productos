import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif, DM_Mono } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
    subsets: ["latin"],
    variable: "--font-instrument-sans",
});
const instrumentSerif = Instrument_Serif({
    subsets: ["latin"],
    weight: "400",
    style: ["normal", "italic"],
    variable: "--font-instrument-serif",
});
const dmMono = DM_Mono({
    subsets: ["latin"],
    weight: ["400", "500"],
    variable: "--font-dm-mono",
});

export const metadata: Metadata = {
    title: "BI · Inteligencia de Negocio — Innovadataco",
    description: "Inteligencia de negocio interna sobre la operación de PI. Acceso cerrado.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es" className={`dark ${instrumentSans.variable} ${instrumentSerif.variable} ${dmMono.variable}`}>
            <body className="font-sans min-h-screen">
                {/* Orbes ambientales: la sala respira (mockup-bi-v2) */}
                <div className="orbe orbe-1" aria-hidden="true" />
                <div className="orbe orbe-2" aria-hidden="true" />
                <div className="orbe orbe-3" aria-hidden="true" />
                {children}
            </body>
        </html>
    );
}
