"use client";

/**
 * SPEC-750 · La cola de sesiones del OPERADOR. Datos del DTO propio (`calendarioDelOperador`),
 * que NO puede cargar PII del padre. Muestra: sus LÍMITES [NORMA] (FORMA §6), la lista de
 * sesiones asignadas y el formulario para publicar el enlace. Voz USTED (área interna).
 *
 * La pantalla muestra los LÍMITES del operador — NO es el guion de lo que debe decir (esa
 * pieza legal vive aparte, [ABOGADO]).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { CalendarioOperadorDto, BloqueSesionOperador } from "@/lib/operadores/calendario-operador.service";

// [NORMA] · FORMA §6 (REPORTE-066). No se reescriben sin pasar por [ABOGADO].
const LIMITES_OPERADOR: string[] = [
    "No puede grabar la sesión (audio, video o pantalla) ni tomar notas de su contenido.",
    "No puede permanecer durante el contenido clínico ni reingresar a la reunión.",
    "No puede dar orientación ni consejo en salud.",
    "Nunca puede quedarse a solas con el menor.",
];

function hhmm(min: number): string {
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function LimitesSesion() {
    return (
        <section className="glass rounded-2xl p-4 sm:p-5 space-y-3">
            <h2 className="titulo text-body text-lg">Sus límites en la sesión</h2>
            <ul className="space-y-2">
                {LIMITES_OPERADOR.map((limite) => (
                    <li key={limite} className="cuerpo text-body flex gap-2">
                        <span aria-hidden className="text-muted">•</span>
                        <span>{limite}</span>
                    </li>
                ))}
            </ul>
            <p className="cuerpo text-muted text-sm">
                Estos son sus límites; no son el guion de lo que debe decir.
            </p>
        </section>
    );
}

function SesionCard({ bloque }: { bloque: BloqueSesionOperador }) {
    const router = useRouter();
    const [enlace, setEnlace] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const publicado = bloque.enlaceEstado === "publicado";

    async function publicar() {
        setEnviando(true);
        setError(null);
        try {
            const res = await fetch(`/api/operador/citas/${bloque.citaId}/enlace`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enlace }),
            });
            if (!res.ok) {
                // SPEC-854: el endpoint serializa AppError como `{error:{message,code}}` (errors.ts
                // toJSON). Leer `error.message` (string); `error` es un OBJETO — pintarlo directo daba
                // «[object Object]» en la pantalla del operador.
                const cuerpo = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
                throw new Error(cuerpo?.error?.message ?? "No se pudo publicar el enlace.");
            }
            setEnlace("");
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo publicar el enlace.");
        } finally {
            setEnviando(false);
        }
    }

    return (
        <li className="glass rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="titulo text-body">
                    {bloque.fecha} · {hhmm(bloque.minInicio)}–{hhmm(bloque.minFin)}
                </p>
                <span className="cuerpo text-muted text-sm">
                    {bloque.modalidad} · cita {bloque.citaRef}
                </span>
            </div>
            <p className="cuerpo text-body">{bloque.profesionalNombre}</p>

            {publicado ? (
                <p className="cuerpo text-muted text-sm">Enlace publicado. Las partes lo ven en su pantalla.</p>
            ) : (
                <div className="space-y-2">
                    <Input
                        label="Enlace de la reunión (https)"
                        placeholder="https://…"
                        value={enlace}
                        onChange={(e) => setEnlace(e.target.value)}
                        inputMode="url"
                        error={error ?? undefined}
                    />
                    <Button onClick={publicar} isLoading={enviando} disabled={enviando || enlace.trim() === ""}>
                        Publicar enlace
                    </Button>
                </div>
            )}
        </li>
    );
}

export function SesionesOperadorClient({ datos }: { datos: CalendarioOperadorDto }) {
    return (
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4">
            <header className="space-y-1">
                <h1 className="titulo text-body text-xl">Sesiones por preparar</h1>
                <p className="cuerpo text-muted text-sm">
                    Prepare el acceso a cada reunión. No verá datos de la familia: solo la agenda.
                </p>
            </header>

            <LimitesSesion />

            {datos.bloques.length === 0 ? (
                <p className="cuerpo text-muted">No hay sesiones por preparar.</p>
            ) : (
                <ul className="space-y-3">
                    {datos.bloques.map((b) => (
                        <SesionCard key={b.citaId} bloque={b} />
                    ))}
                </ul>
            )}
        </div>
    );
}
