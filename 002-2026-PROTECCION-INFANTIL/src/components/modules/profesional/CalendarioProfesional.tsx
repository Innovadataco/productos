"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
    formatoFechaLargaBogota,
    formatoHoraBogota,
    instanteDesdeHoraBogota,
    sumarMinutos,
} from "@/lib/fechas/formato-bogota";

/**
 * SPEC-447 (I-311) · El profesional publica su disponibilidad.
 *
 * Reusa `POST/DELETE /api/profesional/franjas` tal como está — la API llevaba
 * meses construida sin pantalla que la llamara.
 *
 * **La hora vive en un solo lugar.** Acá no se calcula ningún offset: el día y
 * la hora que escribe la persona se convierten con `instanteDesdeHoraBogota`,
 * que está en `src/lib/fechas/formato-bogota.ts` junto al resto de la zona
 * horaria. Es la lección de I-247 — un offset copiado a la pantalla se
 * desincroniza en silencio.
 *
 * **El fin no se pide:** sale de `duracionMinutos` del perfil. Pedirle a alguien
 * que calcule «10:00 + 50 min» es pedirle que se equivoque.
 */

export interface FranjaVista {
    id: string;
    inicio: string;
    fin: string;
    modalidad: "VIRTUAL" | "PRESENCIAL";
    tomada: boolean;
}

interface Props {
    duracionMinutos: number;
    atiendeVirtual: boolean;
    atiendePresencial: boolean;
    franjas: FranjaVista[];
}

type Modalidad = "VIRTUAL" | "PRESENCIAL";

function modalidadesDe(virtual: boolean, presencial: boolean): Modalidad[] {
    const lista: Modalidad[] = [];
    if (virtual) lista.push("VIRTUAL");
    if (presencial) lista.push("PRESENCIAL");
    return lista;
}

const ETIQUETA: Record<Modalidad, string> = {
    VIRTUAL: "Virtual",
    PRESENCIAL: "Presencial",
};

/** Agrupa por día de Bogotá conservando el orden que ya trae el servidor. */
function porDia(franjas: FranjaVista[]): Array<{ dia: string; franjas: FranjaVista[] }> {
    const grupos = new Map<string, FranjaVista[]>();
    for (const f of franjas) {
        const dia = formatoFechaLargaBogota(f.inicio, { weekday: "long", day: "numeric", month: "long" });
        const actual = grupos.get(dia);
        if (actual) actual.push(f);
        else grupos.set(dia, [f]);
    }
    return [...grupos.entries()].map(([dia, lista]) => ({ dia, franjas: lista }));
}

