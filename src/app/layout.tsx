import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import RootLayoutContent from "@/components/RootLayoutContent";

export const metadata: Metadata = {
  title: "PLATAFORMA INNOVADATACO",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-bgPrimary text-white antialiased overflow-x-hidden">
        <ThemeProvider>
          <RootLayoutContent>{children}</RootLayoutContent>
        </ThemeProvider>
      </body>
    </html>
  );
}
