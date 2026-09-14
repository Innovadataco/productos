"use client";

/**
 * SPEC-693 (I-416) · Cola «Documentos nuevos» del Verificador.
 *
 * Profesionales que YA ATIENDEN y subieron una versión nueva de un requisito. FORMA de
 * Diseño (13-09): un renglón por (profesional, requisito) con «Reemplazó {requisito}»,
 * insignia «Atendiendo», y —única urgencia real— una línea ÁMBAR si la VERIFICACIÓN
 * vence en ≤30 días (nunca rubí, D-120). El nombre del requisito sale del parámetro,
 * nunca escrito a mano. Mismo vidrio/ritmo que la cola de solicitudes.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

interface VersionFila {
    extension: string;
    subidoEn: string;
}
interface RequisitoRenovacion {
    clave: string;
    nombre: string;
    vigente: VersionFila | null;
    nuevo: VersionFila;
}
interface FilaRenovacion {
    profesionalId: string;
    nombreVisible: string;
    email: string;
    tituloProfesional: string;
    ciudadNombre: string;
    venceEn: string | null;
    requisitos: RequisitoRenovacion[];
}

// Una tarjeta por (profesional, requisito): la decisión es por documento.
interface FilaPlana {
    profesionalId: string;
    nombreVisible: string;
    tituloProfesional: string;
    ciudadNombre: string;
    venceEn: string | null;
    requisitoClave: string;
    requisitoNombre: string;
    subidoEn: string;
}

const DIA = 86_400_000;

function tiempoRelativo(iso: string): string {
    const dif = Date.now() - new Date(iso).getTime();
    const min = Math.round(dif / 60000);
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 48) return `hace ${h} h`;
    return `hace ${Math.round(h / 24)} días`;
}

function fechaCorta(iso: string): string {
    return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

/** ≤30 días para el vencimiento (y aún no vencida): la única urgencia real (FORMA §1). */
function venceProximo(venceEn: string | null): boolean {
    if (!venceEn) return false;
    const restante = new Date(venceEn).getTime() - Date.now();
    return restante > 0 && restante <= 30 * DIA;
}

export function RenovacionesColaClient({ onLoaded }: { onLoaded?: (n: number) => void } = {}) {
    const [filas, setFilas] = useState<FilaPlana[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let vivo = true;
        (async () => {
            try {
                const res = await fetch("/api/admin/verificacion-profesionales/renovaciones", {
                    credentials: "include",
                });
                if (!res.ok) {
                    const cuerpo = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
                    throw new Error(cuerpo?.error?.message ?? `El servidor respondió con un error (HTTP ${res.status}).`);
                }
                const json = (await res.json()) as { data: FilaRenovacion[] };
                const planas: FilaPlana[] = json.data.flatMap((p) =>
                    p.requisitos.map((r) => ({
                        profesionalId: p.profesionalId,
                        nombreVisible: p.nombreVisible,
                        tituloProfesional: p.tituloProfesional,
                        ciudadNombre: p.ciudadNombre,
                        venceEn: p.venceEn,
                        requisitoClave: r.clave,
                        requisitoNombre: r.nombre,
                        subidoEn: r.nuevo.subidoEn,
                    })),
                );
                if (vivo) {
                    setFilas(planas);
                    onLoaded?.(planas.length);
                }
            } catch (e) {
                if (vivo) setError(e instanceof Error ? e.message : String(e));
            }
        })();
        return () => {
            vivo = false;
        };
    }, [onLoaded]);

    if (error) {
        return (
            <div className="glass rounded-2xl p-6 text-body">
                <p className="titular-seccion mb-2">No pudimos cargar los documentos nuevos</p>
                <p className="cuerpo text-subtle">{error}</p>
            </div>
        );
    }

    if (filas === null) {
        return (
            <div className="animate-pulse space-y-3">
                {[0, 1].map((i) => (
                    <div key={i} className="glass h-24 rounded-2xl" />
                ))}
            </div>
        );
    }

    if (filas.length === 0) {
        // FORMA §5: copy DISTINTA de «Cola vacía» de la otra pestaña.
        return (
            <div className="glass rounded-3xl p-10 text-center">
                <p className="titular-seccion mb-2">Ningún documento esperando revisión</p>
                <p className="cuerpo text-subtle">
                    Cuando un profesional que ya atiende reemplace uno, aparece acá.
                </p>
            </div>
        );
    }

    return (
        <ul className="space-y-3">
            {filas.map((f, i) => (
                <li
                    key={`${f.profesionalId}:${f.requisitoClave}`}
                    className="anim-entrada"
                    style={{ animationDelay: `${i * 40}ms` }}
                >
                    <Link
                        href={`/dashboard/admin/verificacion/documento-nuevo/${f.profesionalId}/${f.requisitoClave}`}
                        className="glass block rounded-2xl p-5 transition hover:scale-[1.005] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cielo"
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <div>
                                <p className="titular-seccion">{f.nombreVisible}</p>
                                <p className="cuerpo text-subtle">
                                    {f.tituloProfesional} · {f.ciudadNombre}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="microetiqueta">Esperando</p>
                                <p className="cifra text-body">{tiempoRelativo(f.subidoEn)}</p>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-tinta/5 px-3 py-1 text-xs text-body">
                                Reemplazó <strong className="font-semibold">{f.requisitoNombre}</strong>
                            </span>
                            {/* La insignia que cambia la decisión: esta persona está viéndose con familias ahora. */}
                            <span className="rounded-full bg-pino/10 px-3 py-1 text-xs font-medium text-estado-pino">
                                Atendiendo
                            </span>
                        </div>
                        {venceProximo(f.venceEn) && (
                            // Aviso de agenda, no alarma de protección: ámbar, sin rubí (D-120).
                            <p className="mt-3 text-xs text-estado-ambar">
                                Su verificación vence el {fechaCorta(f.venceEn!)}.
                            </p>
                        )}
                    </Link>
                </li>
            ))}
        </ul>
    );
}
