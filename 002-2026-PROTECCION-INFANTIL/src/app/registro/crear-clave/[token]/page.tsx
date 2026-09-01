"use client";

/**
 * SPEC-339 (A-67 §2.1) — El padre abrió el enlace: elige su contraseña.
 *
 * Las dos condiciones VISIBLES (brief §2.1): 8 caracteres · coinciden. El botón
 * queda apagado hasta cumplirlas. Enlace usado o vencido: mensaje sereno con la
 * salida a pedir uno nuevo — nunca un callejón (brief §2.6).
 *
 * Pública por herencia de /registro (las rutas se comparan por segmento).
 */
import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";

export default function CrearClavePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmacion, setConfirmacion] = useState("");
    const [error, setError] = useState("");
    const [enlaceMuerto, setEnlaceMuerto] = useState(false);
    const [enviando, setEnviando] = useState(false);

    // Las dos condiciones del brief, siempre a la vista.
    const largoOk = password.length >= 8;
    const coincidenOk = password.length > 0 && password === confirmacion;
    // Estándar del sitio (mismo criterio que el esquema del servidor).
    const contenidoOk = /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
    const listo = useMemo(() => largoOk && coincidenOk && contenidoOk, [largoOk, coincidenOk, contenidoOk]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!listo) return;
        setError("");
        setEnviando(true);
        try {
            const res = await fetch("/api/auth/registro/completar", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password, passwordConfirmacion: confirmacion }),
            });
            if (res.status === 410 || res.status === 409) {
                const json = await res.json().catch(() => null);
                setEnlaceMuerto(true);
                setError(json?.error?.message ?? "Este enlace ya no sirve.");
                return;
            }
            if (!res.ok) {
                const json = await res.json().catch(() => null);
                throw new Error(json?.error?.message || "No pudimos crear tu cuenta. Intenta de nuevo.");
            }
            // Cuenta creada, sesión iniciada, cookie sellada: el camino arranca.
            // router.push respeta el guardián: el middleware lo lleva al Paso 1.
            router.push("/dashboard/padre");
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos crear tu cuenta. Intenta de nuevo.");
        } finally {
            setEnviando(false);
        }
    };

    return (
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
            <div className="w-full max-w-md animate-fadeIn">
                <div className="mb-6 text-center">
                    <h1 className="font-serif text-3xl text-body">Elige tu contraseña</h1>
                    <p className="mt-2 text-sm text-muted">Con esto queda lista tu cuenta.</p>
                </div>

                <GlassCard>
                    {enlaceMuerto ? (
                        <div className="space-y-4 text-center">
                            <Alerta tono="advertencia" className="text-center">
                                {error}
                            </Alerta>
                            <Link href="/registro" className="block">
                                <Button variant="secondary" className="w-full">
                                    Pedir un enlace nuevo
                                </Button>
                            </Link>
                            <p className="text-sm text-muted">
                                ¿Ya tienes cuenta?{" "}
                                <Link href="/login" className="font-medium text-accent hover:underline">
                                    Inicia sesión
                                </Link>
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label="Contraseña"
                                type="password"
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <Input
                                label="Repítela"
                                type="password"
                                autoComplete="new-password"
                                value={confirmacion}
                                onChange={(e) => setConfirmacion(e.target.value)}
                            />

                            {/* Las dos condiciones del brief, visibles siempre. */}
                            <ul className="space-y-1 text-sm" aria-live="polite">
                                <li className={largoOk && contenidoOk ? "text-accent" : "text-muted"}>
                                    {largoOk && contenidoOk ? "✓" : "○"} Al menos 8 caracteres, con una letra y un número
                                </li>
                                <li className={coincidenOk ? "text-accent" : "text-muted"}>
                                    {coincidenOk ? "✓" : "○"} Las dos coinciden
                                </li>
                            </ul>

                            {error && (
                                <Alerta tono="advertencia" className="text-center">
                                    {error}
                                </Alerta>
                            )}

                            <Button type="submit" isLoading={enviando} disabled={!listo} className="w-full">
                                Guardar y empezar
                            </Button>
                        </form>
                    )}
                </GlassCard>
            </div>
        </main>
    );
}
