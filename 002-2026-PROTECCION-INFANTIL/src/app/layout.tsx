import type { Metadata } from "next";
import { Plus_Jakarta_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { NavHeader } from "@/components/modules/NavHeader";

const plusJakarta = Plus_Jakarta_Sans({
    subsets: ["latin"],
    variable: "--font-plus-jakarta",
    display: "swap",
});

const dmMono = DM_Mono({
    subsets: ["latin"],
    weight: ["400", "500"],
    variable: "--font-dm-mono",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Protección Infantil — Reportes Comunitarios",
    description:
        "Plataforma de reportes comunitarios para la protección de menores. Consulta identificadores de riesgo y reporta conductas sospechosas.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" className={`${plusJakarta.variable} ${dmMono.variable}`}>
            <body className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
                <AuthProvider>
                    <NavHeader />
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