export function CalendarioProfesional({ duracionMinutos, atiendeVirtual, atiendePresencial, franjas }: Props) {
    const router = useRouter();
    const [guardando, empezarTransicion] = useTransition();
    const modalidades = modalidadesDe(atiendeVirtual, atiendePresencial);

    const [dia, setDia] = useState("");
    const [hora, setHora] = useState("");
    const [modalidad, setModalidad] = useState<Modalidad>(modalidades[0] ?? "VIRTUAL");
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    // Vista previa del fin: se calcula con el mismo helper que se manda al
    // servidor, para que lo que se ve y lo que se guarda no puedan discrepar.
    let finPrevisto: string | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dia) && /^\d{2}:\d{2}$/.test(hora)) {
        try {
            finPrevisto = formatoHoraBogota(sumarMinutos(instanteDesdeHoraBogota(dia, hora), duracionMinutos));
        } catch {
            finPrevisto = null;
        }
    }

    async function publicar(evento: React.FormEvent) {
        evento.preventDefault();
        setError(null);
        if (modalidades.length === 0) {
            setError("Primero indique en su ficha si atiende virtual o presencial.");
            return;
        }
        let inicio: Date;
        try {
            inicio = instanteDesdeHoraBogota(dia, hora);
        } catch {
            setError("Revise la fecha y la hora.");
            return;
        }
        const fin = sumarMinutos(inicio, duracionMinutos);

        setEnviando(true);
        try {
            const res = await fetch("/api/profesional/franjas", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    inicio: inicio.toISOString(),
                    fin: fin.toISOString(),
                    modalidad,
                }),
            });
            if (!res.ok) {
                const cuerpo = await res.json().catch(() => null);
                setError(cuerpo?.error?.message ?? "No se pudo publicar la franja.");
                return;
            }
            setDia("");
            setHora("");
            empezarTransicion(() => router.refresh());
        } catch {
            setError("No se pudo publicar la franja. Revise su conexión.");
        } finally {
            setEnviando(false);
        }
    }

    async function retirar(id: string) {
        setError(null);
        try {
            const res = await fetch(`/api/profesional/franjas/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const cuerpo = await res.json().catch(() => null);
                setError(cuerpo?.error?.message ?? "No se pudo retirar la franja.");
                return;
            }
            empezarTransicion(() => router.refresh());
        } catch {
            setError("No se pudo retirar la franja. Revise su conexión.");
        }
    }

    const grupos = porDia(franjas);

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-6">
            <header>
                <h1 className="text-2xl font-bold text-body">Calendario</h1>
                <p className="text-muted">Publique las franjas en las que puede atender.</p>
            </header>

            <GlassCard className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-body">Publicar una franja</h2>
                <form onSubmit={publicar} className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                            type="date"
                            label="Día"
                            value={dia}
                            onChange={(e) => setDia(e.target.value)}
                            required
                        />
                        <Input
                            type="time"
                            label="Hora de inicio"
                            value={hora}
                            onChange={(e) => setHora(e.target.value)}
                            required
                        />
                    </div>

                    {modalidades.length > 1 ? (
                        <fieldset>
                            <legend className="mb-1.5 block text-sm font-medium text-body">Modalidad</legend>
                            <div className="flex gap-2">
                                {modalidades.map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setModalidad(m)}
                                        aria-pressed={modalidad === m}
                                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                            modalidad === m
                                                ? "bg-pino text-white shadow-lg shadow-pino/20"
                                                : "bg-tinta/5 text-subtle hover:bg-tinta/10"
                                        }`}
                                    >
                                        {ETIQUETA[m]}
                                    </button>
                                ))}
                            </div>
                        </fieldset>
                    ) : (
                        modalidades[0] && (
                            <p className="text-sm text-muted">Modalidad: {ETIQUETA[modalidades[0]]}</p>
                        )
                    )}

                    <p className="text-xs text-muted">
                        {finPrevisto
                            ? `Termina a las ${finPrevisto} · ${duracionMinutos} minutos, según su ficha.`
                            : `Cada franja dura ${duracionMinutos} minutos, según su ficha.`}
                    </p>

                    {error && (
                        <p role="alert" className="text-sm text-rubi">
                            {error}
                        </p>
                    )}

                    <Button type="submit" isLoading={enviando || guardando} disabled={modalidades.length === 0}>
                        Publicar franja
                    </Button>
                </form>
            </GlassCard>

            <GlassCard className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-body">Sus franjas</h2>
                {franjas.length === 0 ? (
                    <p className="text-sm text-muted">
                        Sin franjas publicadas, ninguna familia puede agendar con usted.
                    </p>
                ) : (
                    <div className="space-y-5">
                        {grupos.map(({ dia: etiquetaDia, franjas: delDia }) => (
                            <section key={etiquetaDia}>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">
                                    {etiquetaDia}
                                </h3>
                                <ul className="mt-2 space-y-2">
                                    {delDia.map((f) => (
                                        <li
                                            key={f.id}
                                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-tinta/5 px-3 py-2"
                                        >
                                            <div className="text-sm">
                                                <p className="font-medium text-body">
                                                    {formatoHoraBogota(f.inicio)} – {formatoHoraBogota(f.fin)}
                                                </p>
                                                <p className="text-xs text-subtle">{ETIQUETA[f.modalidad]}</p>
                                            </div>
                                            {f.tomada ? (
                                                <Badge variant="info">Reservada</Badge>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => retirar(f.id)}
                                                    aria-label={`Retirar la franja de las ${formatoHoraBogota(f.inicio)}`}
                                                >
                                                    Retirar
                                                </Button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}
            </GlassCard>
        </div>
    );
}
