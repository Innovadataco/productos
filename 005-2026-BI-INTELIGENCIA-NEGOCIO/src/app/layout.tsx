import type { Metadata, Viewport } from "next";
import { Inter, DM_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

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

export const metadata: Metadata = {
    title: {
        default: "BI · Inteligencia de Negocio — IDC",
        template: "%s — BI IDC",
    },
    description: "Plataforma de inteligencia de negocio de Innovadataco.",
    robots: { index: false, follow: false },
};

export const viewport: Viewport = {
    themeColor: "#0ea5e9",
    width: "device-width",
    initialScale: 1,
};

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="es" className={`${inter.variable} ${dmMono.variable}`} suppressHydrationWarning>
            <body className="min-h-screen bg-page text-body antialiased">
                <ThemeProvider>{children}</ThemeProvider>
            </body>
        </html>
    );
}
