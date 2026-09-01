"use client";

/**
 * SPEC-339 (A-67 §2.1) — La puerta del padre: registro por ENLACE.
 *
 * Antes: código OTP de 6 dígitos en 3 pasos (transcribir). Ahora: el padre deja
 * SOLO su correo, recibe un enlace y elige su contraseña al abrirlo
 * (/registro/crear-clave/[token]). Jelkin: "padres adultos que de pronto no son
 * muy cercanos a la tecnología... cuatro o cinco clic".
 *
 * El registro de COLEGIO no cambia: /registro-colegio sigue con su código de
 * 6 dígitos y sus rutas /api/auth/verificar/* intactas.
 *
 * Anti-enumeración (SPEC-338): la pantalla de aviso es idéntica exista o no el
 * correo; el feedback real viaja al buzón.
 *
 * Voz: tuteo neutro colombiano, serena y cercana (brief §3 · decisión CEO D-1).
 */
import { useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";

export default function RegistroPage() {
    const [step, setStep] = useState<"correo" | "aviso">("correo");
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [reenviado, setReenviado] = useState(false);

    const solicitarEnlace = async (emailValue: string) => {
        const res = await fetch("/api/auth/registro/solicitar", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailValue }),
        });
        if (!res.ok) {
            const json = await res.json().catch(() => null);
            throw new Error(json?.error?.message || "No pudimos enviar el enlace. Intenta de nuevo.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const valor = email.trim();
        if (!valor) {
            setError("Escribe tu correo.");
            return;
        }
        setError("");
        setEnviando(true);
        try {
            await solicitarEnlace(valor);
            setEmail(valor);
            setStep("aviso");
            setReenviado(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos enviar el enlace. Intenta de nuevo.");
        } finally {
            setEnviando(false);
        }
    };

    const handleReenviar = async () => {
        setEnviando(true);
        setError("");
        try {
            await solicitarEnlace(email);
            setReenviado(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos reenviar el enlace. Intenta de nuevo.");
        } finally {
            setEnviando(false);
        }
    };

    return (
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
            <div className="w-full max-w-md animate-fadeIn">
                {step === "correo" ? (
                    <>
                        <div className="mb-6 text-center">
                            <h1 className="font-serif text-3xl text-body">
                                Estás para cuidarlos. Nosotros, para avisarte.
                            </h1>
                            <p className="mt-2 text-sm text-muted">
                                Déjanos tu correo y te enviamos un enlace para crear tu cuenta. Toma un minuto.
                            </p>
                        </div>

                        <GlassCard>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input
                                    label="Tu correo"
                                    type="email"
                                    placeholder="tucorreo@ejemplo.com"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                                {error && (
                                    <Alerta tono="advertencia" className="text-center">
                                        {error}
                                    </Alerta>
                                )}
                                <Button type="submit" isLoading={enviando} className="w-full">
                                    Continuar
                                </Button>
                            </form>
                        </GlassCard>

                        <p className="mt-4 text-center text-sm text-muted">
                            ¿Ya tienes cuenta?{" "}
                            <Link href="/login" className="font-medium text-accent hover:underline">
                                Inicia sesión
                            </Link>
                        </p>
                    </>
                ) : (
                    <>
                        <div className="mb-6 text-center">
                            <h1 className="font-serif text-3xl text-body">Te escribimos</h1>
                            <p className="mt-2 text-sm text-muted">
                                Enviamos un enlace a <strong className="text-body">{email}</strong>.
                                Ábrelo y crea tu contraseña.
                            </p>
                        </div>

                        <GlassCard>
                            <div className="space-y-4 text-center">
                                <p className="text-sm text-muted">
                                    Si no lo ves en unos minutos, mira en <strong>correo no deseado</strong>.
                                    El enlace vence en 24 horas.
                                </p>
                                {reenviado && (
                                    <Alerta tono="exito" className="text-center">
                                        Listo, te lo enviamos de nuevo.
                                    </Alerta>
                                )}
                                {error && (
                                    <Alerta tono="advertencia" className="text-center">
                                        {error}
                                    </Alerta>
                                )}
                                <Button onClick={handleReenviar} isLoading={enviando} variant="secondary" className="w-full">
                                    Enviar de nuevo
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep("correo");
                                        setError("");
                                    }}
                                    className="text-sm font-medium text-accent hover:underline"
                                >
                                    Escribe otro correo
                                </button>
                            </div>
                        </GlassCard>
                    </>
                )}
            </div>
        </main>
    );
}
