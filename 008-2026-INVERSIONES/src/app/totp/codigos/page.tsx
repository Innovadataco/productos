import type { Metadata } from "next";
import { exigirSesion } from "@/auth/sesion";
import { FormularioCodigos } from "./FormularioCodigos";
import "../../ingresar/acceso.css";

// Regenerar los códigos de recuperación: exige la sesión completa (y el POST, un código de la app).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Códigos de recuperación · Inversiones",
  robots: { index: false, follow: false },
};

export default async function Codigos() {
  await exigirSesion();
  return (
    <main className="acceso">
      <section className="acceso-caja" aria-labelledby="titulo-codigos-nuevos">
        <div className="marca">Inversiones</div>
        <h1 id="titulo-codigos-nuevos">Códigos de recuperación</h1>
        <FormularioCodigos />
      </section>
    </main>
  );
}
