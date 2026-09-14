import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PGN Estudio',
  description: 'Preparación para convocatorias de la Procuraduría General de la Nación',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PGN Estudio',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#F2F2F7',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="PGN Estudio" />
        <meta name="application-name" content="PGN Estudio" />
        <meta name="msapplication-TileColor" content="#0B6E5A" />
      </head>
      <body className="ios-page">
        {children}
      </body>
    </html>
  );
}
