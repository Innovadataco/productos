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
import { ProfesionalTarjeta, type ProfesionalTarjetaData } from "./ProfesionalTarjeta";

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
    urgenciaInicial,
    presentacionInicial,
    hrefPerfil,
}: {
    urgenciaInicial?: "ESTA_SEMANA" | "SIN_APURO" | undefined;
    presentacionInicial?: string | undefined;
    /** Prefijo del enlace al perfil individual, sin id. */
    hrefPerfil: string;
}) {
    const [seed, setSeed] = useState<string | null>(null);
    const [facetas, setFacetas] = useState<Facetas | null>(null);
    const [items, setItems] = useState<ProfesionalTarjetaData[] | null>(null);
    const [ciudadId, setCiudadId] = useState<string>("");
    const [especialidad, setEspecialidad] = useState<string>("");
    const [modalidad, setModalidad] = useState<"" | "virtual" | "presencial">("");
    const [error, setError] = useState<string | null>(null);

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
                return r.json() as Promise<{ items: ProfesionalTarjetaData[] }>;
            })
            .then((j) => setItems(j.items))
            .catch(() => {
                setItems([]);
                setError("No pudimos cargar la lista. Volvé a intentar en un momento.");
            });
    }, [seed, ciudadId, especialidad, modalidad]);

    // El link al perfil conserva la urgencia y la presentación (llegan en L4).
    const queryPerfil = useMemo(() => {
        const q = new URLSearchParams();
        if (urgenciaInicial) q.set("u", urgenciaInicial);
        if (presentacionInicial) q.set("pres", presentacionInicial);
        const qs = q.toString();
        return qs ? `?${qs}` : "";
    }, [urgenciaInicial, presentacionInicial]);

    return (
        <div className="mx-auto max-w-5xl p-4 space-y-5">
            <header>
                <h1 className="text-2xl font-serif text-body">Profesionales verificados</h1>
                <p className="mt-1 text-sm text-muted">
                    Aparecen en orden aleatorio para que todos tengan turno.
                </p>
            </header>

            <div className="glass rounded-2xl p-4 grid gap-3 sm:grid-cols-3">
                <label className="text-sm">
                    <span className="block text-xs font-medium text-subtle mb-1">Ciudad</span>
                    <select
                        value={ciudadId}
                        onChange={(e) => setCiudadId(e.target.value)}
                        className="w-full rounded-lg border border-sky-200 bg-white px-2 py-2 text-sm dark:border-sky-900 dark:bg-sky-950/30"
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
                        className="w-full rounded-lg border border-sky-200 bg-white px-2 py-2 text-sm dark:border-sky-900 dark:bg-sky-950/30"
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
                        className="w-full rounded-lg border border-sky-200 bg-white px-2 py-2 text-sm dark:border-sky-900 dark:bg-sky-950/30"
                    >
                        <option value="">Ambas</option>
                        <option value="virtual">Virtual</option>
                        <option value="presencial">Presencial</option>
                    </select>
                </label>
            </div>

            {error && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-200">
                    {error}
                </div>
            )}

            {items === null ? (
                <p className="text-sm text-muted">Cargando…</p>
            ) : items.length === 0 && !error ? (
                <p className="text-sm text-muted">
                    Ningún profesional coincide con los filtros. Probá cambiar la ciudad o la modalidad.
                </p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((p) => (
                        <ProfesionalTarjeta key={p.id} p={p} hrefBase={hrefPerfil} queryString={queryPerfil} />
                    ))}
                </div>
            )}
        </div>
    );
}
