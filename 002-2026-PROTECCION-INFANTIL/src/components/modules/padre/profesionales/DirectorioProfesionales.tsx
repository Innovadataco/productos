"use client";
/**
 * SPEC-392 (L3) · directorio del padre con baraja aleatoria y filtros.
 *
 * Semilla POR SESIÓN (candado H-4 · veredicto CEO 07:10):
 *  · Se genera al montar y se guarda en `sessionStorage` bajo `directorio.seed`.
 *  · El servidor la usa para ordenar estable (SHA-256 sobre `id + seed`),
 *    así los mismos ids salen en el mismo orden mientras el padre navega.
 *  · Al recargar la pestaña se conserva; al abrir una nueva se genera otra.
 *
 * Los filtros (ciudad, especialidad, modalidad) NO cambian la semilla —
 * solo estrechan la base sobre la que ella baraja. La lista puede quedar
 * vacía (sin match). Si el servidor no devuelve nada, la UI dice por qué,
 * nunca queda muda.
 */
import { useEffect, useMemo, useState } from "react";
import { ProfesionalTarjeta } from "./ProfesionalTarjeta";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";
import { Button } from "@/components/ui/Button";
import { clasificarVacioDirectorio } from "@/lib/padre/directorio-vacio";
import type { PerfilPublicoDTO } from "@/lib/dal/repositories/perfil-profesional";

interface Facetas {
    ciudades: Array<{ id: string; nombre: string }>;
    especialidades: string[];
}

const SEED_KEY = "padre.profesionales.seed";

function obtenerSeedSesion(): string {
    // Guardada en sessionStorage: sobrevive recargas de la pestaña, se pierde
    // al cerrarla. Fallback (pestañas privadas, storage denegado): seed nuevo,
    // pero la UI sigue funcionando — el back exige seed, no que persista.
    try {
        const previa = sessionStorage.getItem(SEED_KEY);
        if (previa && previa.length >= 8) return previa;
        const nueva = crypto.randomUUID();
        sessionStorage.setItem(SEED_KEY, nueva);
        return nueva;
    } catch {
        return crypto.randomUUID();
    }
}

