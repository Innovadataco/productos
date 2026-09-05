/**
 * SPEC-494 · Los 4 esqueletos por layout (§2 del mueble Skeleton). Cada uno
 * CALCA la silueta real de su pantalla (mismas columnas/gaps/radios del layout
 * vivo) → cero salto de layout al llegar los datos. Todos envuelven en
 * `<SkeletonContainer>` (aria-busy + label) y componen `<Skeleton>` primitivos.
 *
 * Uso: `{loading ? <SkeletonColegioInicio/> : <Contenido/>}` — reemplaza el
 * spinner de PÁGINA (§4.8). El spinner-EN-BOTÓN se conserva (no es esto).
 */
import { Skeleton, SkeletonCard, SkeletonCircle, SkeletonContainer, SkeletonText } from "./Skeleton";

/** 2.1 Colegio · inicio del rector: saludo → estado → anillos → KPIs → 2 columnas. */
export function SkeletonColegioInicio() {
    return (
        <SkeletonContainer className="space-y-6">
            <Skeleton className="h-6 w-56 rounded" /> {/* saludo */}
            <SkeletonCard className="h-28" /> {/* tarjeta "protección hoy" */}
            <div className="flex items-center gap-6">
                <SkeletonCircle size={140} />
                <SkeletonText lines={2} className="flex-1 max-w-xs" />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonCard key={i} className="h-24" />
                ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
                <SkeletonCard className="h-64" /> {/* tendencia */}
                <SkeletonCard className="h-64" /> {/* cursos */}
            </div>
        </SkeletonContainer>
    );
}

/** Filas de una lista/tabla DENTRO de una tarjeta o sección (reemplaza el spinner
 *  «Cargando X…» de las sub-páginas: cursos, materias, profesores, alertas,
 *  colegios, apelaciones…). Sin marco propio para no doblar la tarjeta que lo
 *  contiene; preserva el alto de varias filas. */
export function SkeletonLista({ filas = 5 }: { filas?: number }) {
    return (
        <SkeletonContainer className="space-y-3 py-2">
            {Array.from({ length: filas }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-[var(--radio-card)]" />
            ))}
        </SkeletonContainer>
    );
}

/** Detalle (alumno/profesor): encabezado + bloques de campos. */
export function SkeletonDetalle() {
    return (
        <SkeletonContainer className="space-y-4 py-2">
            <Skeleton className="h-6 w-48 rounded" />
            <SkeletonCard className="h-24" />
            <SkeletonText lines={4} />
        </SkeletonContainer>
    );
}

/** 2.2 Admin · bandejas y tablas (densidad alta §8.1): filtros → tabla. */
export function SkeletonAdminBandeja() {
    return (
        <SkeletonContainer className="space-y-4">
            <div className="flex gap-2">
                <Skeleton className="h-9 w-28 rounded-[var(--radio-input)]" />
                <Skeleton className="h-9 w-28 rounded-[var(--radio-input)]" />
                <Skeleton className="h-9 flex-1 rounded-[var(--radio-input)]" />
            </div>
            <div className="rounded-[var(--radio-card)] border border-tinta/10">
                <Skeleton className="h-10 w-full rounded-t-[var(--radio-card)]" /> {/* encabezado */}
                <div className="divide-y divide-tinta/10">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 px-4 py-3">
                            <Skeleton className="h-4 flex-1 rounded" />
                            <Skeleton className="h-4 w-24 rounded" />
                            <Skeleton className="h-4 w-24 rounded" />
                            <Skeleton className="h-4 w-16 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        </SkeletonContainer>
    );
}

/** 2.3 Padre · inicio (densidad baja §8.3): estado → 2 accesos → círculo. */
export function SkeletonPadreInicio() {
    return (
        <SkeletonContainer className="space-y-6">
            <SkeletonCard className="h-32" /> {/* "Mi protección hoy" */}
            <div className="grid grid-cols-2 gap-4">
                <SkeletonCard className="h-24" />
                <SkeletonCard className="h-24" />
            </div>
            <div className="flex items-center gap-4">
                <SkeletonCircle size={120} />
                <Skeleton className="h-4 w-40 rounded" />
            </div>
        </SkeletonContainer>
    );
}

/** 2.4 Profesional · agenda (firma cielo §8.4): próxima cita → lista de citas. */
export function SkeletonProfesionalAgenda() {
    return (
        <SkeletonContainer className="space-y-4">
            <SkeletonCard className="h-24" /> {/* próxima cita destacada */}
            {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} className="h-16" /> /* filas de citas */
            ))}
        </SkeletonContainer>
    );
}
