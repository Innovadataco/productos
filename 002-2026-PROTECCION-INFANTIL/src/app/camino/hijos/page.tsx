/**
 * SPEC-339 (A-67) · Paso 3 del camino del padre — sus menores.
 *
 * SPEC-361 (A-70 · F6): la página pasó a servidor para leer el tope
 * (`padre.hijos.maximo`) y que la pantalla pueda mostrar "3 de 5" sin
 * adivinarlo ni pedir un endpoint nuevo. El formulario sigue siendo cliente.
 */
import { getParametroSistemaValor } from "@/lib/parametros";
import { CaminoHijosClient } from "./CaminoHijosClient";

export const dynamic = "force-dynamic";

export default async function CaminoHijosPage() {
    const maximo = parseInt((await getParametroSistemaValor("padre.hijos.maximo")) ?? "5", 10);
    return <CaminoHijosClient maximoActivos={maximo} />;
}
