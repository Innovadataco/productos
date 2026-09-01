"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alerta } from "@/components/ui/Alerta";
import type { RolUsuario } from "@prisma/client";
import type { TipoDocumentoConsentimiento } from "@/lib/dal/services/consentimiento";

interface ModalConsentimientoProps {
    /** SPEC-339: "Paso 1 de 4 · Permiso" cuando la pantalla es parte del camino
     *  guiado del padre. El modal NO se rehace (brief §2.2): solo gana el rótulo. */
    indicadorPaso?: string;
    rol: RolUsuario;
    documentoTipo: TipoDocumentoConsentimiento;
    documentoContenido: string;
    redirectUrl: string;
}

const THEME_POR_ROL: Record<string, string> = {
    PARENT: "theme-padre",
    SCHOOL_ADMIN: "theme-colegio",
    COMITE_CONVIVENCIA: "theme-colegio",
    ADMIN: "theme-admin",
    OPERADOR: "theme-admin",
    COMITE_VALIDACION: "theme-admin",
};

const TITULO_POR_ROL: Record<string, string> = {
    PARENT: "Antes de continuar",
    SCHOOL_ADMIN: "Antes de continuar",
    COMITE_CONVIVENCIA: "Antes de continuar",
    ADMIN: "Antes de continuar",
    OPERADOR: "Antes de continuar",
    COMITE_VALIDACION: "Antes de continuar",
};

export function ModalConsentimiento({
    rol,
    documentoTipo,
    documentoContenido,
    redirectUrl,
    indicadorPaso,
}: ModalConsentimientoProps) {
    const router = useRouter();
    const scrollRef = useRef<HTMLDivElement>(null);
    const finalRef = useRef<HTMLDivElement>(null);
    const [scrollCompleto, setScrollCompleto] = useState(false);
    const [representanteLegal, setRepresentanteLegal] = useState(false);
    const [aceptaPolitica, setAceptaPolitica] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const esColegio = documentoTipo === "CONVENIO_INSTITUCIONAL";

    useEffect(() => {
        if (!finalRef.current || !scrollRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setScrollCompleto(true);
                    }
                });
            },
            { root: scrollRef.current, threshold: 0.5 }
        );

        observer.observe(finalRef.current);
        return () => observer.disconnect();
    }, []);

    const handleAceptar = useCallback(async () => {
        if (!scrollCompleto || !representanteLegal || !aceptaPolitica) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/consentimiento/aceptar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    documentoTipo,
                    esRepresentanteLegal: true,
                }),
            });

            const data = (await res.json().catch(() => ({ error: { message: "Error de red" } }))) as {
                ok?: boolean;
                error?: { message?: string };
            };

            if (!res.ok) {
                setError(data.error?.message ?? "No se pudo registrar la aceptación");
                return;
            }

            router.push(redirectUrl);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error de red";
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [scrollCompleto, representanteLegal, aceptaPolitica, documentoTipo, redirectUrl, router]);

    const puedeAceptar = scrollCompleto && representanteLegal && aceptaPolitica;
    const theme = THEME_POR_ROL[rol] ?? "theme-padre";

    return (
        <div className={`${theme} min-h-screen bg-page`}>
            <main className="flex min-h-screen items-center justify-center px-4 py-8">
                <GlassCard className="w-full max-w-2xl">
                    {indicadorPaso && (
                        <p className="mb-2 text-sm font-medium text-muted">{indicadorPaso}</p>
                    )}
                    <h1 className="text-2xl font-bold text-body">{TITULO_POR_ROL[rol]}</h1>
                    <p className="mt-2 text-sm text-muted">
                        Debes leer el documento completo y aceptar los términos para continuar.
                    </p>

                    <div
                        ref={scrollRef}
                        className="mt-6 max-h-[50vh] overflow-y-auto rounded-xl border border-tinta/10 bg-papel/50 p-4 text-sm text-body dark:bg-tinta/50"
                    >
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                            {/* Sin rehype-raw: el HTML embebido se escapa como texto (FR-009).
                                Tablas envueltas para scroll propio en móvil (FR-010). */}
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    table: ({ children }) => (
                                        <div className="overflow-x-auto">
                                            <table>{children}</table>
                                        </div>
                                    ),
                                }}
                            >
                                {documentoContenido}
                            </ReactMarkdown>
                        </div>
                        <div ref={finalRef} className="h-2" aria-hidden="true" />
                    </div>

                    <div className="mt-6 space-y-4">
                        <label className="flex items-start gap-3">
                            <input
                                type="checkbox"
                                checked={representanteLegal}
                                onChange={(e) => setRepresentanteLegal(e.target.checked)}
                                className="mt-1 h-4 w-4 accent-cielo"
                                data-testid="check-representante"
                            />
                            <span className="text-sm text-body">
                                {esColegio
                                    ? "Firmo como representante legal del colegio"
                                    : "Declaro ser padre o tutor legal del menor"}
                            </span>
                        </label>

                        <label className="flex items-start gap-3">
                            <input
                                type="checkbox"
                                checked={aceptaPolitica}
                                onChange={(e) => setAceptaPolitica(e.target.checked)}
                                className="mt-1 h-4 w-4 accent-cielo"
                                data-testid="check-politica"
                            />
                            <span className="text-sm text-body">
                                Acepto la política de tratamiento de datos personales
                            </span>
                        </label>
                    </div>

                    {error && (
                        <div className="mt-4">
                            <Alerta tono="error">{error}</Alerta>
                        </div>
                    )}

                    <div className="mt-6 flex items-center justify-end gap-3">
                        <Button
                            onClick={handleAceptar}
                            disabled={!puedeAceptar || loading}
                            isLoading={loading}
                            data-testid="btn-aceptar"
                        >
                            Acepto
                        </Button>
                    </div>
                </GlassCard>
            </main>
        </div>
    );
}
