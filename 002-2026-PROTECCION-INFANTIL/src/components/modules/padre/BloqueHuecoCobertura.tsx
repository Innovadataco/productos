import Link from "next/link";

/**
 * SPEC-660 · Bloque de atención por HUECO DE COBERTURA (ola-1).
 *
 * Un hijo ACTIVO con 0 cuentas activas: el padre cree que lo protege y no hay nada
 * que cruzar — falla silenciosa. Sale GRATIS de datos que ya llegan (`listarHijos`:
 * `identificadores.activo`), sin tocar Datos. Es un POR-HACER, no una alarma:
 * **CIELO/neutro, NUNCA ámbar** (ámbar se reserva al reporte; un color = un
 * significado). No promete «te avisamos» (I-397).
 *
 * El CTA lleva a la sección «Menores de edad» de Mi perfil (Fase C, Dev 3:
 * `<Acordeon id="menores">` en `/dashboard/padre/perfil`).
 */
const RUTA_AGREGAR_CUENTA = "/dashboard/padre/perfil#menores";

export interface HijoConHueco {
    id: string;
    nombre: string;
}

export function BloqueHuecoCobertura({ hijos }: { hijos: HijoConHueco[] }) {
    if (hijos.length === 0) return null;
    return (
        <div className="space-y-2">
            {hijos.map((h) => {
                const primer = h.nombre.trim().split(/\s+/)[0] || h.nombre;
                return (
                    <div
                        key={h.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-cielo/30 bg-cielo/10 px-3 py-2.5 text-sm text-estado-cielo"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 8v4M12 16h.01" />
                        </svg>
                        <span className="min-w-0 flex-1 text-body">
                            A <b className="font-semibold">{primer}</b> no le agregaste ninguna cuenta: agrégale una para poder cuidarlo.
                        </span>
                        <Link
                            href={RUTA_AGREGAR_CUENTA}
                            className="shrink-0 rounded-lg bg-cielo/15 px-3 py-1.5 text-xs font-semibold text-estado-cielo hover:bg-cielo/25"
                        >
                            Agregar una cuenta
                        </Link>
                    </div>
                );
            })}
        </div>
    );
}
