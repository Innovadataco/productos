import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import RootLayoutContent from "@/components/RootLayoutContent";

export const metadata: Metadata = {
  title: "PLATAFORMA INNOVADATACO",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-bgPrimary text-white antialiased overflow-x-hidden">
        <ThemeProvider>
          <WorkspaceProvider>
            <RootLayoutContent>{children}</RootLayoutContent>
          </WorkspaceProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
