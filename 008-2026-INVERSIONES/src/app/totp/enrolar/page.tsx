import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { datosDeEnrolamiento } from "@/auth/enrolamiento";
import { exigirPresesion } from "@/auth/presesion-servidor";
import { qrDeTexto } from "@/auth/qr";
import { MENSAJE_FUERA_DE_PLAZO } from "@/auth/respuestas";
import { db } from "@/lib/db";
import { BotonCopiar } from "../BotonCopiar";
import { FormularioEnrolar } from "./FormularioEnrolar";
import "../../ingresar/acceso.css";

// Enrolamiento del TOTP en el primer ingreso. No exige sesión en el proxy: exige la PRE-sesión aquí. Solo
// lee: el secreto pendiente lo creó el paso de la clave. Dinámica (nonce de la CSP y nada en caché).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Activar el segundo factor · Inversiones",
  robots: { index: false, follow: false },
};

const MARGEN = 4;

/** El QR como un solo <path>: módulos negros sobre blanco, con su margen, en cualquier tema. */
function Qr({ uri }: { readonly uri: string }) {
  const { lado, trazo } = qrDeTexto(uri);
  const total = lado + 2 * MARGEN;
  return (
    <svg className="acceso-qr" viewBox={`${-MARGEN} ${-MARGEN} ${total} ${total}`} role="img" aria-label="Código QR para la app autenticadora" shapeRendering="crispEdges">
      <rect x={-MARGEN} y={-MARGEN} width={total} height={total} fill="#ffffff" />
      <path d={trazo} fill="#000000" />
    </svg>
  );
}

const enGrupos = (texto: string): string => (texto.match(/.{1,4}/g) ?? []).join(" ");

function Caja({ children }: { readonly children: ReactNode }) {
  return (
    <main className="acceso">
      <section className="acceso-caja" aria-labelledby="titulo-enrolar">
        <div className="marca">Inversiones</div>
        <h1 id="titulo-enrolar">Segundo factor</h1>
        {children}
      </section>
    </main>
  );
}

export default async function Enrolar() {
  const pre = await exigirPresesion();
  const datos = await datosDeEnrolamiento(db, pre, new Date());
  if (datos.estado === "VENCIDA") redirect("/ingresar");
  if (datos.estado === "ACTIVO") redirect("/totp");
  if (datos.estado !== "LISTO") {
    return (
      <Caja>
        <p className="acceso-aviso" role="alert">
          {MENSAJE_FUERA_DE_PLAZO}
        </p>
      </Caja>
    );
  }
  return (
    <Caja>
      <FormularioEnrolar>
        <ol className="acceso-pasos">
          <li>Abra su app autenticadora y escanee el código QR.</li>
          <li>Escriba el código de 6 dígitos que muestra la app.</li>
        </ol>
        <Qr uri={datos.uri} />
        <p className="nota" id="nota-secreto">
          ¿No puede escanear? Escriba esta clave en la app (tipo «basada en tiempo»):
        </p>
        <p className="acceso-secreto" aria-describedby="nota-secreto" data-clave-totp="">
          {enGrupos(datos.secreto)}
        </p>
        <BotonCopiar texto={datos.secreto} etiqueta="Copiar la clave" copiado="Clave copiada." />
      </FormularioEnrolar>
    </Caja>
  );
}
