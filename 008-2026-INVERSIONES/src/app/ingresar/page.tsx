import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sesionActual } from "@/auth/sesion";
import { FormularioIngreso } from "./FormularioIngreso";
import "./acceso.css";

// Pública (D-014). Dinámica: la CSP lleva un nonce por pedido y la sesión se revisa en cada visita.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ingresar · Inversiones",
  robots: { index: false, follow: false },
};

/** Con una sesión válida no se ofrece el formulario. Si la base no responde, se muestra igual. */
async function haySesion(): Promise<boolean> {
  try {
    return (await sesionActual()) !== null;
  } catch (error) {
    const codigo = (error as { code?: unknown })?.code ?? (error as Error)?.name ?? "desconocido";
    console.error(`[ingresar] no se pudo revisar la sesión (código: ${String(codigo)})`);
    return false;
  }
}

export default async function Ingresar() {
  if (await haySesion()) redirect("/");
  return (
    <main className="acceso">
      <section className="acceso-caja" aria-labelledby="titulo-ingreso">
        <div className="marca">Inversiones</div>
        <h1 id="titulo-ingreso">Ingresar</h1>
        <p className="nota">Portafolio personal, de solo lectura.</p>
        <FormularioIngreso />
      </section>
    </main>
  );
}
