import { exigirSesion } from "@/auth/sesion";
import { db } from "@/lib/db";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../_comun/sin-base";
import { Conciliacion } from "./Conciliacion";
import { datosDeConciliacion, type DatosConciliacion } from "./datos";

// Lee la base en cada visita: la conciliación cambia con cada carga y con cada corrida de `conciliar`.
export const dynamic = "force-dynamic";

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaConciliacion({ searchParams }: Props) {
  let datos: DatosConciliacion;
  try {
    // Revalida la sesión contra la base (D-014) antes de leer nada. Sin sesión, `redirect` lanza y pasa.
    await exigirSesion();
    datos = await datosDeConciliacion(db, (await searchParams).corte);
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("conciliacion", error);
    return <SinBase />;
  }
  return <Conciliacion datos={datos} />;
}
