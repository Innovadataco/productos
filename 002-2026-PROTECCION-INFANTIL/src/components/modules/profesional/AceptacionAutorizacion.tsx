"use client";

/**
 * SPEC-686 (I-420) · Pantalla de ACEPTACIÓN de la autorización del profesional.
 * FORMA de Diseño (16-09): mismo patrón de lectura que el consentimiento del padre
 * (bajar hasta el final habilita) pero UNA casilla (la declaración verbatim) y el texto
 * legal versionado. Dos entradas, mismo componente: A) paso previo a verificarse ·
 * B) guard cuando cambia una versión DE FONDO (encabezado con `avisoReAceptacion`).
 * Voz «usted» (D-107). Primario del sistema, sin rubí (el peso lo carga el texto).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";

interface AceptacionAutorizacionProps {
    version: string;
    documentoContenido: string;
    /** A dónde volver tras aceptar (navegación dura, como el consentimiento del padre). */
    redirectUrl: string;
    /** B · re-aceptación por cambio DE FONDO: línea arriba del texto. */
    avisoReAceptacion?: boolean;
    /** SPEC-686 §2: «Leer la autorización» — reabre el texto en SOLO LECTURA (sin aceptar). */
    soloLectura?: boolean;
}

// La declaración es TEXTO LEGAL verbatim (borrador §Declaración) — no se edita acá.
const DECLARACION =
    "Declaro que la información y los documentos que cargo son verídicos, y autorizo a " +
    "INNOVADATACO S.A.S. a verificar mi identidad, mi habilitación profesional y mis " +
    "antecedentes, y a tratar mis datos en los términos de esta autorización.";

export function AceptacionAutorizacion({
    version,
    documentoContenido,
    redirectUrl,
    avisoReAceptacion,
    soloLectura,
}: AceptacionAutorizacionProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const finalRef = useRef<HTMLDivElement>(null);
    const [scrollCompleto, setScrollCompleto] = useState(false);
    const [declaraVerdad, setDeclaraVerdad] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Medida DIRECTA de fin-de-scroll (I-256/SPEC-358: no depender solo del observer).
    const marcarSiLlegoAlFinal = useCallback(() => {
        const cont = scrollRef.current;
        if (!cont || cont.clientHeight === 0) return;
        const llego = cont.scrollTop + cont.clientHeight >= cont.scrollHeight - 24;
        const sinScroll = cont.scrollHeight <= cont.clientHeight + 24;
        if (llego || sinScroll) setScrollCompleto(true);
    }, []);

    useEffect(() => {
        marcarSiLlegoAlFinal();
        window.addEventListener("resize", marcarSiLlegoAlFinal);
        let observer: IntersectionObserver | undefined;
        if (finalRef.current && scrollRef.current && typeof IntersectionObserver !== "undefined") {
            observer = new IntersectionObserver(
                (entries) => entries.forEach((e) => e.isIntersecting && setScrollCompleto(true)),
                { root: scrollRef.current, threshold: 0.5 },
            );
            observer.observe(finalRef.current);
        }
        return () => {
            window.removeEventListener("resize", marcarSiLlegoAlFinal);
            observer?.disconnect();
        };
    }, [marcarSiLlegoAlFinal]);

    useEffect(() => {
        const id = setTimeout(marcarSiLlegoAlFinal, 150);
        return () => clearTimeout(id);
    }, [documentoContenido, marcarSiLlegoAlFinal]);

    const puedeAceptar = scrollCompleto && declaraVerdad;

    const handleAceptar = useCallback(async () => {
        if (!puedeAceptar) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/profesional/autorizacion/aceptar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            const data = (await res.json().catch(() => ({ error: { message: "Error de red" } }))) as {
                error?: { message?: string };
            };
            if (!res.ok) {
                setError(data.error?.message ?? "No se pudo registrar la aceptación.");
                return;
            }
            // Navegación DURA (igual que el consentimiento del padre): que el guard/portero
            // decida con el estado ya actualizado.
            window.location.assign(redirectUrl);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error de red");
        } finally {
            setLoading(false);
        }
    }, [puedeAceptar, redirectUrl]);

    return (
        <div className="theme-profesional min-h-screen bg-page">
            <main className="flex min-h-screen items-center justify-center px-4 py-8">
                <GlassCard className="w-full max-w-2xl">
                    <h1 className="text-2xl font-bold text-body">Autorización del profesional</h1>
                    {avisoReAceptacion ? (
                        <div className="mt-3">
                            <Alerta tono="info">
                                La autorización cambió. Léala y acéptela de nuevo para seguir atendiendo.
                            </Alerta>
                        </div>
                    ) : soloLectura ? (
                        <p className="mt-2 text-sm text-muted">Esta es la autorización que usted aceptó.</p>
                    ) : (
                        <p className="mt-2 text-sm text-muted">
                            Lea el texto completo y acéptelo para que la Plataforma pueda verificar sus
                            antecedentes y habilitar su perfil.
                        </p>
                    )}

                    <div className="relative">
                        <div
                            ref={scrollRef}
                            onScroll={marcarSiLlegoAlFinal}
                            data-testid="autorizacion-scroll"
                            className="mt-6 max-h-[50vh] overflow-y-auto rounded-xl border border-tinta/10 bg-superficie-1 p-4 text-sm text-body dark:border-tinta/12"
                        >
                            <div className="prose prose-sm max-w-none dark:prose-invert">
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
                        {!scrollCompleto && (
                            <div
                                data-testid="senal-scroll"
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 rounded-b-xl bg-gradient-to-t from-papel via-papel/80 to-transparent pb-2 pt-8 dark:from-tinta dark:via-tinta/80"
                            >
                                <span className="text-xs font-medium text-muted">
                                    Baje hasta el final del texto para poder aceptar
                                </span>
                                <svg className="h-5 w-5 animate-bounce text-cielo motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 5v14M5 12l7 7 7-7" />
                                </svg>
                            </div>
                        )}
                    </div>

                    {soloLectura ? (
                        <div className="mt-6 flex items-center justify-between">
                            <span className="text-xs text-muted">Versión {version}</span>
                            <a
                                href={redirectUrl}
                                className="text-sm font-medium text-body underline underline-offset-2"
                            >
                                Volver
                            </a>
                        </div>
                    ) : (
                        <>
                            <label className="mt-6 flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={declaraVerdad}
                                    onChange={(e) => setDeclaraVerdad(e.target.checked)}
                                    className="mt-1 h-4 w-4 accent-cielo"
                                    data-testid="check-declaracion"
                                />
                                <span className="text-sm text-body">{DECLARACION}</span>
                            </label>

                            {error && (
                                <div className="mt-4">
                                    <Alerta tono="error">{error}</Alerta>
                                </div>
                            )}

                            <div className="mt-6 flex flex-col items-end gap-2">
                                <Button
                                    onClick={handleAceptar}
                                    disabled={!puedeAceptar || loading}
                                    isLoading={loading}
                                    data-testid="btn-aceptar-autorizacion"
                                >
                                    Acepto la autorización
                                </Button>
                                {/* Decir POR QUÉ está inerte (lección del wizard) — desaparece al cumplir ambos. */}
                                {!puedeAceptar && (
                                    <span className="text-xs text-muted">
                                        Baje hasta el final del texto y marque la casilla para aceptar.
                                    </span>
                                )}
                                <span className="text-xs text-muted">Versión {version}</span>
                            </div>
                        </>
                    )}
                </GlassCard>
            </main>
        </div>
    );
}
