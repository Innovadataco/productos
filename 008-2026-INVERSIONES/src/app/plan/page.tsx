import { esSoloLectura } from "@/auth/roles";
import { exigirSesion } from "@/auth/sesion";
import { db } from "@/lib/db";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../_comun/sin-base";
import type { DatosPlan } from "../_plan/tipos";
import { datosDelPlan } from "./datos";
import { Plan } from "./Plan";

// Lee la base en cada visita: el plan, los cierres y la fecha de referencia cambian con cada carga.
export const dynamic = "force-dynamic";

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaPlan({ searchParams }: Props) {
  let datos: DatosPlan;
  let soloLectura: boolean;
  try {
    // Revalida la sesión contra la base (D-014) antes de leer nada. Sin sesión, `redirect` lanza y pasa.
    const usuario = await exigirSesion();
    soloLectura = esSoloLectura(usuario);
    datos = await datosDelPlan(db, (await searchParams).version);
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("plan", error);
    return <SinBase />;
  }
  return <Plan datos={datos} soloLectura={soloLectura} />;
}
