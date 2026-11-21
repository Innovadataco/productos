import type { Metadata } from "next";
import { FormularioClave } from "./FormularioClave";
import "../ingresar/acceso.css";

// Pública (D-014): se llega con el enlace de un solo uso que imprime `scripts/crear-acceso-inicial.ts`.
// Dinámica: la CSP lleva un nonce por pedido.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Definir contraseña · Inversiones",
  robots: { index: false, follow: false },
};

export default function DefinirClave() {
  return (
    <main className="acceso">
      <section className="acceso-caja" aria-labelledby="titulo-clave">
        <div className="marca">Inversiones</div>
        <h1 id="titulo-clave">Definir contraseña</h1>
        <p className="nota">De 12 a 72 bytes. El enlace sirve una sola vez y vence a los 30 minutos.</p>
        <FormularioClave />
      </section>
    </main>
  );
}
