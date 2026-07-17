import type { Metadata, Viewport } from "next";
import { Inter, DM_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { NavHeader } from "@/components/modules/NavHeader";
import { ServiceWorkerRegister } from "@/components/modules/ServiceWorkerRegister";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

const dmMono = DM_Mono({
    subsets: ["latin"],
    weight: ["400", "500"],
    variable: "--font-dm-mono",
    display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";

export const metadata: Metadata = {
    metadataBase: new URL(appUrl),
    title: {
        default: "Protección Infantil — Reportes Comunitarios",
        template: "%s — Protección Infantil",
    },
    description:
        "Plataforma de reportes comunitarios para la protección de menores. Consulta identificadores de riesgo y reporta conductas de riesgo en línea.",
    manifest: "/manifest.json",
    alternates: {
        canonical: "/",
    },
    openGraph: {
        type: "website",
        locale: "es_CO",
        url: "/",
        siteName: "Protección Infantil",
        title: "Protección Infantil — Reportes Comunitarios",
        description:
            "Plataforma de reportes comunitarios para la protección de menores. Consulta identificadores de riesgo y reporta conductas de riesgo en línea.",
    },
    twitter: {
        card: "summary_large_image",
        title: "Protección Infantil — Reportes Comunitarios",
        description:
            "Plataforma de reportes comunitarios para la protección de menores.",
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Protección Infantil",
    },
    icons: {
        apple: "/icons/icon-192x192.png",
    },
    robots: {
        index: true,
        follow: true,
    },
};

export const viewport: Viewport = {
    themeColor: "#0ea5e9",
    width: "device-width",
    initialScale: 1,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" className={`${inter.variable} ${dmMono.variable}`} suppressHydrationWarning>
            <body className="min-h-screen pt-14">
                <ThemeProvider>
                    <AuthProvider>
                        <ServiceWorkerRegister />
                        <NavHeader />
                        {children}
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
