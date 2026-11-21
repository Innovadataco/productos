import { exigirSesion } from "@/auth/sesion";
import { db } from "@/lib/db";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../../_comun/sin-base";
import type { DatosDecision } from "../../_plan/tipos";
import { Cadena } from "./Cadena";
import { datosDeDecision } from "./datos";

// Lee la base en cada visita: el resultado depende de la fecha de hoy y de los cierres cargados.
export const dynamic = "force-dynamic";

interface Props {
  readonly params: Promise<{ id: string }>;
}

export default async function PaginaDecision({ params }: Props) {
  let datos: DatosDecision;
  try {
    // Revalida la sesión contra la base (D-014) antes de leer nada. Sin sesión, `redirect` lanza y pasa.
    await exigirSesion();
    datos = await datosDeDecision(db, (await params).id);
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("decision", error);
    return <SinBase />;
  }
  return <Cadena datos={datos} />;
}
