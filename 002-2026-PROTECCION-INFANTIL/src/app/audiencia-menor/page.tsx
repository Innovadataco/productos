import { verifyAuth } from "@/lib/auth";
import { menoresPendientesDeAudienciaDelTitular } from "@/lib/dal/services/audiencia-menor";
import { listarHijos } from "@/lib/dal/services/hijos/hijos";
import { DeclararAudiencia, type MenorPendiente } from "@/components/modules/padre/DeclararAudiencia";

/**
 * SPEC-751 T010 · `/audiencia-menor` — la pantalla por la que el titular resuelve la declaración «oír al
 * menor» (Decreto 1377/2013 art. 12). Es el DESTINO del muro de audiencia (`guardias.ts`): hasta hoy el
 * muro apuntaba acá y caía en 404; esta página lo cierra. Forma de Diseño: FORMA-SPEC751-T010 (d485493).
 *
 * 🛑 El gate (`audiencia_menor.gate_activo`) sigue APAGADO: esta pantalla NO lo enciende. Con el gate OFF
 * nadie es rebotado acá; el padre PUEDE llegar por su cuenta y declarar igual (`hayAudienciaPendiente`
 * refleja el estado real siempre). Encender el gate + el texto legal real son un paso aparte (Jelkin).
 *
 * `force-dynamic`: la lista de pendientes cambia al declarar.
 */
export const dynamic = "force-dynamic";

/**
 * Destino del «Continuar» del éxito: la acción de origen. Solo se acepta una ruta INTERNA simple
 * (`/algo`), nunca `//host` ni una URL absoluta (open-redirect). Sin `origen` válido → el inicio del padre.
 */
function origenSeguro(origen: string | undefined): string | null {
    if (!origen) return null;
    if (!origen.startsWith("/") || origen.startsWith("//")) return null;
    return origen;
}

export default async function AudienciaMenorPage({
    searchParams,
}: {
    searchParams: Promise<{ origen?: string }>;
}) {
    const padre = await verifyAuth("PARENT");
    const { origen } = await searchParams;
    const continuarHref = origenSeguro(origen) ?? "/dashboard/padre";

    const [pendientesIds, hijos] = await Promise.all([
        menoresPendientesDeAudienciaDelTitular(padre.id),
        listarHijos(padre.id),
    ]);

    const nombrePorId = new Map(hijos.map((h) => [h.id, h.nombre]));
    const menores: MenorPendiente[] = pendientesIds.map((id) => ({
        hijoId: id,
        // Borde (FORMA §4): nunca un id ni «el menor N».
        nombre: nombrePorId.get(id) ?? "tu hijo/a recién registrado/a",
    }));

    return (
        <main className="theme-padre min-h-screen bg-page py-6">
            {menores.length === 0 ? (
                <section className="mx-auto max-w-xl p-4">
                    <h1 className="text-xl font-semibold text-body">No tienes nada pendiente</h1>
                    <p className="mt-2 text-sm text-body/80">Ya registraste la declaración para tus hijos activos.</p>
                </section>
            ) : (
                <DeclararAudiencia menores={menores} continuarHref={continuarHref} />
            )}
        </main>
    );
}
