"use client";

/**
 * SPEC-391 (A-75 · L1b) — la puerta del profesional: registro por ENLACE.
 * Mismo patrón que /registro (padre): el profesional deja SOLO su correo,
 * recibe un enlace y elige su contraseña en /registro-profesional/crear-clave/[token].
 *
 * Anti-enumeración (SPEC-338): la pantalla de aviso es idéntica exista o no el
 * correo; el aviso real viaja al buzón. Voz voseo consistente con el resto.
 */
import { useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";

export default function RegistroProfesionalPage() {
    const [step, setStep] = useState<"correo" | "aviso">("correo");
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [reenviado, setReenviado] = useState(false);

    const solicitar = async (emailValue: string) => {
        const res = await fetch("/api/auth/registro-profesional/solicitar", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailValue }),
        });
        if (!res.ok) {
            const json = await res.json().catch(() => null);
            throw new Error(json?.error?.message || "No pudimos enviar el enlace. Intente de nuevo.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const valor = email.trim();
        if (!valor) {
            setError("Escriba su correo.");
            return;
        }
        setError("");
        setEnviando(true);
        try {
            await solicitar(valor);
            setEmail(valor);
            setStep("aviso");
            setReenviado(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos enviar el enlace. Intente de nuevo.");
        } finally {
            setEnviando(false);
        }
    };

    const handleReenviar = async () => {
        setEnviando(true);
        setError("");
        try {
            await solicitar(email);
            setReenviado(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos reenviar el enlace. Intente de nuevo.");
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
                                Sumate a la Red de Profesionales.
                            </h1>
                            <p className="mt-2 text-sm text-muted">
                                Déjenos su correo y le enviamos un enlace para crear su cuenta.
                                Después completa su perfil y sube su autorización.
                            </p>
                        </div>

                        <GlassCard>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input
                                    label="Su correo"
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
                            ¿Ya tiene cuenta?{" "}
                            <Link href="/login" className="font-medium text-accent hover:underline">
                                Inicie sesión
                            </Link>
                        </p>
                    </>
                ) : (
                    <>
                        <div className="mb-6 text-center">
                            <h1 className="font-serif text-3xl text-body">Le escribimos</h1>
                            <p className="mt-2 text-sm text-muted">
                                Enviamos un enlace a <strong className="text-body">{email}</strong>.
                                Ábralo y cree su contraseña.
                            </p>
                        </div>

                        <GlassCard>
                            <div className="space-y-4 text-center">
                                <p className="text-sm text-muted">
                                    Si no lo ve en unos minutos, mire en <strong>correo no deseado</strong>.
                                    El enlace vence en 24 horas.
                                </p>
                                {reenviado && (
                                    <Alerta tono="exito" className="text-center">
                                        Listo, se lo enviamos de nuevo.
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
                                    Escriba otro correo
                                </button>
                            </div>
                        </GlassCard>
                    </>
                )}
            </div>
        </main>
    );
}
