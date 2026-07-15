import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { NavHeader } from "@/components/modules/NavHeader";
import { ServiceWorkerRegister } from "@/components/modules/ServiceWorkerRegister";
import { OnboardingModal } from "@/components/modules/OnboardingModal";

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
        "Plataforma de reportes comunitarios para la protección de menores. Consulta identificadores de riesgo y reporta conductas de riesgo.",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Protección Infantil",
    },
    icons: {
        apple: "/icons/icon-192x192.png",
    },
};

export const viewport: Viewport = {
    themeColor: "#2563eb",
    width: "device-width",
    initialScale: 1,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" className={`${plusJakarta.variable} ${dmMono.variable}`}>
            <body className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 pt-14">
                <AuthProvider>
                    <ServiceWorkerRegister />
                    <NavHeader />
                    <OnboardingModal />
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
