import type { Metadata } from "next";
import { exigirPadre } from "@/lib/padre/guardia-padre";
import { listarHijos } from "@/lib/dal/services/hijos";
import { SoportePanel } from "@/components/modules/soporte/SoportePanel";

/**
 * SPEC-824 (cablea SPEC-819) · La página de la Puerta de Soporte del padre.
 *
 * Monta `SoportePanel` (que ya trae la copy de Diseño de 819) con los hijos del padre (para el sujeto de
 * habeas data). Esta ruta es lo que vuelve la puerta ALCANZABLE — y por eso se despliega en el MISMO PR que
 * la bandeja del operador (SPEC-824): la invariante «nadie entra antes de que alguien pueda ver lo que entra»
 * la sostiene el candado de alcanzabilidad.
 *
 * El punto de entrada DISCOVERABLE (ítem de menú del padre) y su etiqueta quedan pendientes de la forma de
 * Diseño (etiqueta visible = copy nueva): esta ruta es alcanzable por URL; el enlace se agrega con la copy.
 */
export const metadata: Metadata = { title: "Soporte" };
export const dynamic = "force-dynamic";

export default async function PadreSoportePage() {
    const usuario = await exigirPadre();
    const hijos = await listarHijos(usuario.id);
    return (
        <div className="mx-auto max-w-2xl">
            <SoportePanel hijos={hijos.map((h) => ({ id: h.id, nombre: h.nombre }))} />
        </div>
    );
}
