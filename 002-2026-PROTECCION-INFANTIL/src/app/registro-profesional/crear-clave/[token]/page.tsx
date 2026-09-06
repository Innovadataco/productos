"use client";

/**
 * SPEC-391 (A-75 · L1b) — el profesional abrió el enlace: elige su contraseña.
 * Copia estructural de /registro/crear-clave/[token]/page.tsx del padre; llama
 * al endpoint del profesional y redirige a /perfil-profesional/completar tras
 * crear la cuenta. Enlace muerto: mensaje sereno con salida a pedir uno nuevo.
 */
import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";

export default function CrearClaveProfesionalPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmacion, setConfirmacion] = useState("");
    const [error, setError] = useState("");
    const [enlaceMuerto, setEnlaceMuerto] = useState(false);
    const [enviando, setEnviando] = useState(false);

    const largoOk = password.length >= 8;
    const coincidenOk = password.length > 0 && password === confirmacion;
    const contenidoOk = /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
    const listo = useMemo(() => largoOk && coincidenOk && contenidoOk, [largoOk, coincidenOk, contenidoOk]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!listo) return;
        setError("");
        setEnviando(true);
        try {
            const res = await fetch("/api/auth/registro-profesional/completar", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password, passwordConfirmacion: confirmacion }),
            });
            if (res.status === 410 || res.status === 409 || res.status === 400) {
                const json = await res.json().catch(() => null);
                setEnlaceMuerto(true);
                setError(json?.error?.message ?? "Este enlace ya no sirve.");
                return;
            }
            if (!res.ok) {
                const json = await res.json().catch(() => null);
                throw new Error(json?.error?.message || "No pudimos crear su cuenta. Intente de nuevo.");
            }
            router.push("/perfil-profesional/completar");
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos crear su cuenta. Intente de nuevo.");
        } finally {
            setEnviando(false);
        }
    };

    return (
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
            <div className="w-full max-w-md animate-fadeIn">
                <div className="mb-6 text-center">
                    <h1 className="font-serif text-3xl text-body">Elija su contraseña</h1>
                    <p className="mt-2 text-sm text-muted">Con esto queda lista su cuenta y arma su perfil.</p>
                </div>

                <GlassCard>
                    {enlaceMuerto ? (
                        <div className="space-y-4 text-center">
                            <Alerta tono="advertencia" className="text-center">
                                {error}
                            </Alerta>
                            <Link href="/registro-profesional" className="block">
                                <Button variant="secondary" className="w-full">
                                    Pedir un enlace nuevo
                                </Button>
                            </Link>
                            <p className="text-sm text-muted">
                                ¿Ya tiene cuenta?{" "}
                                <Link href="/login" className="font-medium text-accent hover:underline">
                                    Inicie sesión
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
                                label="Repetila"
                                type="password"
                                autoComplete="new-password"
                                value={confirmacion}
                                onChange={(e) => setConfirmacion(e.target.value)}
                            />
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
                                Crear cuenta y armar perfil
                            </Button>
                        </form>
                    )}
                </GlassCard>
            </div>
        </main>
    );
}
