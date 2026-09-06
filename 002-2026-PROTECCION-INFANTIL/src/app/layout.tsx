import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { PieGlobal } from "@/components/modules/PieGlobal";
import { NavHeader } from "@/components/modules/NavHeader";
import { ServiceWorkerRegister } from "@/components/modules/ServiceWorkerRegister";
import { SesionRefreshInterceptor } from "@/components/modules/SesionRefreshInterceptor";
import { LimpiarMarcaRebote } from "@/components/modules/LimpiarMarcaRebote";
import { AvisoVersionNueva } from "@/components/modules/version/AvisoVersionNueva";

// SPEC-157 (D1/D3): un solo mecanismo — next/font/local con woff2 vendoreados en
// public/fonts (latin + latin-ext, SIL OFL). Cero descargas de Google en build/runtime.
// El fallback por carácter entre caras de la misma familia cubre latin-ext.
const instrumentSans = localFont({
    src: [
        { path: "../../public/fonts/instrument-sans-latin.woff2", weight: "400 700", style: "normal" },
        { path: "../../public/fonts/instrument-sans-latin-ext.woff2", weight: "400 700", style: "normal" },
        { path: "../../public/fonts/instrument-sans-italic-latin.woff2", weight: "400 700", style: "italic" },
        { path: "../../public/fonts/instrument-sans-italic-latin-ext.woff2", weight: "400 700", style: "italic" },
    ],
    variable: "--font-instrument-sans",
    display: "swap",
});

const instrumentSerif = localFont({
    src: [
        { path: "../../public/fonts/instrument-serif-latin.woff2", weight: "400", style: "normal" },
        { path: "../../public/fonts/instrument-serif-latin-ext.woff2", weight: "400", style: "normal" },
        { path: "../../public/fonts/instrument-serif-italic-latin.woff2", weight: "400", style: "italic" },
        { path: "../../public/fonts/instrument-serif-italic-latin-ext.woff2", weight: "400", style: "italic" },
    ],
    variable: "--font-instrument-serif",
    display: "swap",
});

const dmMono = localFont({
    src: [
        { path: "../../public/fonts/dm-mono-400-latin.woff2", weight: "400", style: "normal" },
        { path: "../../public/fonts/dm-mono-400-latin-ext.woff2", weight: "400", style: "normal" },
        { path: "../../public/fonts/dm-mono-500-latin.woff2", weight: "500", style: "normal" },
        { path: "../../public/fonts/dm-mono-500-latin-ext.woff2", weight: "500", style: "normal" },
        { path: "../../public/fonts/dm-mono-italic-400-latin.woff2", weight: "400", style: "italic" },
        { path: "../../public/fonts/dm-mono-italic-400-latin-ext.woff2", weight: "400", style: "italic" },
    ],
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
    themeColor: "#0b6e5a", /* token pino (§4.2) */
    width: "device-width",
    initialScale: 1,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" className={`${instrumentSans.variable} ${instrumentSerif.variable} ${dmMono.variable}`} suppressHydrationWarning>
            <body className="flex min-h-screen flex-col pt-14">
                <ThemeProvider>
                    <AuthProvider>
                        <ServiceWorkerRegister />
                        {/* SPEC-572 (I-236): refresco silencioso de sesion_estado — captura el 403
                            SESION_ESTADO_REQUERIDO del cerrojo fail-closed, re-sella y reintenta. */}
                        <SesionRefreshInterceptor />
                        {/* SPEC-572 (loop-cap · residual de Datos): saca `?_rv=1` de la barra tras
                            una carga sana, para que un favorito/compartido no dispare el logout luego. */}
                        <LimpiarMarcaRebote />
                        <NavHeader />
                        {/* SPEC-362 (G21): el contenido empuja y el pie queda abajo
                            en todas las pantallas, cortas o largas. */}
                        <div className="flex-1">{children}</div>
                        <PieGlobal />
                        {/* SPEC-548 (I-337): aviso de version nueva, toast discreto que no bloquea. */}
                        <AvisoVersionNueva />
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
