import { exigirDueno } from "@/auth/sesion";
import { db } from "@/lib/db";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../../_comun/sin-base";
import { PaginaEdicion } from "../Pagina";
import { TEXTOS_ENLACE, TEXTOS_ESTADO } from "../textos";
import type { DatosEdicionEnlace } from "../tipos";
import { datosEdicionEnlace } from "./datos";
import { FormularioEnlace } from "./FormularioEnlace";

// Lee la base en cada visita: las órdenes sin decisión cambian con cada carga de Trii.
export const dynamic = "force-dynamic";

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function Aviso({ datos }: { readonly datos: Exclude<DatosEdicionEnlace, { estado: "LISTO" }> }) {
  if (datos.estado === "REEMPLAZADA") {
    return <p className="nota aviso" role="status">{TEXTOS_ESTADO.REEMPLAZADA} <a href={`/decisiones/${encodeURIComponent(datos.corregidaPor)}`}>Ver la corrección</a></p>;
  }
  return <p className="nota aviso" role="status">{TEXTOS_ESTADO[datos.estado]}</p>;
}

/** /edicion/enlace?decision=<id> · enlazar una orden de Trii a una decisión vigente, solo del dueño (familia: 404). */
export default async function PaginaEdicionEnlace({ searchParams }: Props) {
  let datos: DatosEdicionEnlace;
  try {
    await exigirDueno();
    datos = await datosEdicionEnlace(db, (await searchParams).decision);
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("edicion-enlace", error);
    return <SinBase />;
  }
  const volver = datos.estado === "LISTO" ? { href: `/decisiones/${encodeURIComponent(datos.decision.id)}`, texto: `Volver a la decisión: ${datos.decision.texto}` } : { href: "/decisiones", texto: "Volver al diario" };
  return (
    <PaginaEdicion seccion="decisiones" titulo={TEXTOS_ENLACE.TITULO} volver={volver}>
      {datos.estado === "LISTO" ? <FormularioEnlace datos={datos} /> : <Aviso datos={datos} />}
    </PaginaEdicion>
  );
}