export function DirectorioProfesionales({
    hrefPerfil,
    precioPrimeraCitaCOP,
    // SPEC-428: si el padre entró desde su expediente, se pasa por acá al
    // perfil para ofrecer «compartir expediente» al pagar (§9 M4).
    expedienteIdInicial,
    // SPEC-428 (M7): flujo «elegir otro sin volver a pagar» — el perfil
    // hará POST a /citas/[id]/reasignar en vez del alta normal.
    heredarDeInicial,
}: {
    /** Prefijo del enlace al perfil individual, sin id. */
    hrefPerfil: string;
    /** SPEC-441: el precio que se COBRA por la primera cita, leído en el
     *  servidor del mismo parámetro que usa la ficha. */
    precioPrimeraCitaCOP: number;
    expedienteIdInicial?: string | undefined;
    heredarDeInicial?: string | undefined;
}) {
    // SPEC-440 (I-306): presentación/urgencia NO viajan en URL; el perfil
    // las lee del `sessionStorage` en cliente (helper `borrador-consulta`).
    const [seed, setSeed] = useState<string | null>(null);
    const [facetas, setFacetas] = useState<Facetas | null>(null);
    const [items, setItems] = useState<PerfilPublicoDTO[] | null>(null);
    const [ciudadId, setCiudadId] = useState<string>("");
    const [especialidad, setEspecialidad] = useState<string>("");
    const [modalidad, setModalidad] = useState<"" | "virtual" | "presencial">("");
    const [error, setError] = useState<string | null>(null);
    // SPEC-656 (I-387): ¿hay ALGÚN verificado sin filtros? Lo da el API (un `count`
    // sin filtros). Separa el vacío ESTRUCTURAL (0 en total, hueco NUESTRO) del vacío
    // POR FILTRO (hay, ninguno casa). Default `true`: la rama vacía solo se pinta tras
    // cargar (items!==null), y nunca se afirma «no hay inventario» sin el dato.
    const [hayVerificados, setHayVerificados] = useState(true);

    // Semilla al montar (cliente).
    useEffect(() => {
        setSeed(obtenerSeedSesion());
    }, []);

    // Facetas una vez.
    useEffect(() => {
        fetch("/api/padre/profesionales/facetas", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((j: Facetas | null) => j && setFacetas(j))
            .catch(() => null);
    }, []);

    // Lista cada vez que cambian filtros o seed.
    useEffect(() => {
        if (!seed) return;
        const q = new URLSearchParams({ seed });
        if (ciudadId) q.set("ciudadId", ciudadId);
        if (especialidad) q.set("especialidad", especialidad);
        if (modalidad) q.set("modalidad", modalidad);
        setError(null);
        fetch(`/api/padre/profesionales?${q.toString()}`, { credentials: "include" })
            .then(async (r) => {
                if (!r.ok) throw new Error(String(r.status));
                return r.json() as Promise<{ items: PerfilPublicoDTO[]; hayVerificados: boolean }>;
            })
            .then((j) => {
                setItems(j.items);
                setHayVerificados(j.hayVerificados);
            })
            .catch(() => {
                setItems([]);
                setError("No pudimos cargar la lista. Vuelve a intentar en un momento.");
            });
    }, [seed, ciudadId, especialidad, modalidad]);

    // El link al perfil conserva SOLO los IDs opacos. La urgencia y la
    // presentación las lee el perfil del `sessionStorage` en cliente
    // (SPEC-440 · I-306): no volver a poner PII en la URL.
    const queryPerfil = useMemo(() => {
        const q = new URLSearchParams();
        if (expedienteIdInicial) q.set("expedienteId", expedienteIdInicial);
        if (heredarDeInicial) q.set("heredarDe", heredarDeInicial);
        const qs = q.toString();
        return qs ? `?${qs}` : "";
    }, [expedienteIdInicial, heredarDeInicial]);

    const quitarFiltros = () => {
        setCiudadId("");
        setEspecialidad("");
        setModalidad("");
    };

    // SPEC-656 (I-387): el corte NO sale de `items.length === 0` — eso es cero en
    // LOS DOS vacíos y reproduce el bug (le cobra al padre un hueco que es nuestro).
    // Sale del conteo SIN filtrar (`hayVerificados`). Ver `clasificarVacioDirectorio`.
    const vacio = items === null ? null : clasificarVacioDirectorio(items.length, hayVerificados);
    const estructural = vacio === "estructural";

    return (
        <div className="mx-auto max-w-5xl p-4 space-y-5">
            <header>
                <h1 className="text-2xl font-serif text-body">Profesionales verificados</h1>
                <p className="mt-1 text-sm text-muted">
                    Aparecen en orden aleatorio para que todos tengan turno.
                </p>
            </header>

            {/* SPEC-656: en el vacío ESTRUCTURAL se ocultan los filtros — un select
                sobre cero es la dársena que culpa; los filtros son del estado por-filtro. */}
            {!estructural && (
                <div className="glass rounded-2xl p-4 grid gap-3 sm:grid-cols-3">
                    <label className="text-sm">
                        <span className="block text-xs font-medium text-subtle mb-1">Ciudad</span>
                        <select
                            value={ciudadId}
                            onChange={(e) => setCiudadId(e.target.value)}
                            className="w-full rounded-lg border border-cielo/40 bg-white px-2 py-2 text-sm dark:border-cielo/30 dark:bg-cielo/10"
                        >
                            <option value="">Todas las ciudades</option>
                            {facetas?.ciudades.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.nombre}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="text-sm">
                        <span className="block text-xs font-medium text-subtle mb-1">Especialidad</span>
                        <select
                            value={especialidad}
                            onChange={(e) => setEspecialidad(e.target.value)}
                            className="w-full rounded-lg border border-cielo/40 bg-white px-2 py-2 text-sm dark:border-cielo/30 dark:bg-cielo/10"
                        >
                            <option value="">Todas</option>
                            {facetas?.especialidades.map((e) => (
                                <option key={e} value={e}>
                                    {e}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="text-sm">
                        <span className="block text-xs font-medium text-subtle mb-1">Modalidad</span>
                        <select
                            value={modalidad}
                            onChange={(e) => setModalidad(e.target.value as "" | "virtual" | "presencial")}
                            className="w-full rounded-lg border border-cielo/40 bg-white px-2 py-2 text-sm dark:border-cielo/30 dark:bg-cielo/10"
                        >
                            <option value="">Ambas</option>
                            <option value="virtual">Virtual</option>
                            <option value="presencial">Presencial</option>
                        </select>
                    </label>
                </div>
            )}

            {error && (
                <div className="rounded-xl bg-ambar/10 dark:bg-ambar/10 p-4 text-sm text-ambar dark:text-ambar">
                    {error}
                </div>
            )}

            {items === null ? (
                <p className="text-sm text-muted">Cargando…</p>
            ) : error ? null : estructural ? (
                <VacioEstructural expedienteId={expedienteIdInicial} />
            ) : vacio === "por-filtro" ? (
                <VacioPorFiltro onQuitarFiltros={quitarFiltros} />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((p) => (
                        <ProfesionalTarjeta
                            key={p.id}
                            p={p}
                            hrefBase={hrefPerfil}
                            queryString={queryPerfil}
                            precioPrimeraCitaCOP={precioPrimeraCitaCOP}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * SPEC-656 · Vacío ESTRUCTURAL (0 verificados en total). El problema es NUESTRO,
 * no la búsqueda del padre → nunca «no coincide con los filtros». Tres capas: ayuda
 * que existe HOY (la ruta de urgencia que YA tiene el producto, no una nueva), el
 * directorio como promesa, y un puente a lo que ya puede hacer. Nunca rojo.
 */
function VacioEstructural({ expedienteId }: { expedienteId?: string | undefined }) {
    return (
        <section className="space-y-5">
            {/* Capa 1 · ayuda inmediata que existe HOY — se MONTA `<CanalesOficiales/>`,
                la única ruta oficial y verificada (141/CAI/Te Protejo); no se inventa otra. */}
            <div>
                <p className="text-base font-semibold text-body">¿Necesitas hablar o actuar ahora?</p>
                <p className="mt-1 text-sm text-muted">
                    Estas líneas oficiales están abiertas — la 141 del ICBF atiende gratis, 24 horas, en toda Colombia.
                </p>
                <CanalesOficiales />
            </div>

            {/* Capa 2 · el directorio como PROMESA, no dársena vacía. SOLO el encuadre:
                la promesa «te avisamos» + el botón quedan DIFERIDOS (no hay mecanismo de
                aviso y el correo está sobre-cupo — prometer un aviso que no sale sería
                I-397). Pendiente ratificación Diseño: la capa 2 entra entera cuando el
                mecanismo y el correo vuelvan; la copy de Diseño ya está escrita. */}
            <div className="glass rounded-2xl p-5">
                <p className="text-base font-semibold text-body">Todavía estamos sumando psicólogos verificados.</p>
                <p className="mt-1 text-sm text-muted">Estamos verificando profesionales para este directorio.</p>
            </div>

            {/* Capa 3 · lo que ya puede hacer con lo que tiene. Solo si entró desde un
                expediente (si no, no hay un informe único que descargar). */}
            {expedienteId && (
                <p className="text-sm text-muted">
                    Mientras tanto, puedes{" "}
                    <a
                        href={`/api/padre/expedientes/${expedienteId}/pdf`}
                        className="font-semibold text-estado-cielo hover:underline"
                    >
                        descargar el informe
                    </a>{" "}
                    para llevarlo a la autoridad, al colegio o a un profesional de tu confianza.
                </p>
            )}
        </section>
    );
}

/**
 * SPEC-656 · Vacío POR FILTRO (hay verificados, ninguno casa). Ligero, honesto, sin
 * drama: ni 141 protagonista ni promesa — eso sería sobreactuar un simple filtro. El
 * peso distinto de cada vacío ES la honestidad. Nunca rojo.
 */
function VacioPorFiltro({ onQuitarFiltros }: { onQuitarFiltros: () => void }) {
    return (
        <div className="space-y-3">
            <p className="text-sm text-muted">Ninguno de los psicólogos verificados coincide con estos filtros.</p>
            <p className="text-sm text-muted">
                Prueba con <b className="text-body">todas las ciudades</b>, <b className="text-body">cualquier especialidad</b> o{" "}
                <b className="text-body">las dos modalidades</b> para ver más.
            </p>
            <Button variant="outline" onClick={onQuitarFiltros}>
                Quitar filtros
            </Button>
        </div>
    );
}
