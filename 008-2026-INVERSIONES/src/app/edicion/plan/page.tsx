import { exigirDueno } from "@/auth/sesion";
import { db } from "@/lib/db";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../../_comun/sin-base";
import { PaginaEdicion } from "../Pagina";
import { TEXTOS_PLAN } from "../textos";
import type { DatosEdicionPlan } from "../tipos";
import { datosEdicionPlan } from "./datos";
import { FormularioPlan } from "./FormularioPlan";

// Lee la base en cada visita: la versión vigente y la última cambian con cada edición.
export const dynamic = "force-dynamic";

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** /edicion/plan · una versión nueva del plan, solo del dueño (la familia recibe 404 antes de leer nada). */
export default async function PaginaEdicionPlan({ searchParams }: Props) {
  let datos: DatosEdicionPlan;
  try {
    await exigirDueno();
    datos = await datosEdicionPlan(db, (await searchParams).base);
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("edicion-plan", error);
    return <SinBase />;
  }
  return (
    <PaginaEdicion seccion="configuracion" titulo={TEXTOS_PLAN.TITULO} volver={{ href: "/plan", texto: "Volver al plan" }}>
      <FormularioPlan datos={datos} />
    </PaginaEdicion>
  );
}
