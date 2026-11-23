import { exigirDueno } from "@/auth/sesion";
import { db } from "@/lib/db";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../../_comun/sin-base";
import { PaginaEdicion } from "../Pagina";
import { datosEdicionTarifas } from "./datos";
import { FormularioTarifa } from "./FormularioTarifa";
import { Historia, Vigentes } from "./Informacion";
import { TEXTOS_TARIFAS } from "./textos-tarifas";
import type { DatosEdicionTarifas } from "./tipos-tarifas";
import "./tarifas.css";

// Lee la base en cada visita: las versiones y las órdenes cambian.
export const dynamic = "force-dynamic";

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** /edicion/tarifas · la tarifa de comisión de cada casa de bolsa, solo del dueño (la familia recibe 404 antes de leer nada). */
export default async function PaginaEdicionTarifas({ searchParams }: Props) {
  let datos: DatosEdicionTarifas;
  try {
    await exigirDueno();
    datos = await datosEdicionTarifas(db, (await searchParams).guardada);
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("edicion-tarifas", error);
    return <SinBase />;
  }
  return (
    <PaginaEdicion seccion="plan" titulo={TEXTOS_TARIFAS.TITULO} volver={{ href: "/operar", texto: "Volver a Operar" }}>
      <Vigentes datos={datos} />
      <FormularioTarifa datos={datos} />
      <Historia datos={datos} />
    </PaginaEdicion>
  );
}
