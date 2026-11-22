import { exigirDueno } from "@/auth/sesion";
import { db } from "@/lib/db";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../../_comun/sin-base";
import { PaginaEdicion } from "../Pagina";
import { TEXTOS_DECISION, TEXTOS_ESTADO } from "../textos";
import type { DatosEdicionDecision } from "../tipos";
import { datosEdicionDecision } from "./datos";
import { FormularioDecision } from "./FormularioDecision";

// Lee la base en cada visita: las versiones, las órdenes sin decisión y la decisión a corregir cambian.
export const dynamic = "force-dynamic";

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** /edicion/decision · registrar (o, con ?corrige, corregir) una decisión del diario, solo del dueño (familia: 404). */
export default async function PaginaEdicionDecision({ searchParams }: Props) {
  let datos: DatosEdicionDecision;
  try {
    await exigirDueno();
    const { corrige, orden } = await searchParams;
    datos = await datosEdicionDecision(db, { ...(corrige === undefined ? {} : { corrige }), ...(orden === undefined ? {} : { orden }) });
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("edicion-decision", error);
    return <SinBase />;
  }
  const titulo = datos.estado === "LISTO" && datos.corrige ? TEXTOS_DECISION.TITULO_CORRECCION : TEXTOS_DECISION.TITULO;
  return (
    <PaginaEdicion seccion="decisiones" titulo={titulo} volver={{ href: "/decisiones", texto: "Volver al diario" }}>
      {datos.estado === "LISTO" ? <FormularioDecision datos={datos} /> : <p className="nota aviso" role="status">{TEXTOS_ESTADO[datos.estado]}</p>}
    </PaginaEdicion>
  );
}
