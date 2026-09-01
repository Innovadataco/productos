"use client";

/**
 * SPEC-344 (A-69 · C1) — La puerta del colegio: registro por ENLACE.
 *
 * Antes: código OTP de 6 dígitos en 2 pasos (transcribir). Ahora: el rector
 * deja correo + nombre del colegio + NIT, recibe un enlace y crea su clave
 * al abrirlo (`/registro-colegio/crear-clave/[token]`). Mockup A-69 v3 · 1.1.
 *
 * Anti-enumeración por AMBAS dimensiones (correo Y NIT — matiz CEO 03:18):
 * la pantalla de aviso es idéntica en las cuatro combinaciones; el feedback
 * real viaja al buzón.
 *
 * Voz: usted formal Colombia (brief §0).
 */
import { useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";

export default function RegistroColegioPage() {
    const [step, setStep] = useState<"solicitar" | "aviso">("solicitar");
    const [email, setEmail] = useState("");
    const [nombreColegio, setNombreColegio] = useState("");
    const [nit, setNit] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [reenviado, setReenviado] = useState(false);

    const solicitarEnlace = async (payload: { email: string; nombreColegio: string; nit: string }) => {
        const res = await fetch("/api/auth/registro-colegio/solicitar", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const json = await res.json().catch(() => null);
            throw new Error(json?.error?.message || "No pudimos enviar el enlace. Intente de nuevo.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const eValor = email.trim();
        const cValor = nombreColegio.trim();
        const nValor = nit.trim();
        if (!eValor) {
            setError("Escriba su correo.");
            return;
        }
        if (cValor.length < 2) {
            setError("Escriba el nombre del colegio.");
            return;
        }
        if (!nValor) {
            setError("Escriba el NIT del colegio.");
            return;
        }
        setError("");
        setEnviando(true);
        try {
            await solicitarEnlace({ email: eValor, nombreColegio: cValor, nit: nValor });
            setEmail(eValor);
            setNombreColegio(cValor);
            setNit(nValor);
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
            await solicitarEnlace({ email, nombreColegio, nit });
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
                {step === "solicitar" ? (
                    <>
                        <div className="mb-6 text-center">
                            <h1 className="font-serif text-3xl text-body">
                                Su colegio, cuidando a sus estudiantes.
                            </h1>
                            <p className="mt-2 text-sm text-muted">
                                Deje sus datos y le enviamos un enlace para crear la contraseña.
                                Sin códigos que copiar.
                            </p>
                        </div>

                        <GlassCard>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input
                                    label="Correo del rector"
                                    type="email"
                                    placeholder="rectoria@sucolegio.edu.co"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                                <Input
                                    label="Nombre del colegio"
                                    type="text"
                                    placeholder="Colegio Sagrado Corazón"
                                    value={nombreColegio}
                                    onChange={(e) => setNombreColegio(e.target.value)}
                                />
                                <Input
                                    label="NIT de la institución"
                                    type="text"
                                    placeholder="901.455.302-7"
                                    value={nit}
                                    onChange={(e) => setNit(e.target.value)}
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
                                        setStep("solicitar");
                                        setError("");
                                    }}
                                    className="text-sm font-medium text-accent hover:underline"
                                >
                                    Este no es mi correo
                                </button>
                            </div>
                        </GlassCard>
                    </>
                )}
            </div>
        </main>
    );
}
