import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirPresesion } from "@/auth/presesion-servidor";
import { estadoDelSegundoPaso } from "@/auth/segundo-paso";
import { db } from "@/lib/db";
import { FormularioTotp } from "./FormularioTotp";
import "../ingresar/acceso.css";

// Segundo paso del ingreso (TOTP). No exige sesión en el proxy: exige la PRE-sesión aquí (candado en
// tests/unit/auth/candados.test.ts). Dinámica: la CSP lleva un nonce por pedido.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verificar · Inversiones",
  robots: { index: false, follow: false },
};

export default async function Totp() {
  const pre = await exigirPresesion();
  const estado = await estadoDelSegundoPaso(db, pre);
  if (estado === "VENCIDA") redirect("/ingresar");
  if (estado === "ENROLAR") redirect("/totp/enrolar");
  return (
    <main className="acceso">
      <section className="acceso-caja" aria-labelledby="titulo-totp">
        <div className="marca">Inversiones</div>
        <h1 id="titulo-totp">Verificar</h1>
        <p className="nota">Escriba el código de 6 dígitos de su app autenticadora.</p>
        <FormularioTotp />
      </section>
    </main>
  );
}
