import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PGN Estudio',
  description: 'Preparación para convocatorias de la Procuraduría General de la Nación',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="bg-slate-100 text-slate-900 antialiased">
        <div className="mx-auto min-h-screen max-w-app bg-white shadow-xl">
          {children}
        </div>
      </body>
    </html>
  );
}
