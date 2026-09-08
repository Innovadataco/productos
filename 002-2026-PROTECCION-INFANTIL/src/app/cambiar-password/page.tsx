"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Alerta } from "@/components/ui/Alerta";
import { Cargando } from "@/components/ui/Cargando";
import { homeParaRol } from "@/lib/auth/home-para-rol";

export default function CambiarPasswordPage() {
    const { user, isLoading, checkSession } = useAuth();
    const router = useRouter();
    const [passwordActual, setPasswordActual] = useState("");
    const [passwordNueva, setPasswordNueva] = useState("");
    const [passwordConfirmar, setPasswordConfirmar] = useState("");
    // SPEC-598 — cuentas OAuth sin contraseña local: el código de un solo uso
    // enviado a SU correo reemplaza a la «contraseña actual» que no existe.
    const [codigo, setCodigo] = useState("");
    const [codigoEnviado, setCodigoEnviado] = useState(false);
    const [enviandoCodigo, setEnviandoCodigo] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [aviso, setAviso] = useState("");
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/login");
        }
    }, [isLoading, user, router]);

    const modoCrear = !!user?.googleSub && !user?.passwordCreadaEn;

    const handleEnviarCodigo = async () => {
        setError("");
        setAviso("");
        setEnviandoCodigo(true);
        try {
            const res = await fetch("/api/auth/crear-password/codigo", {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message || "No pudimos enviar el código. Intente de nuevo.");
                return;
            }
            setCodigoEnviado(true);
            setAviso(`Enviamos un código a su correo. Vence en ${data.vigenciaMinutos ?? 10} minutos.`);
        } catch {
            setError("Error de red. Intente de nuevo.");
        } finally {
            setEnviandoCodigo(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (passwordNueva.length < 8) {
            setError("La nueva contraseña debe tener al menos 8 caracteres.");
            return;
        }
        if (passwordNueva !== passwordConfirmar) {
            setError("Las contraseñas nuevas no coinciden.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(
                modoCrear ? "/api/auth/crear-password" : "/api/auth/cambiar-password",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(
                        modoCrear
                            ? { codigo, passwordNueva, passwordConfirmar }
                            : { passwordActual, passwordNueva }
                    ),
                }
            );
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message || "Error al guardar la contraseña");
                return;
            }
            setSuccess(true);
            // SPEC-598: refrescar la sesión para que el menú pase a ofrecer
            // «Cambiar contraseña» (la cuenta ya tiene clave local propia).
            await checkSession();
            setTimeout(() => {
                // SPEC-319: fuente única rol→home. La copia local omitía
                // COMITE_VALIDACION y COMITE_CONVIVENCIA (el comité nace
                // debeCambiarPassword:true, así que ESTE es su camino real).
                window.location.href = homeParaRol(user?.rol);
            }, 1200);
        } catch {
            setError("Error de red. Intente de nuevo.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading || !user) {
        return (
            <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
                <Cargando texto="" />
            </main>
        );
    }

    return (
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
            <div className="w-full max-w-md animate-fadeIn">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-body">
                        <span className="text-gradient">{modoCrear ? "Crear contraseña" : "Cambiar contraseña"}</span>
                    </h1>
                    <p className="mt-2 text-sm text-muted">
                        {user.debeCambiarPassword
                            ? "Debe cambiar su contraseña temporal antes de continuar."
                            : modoCrear
                                ? "Defina una contraseña para también entrar con su correo. Enviamos un código de verificación a su correo; su sesión de Google sigue funcionando."
                                : "Actualice su contraseña de acceso."}
                    </p>
                </div>

                <GlassCard>
                    {success ? (
                        <Alerta tono="exito" role="status" className="p-4 text-center">
                            Contraseña {modoCrear ? "creada" : "actualizada"}. Redirigiendo...
                        </Alerta>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {modoCrear && (
                                <>
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            <Input
                                                label="Código de verificación"
                                                type="text"
                                                inputMode="numeric"
                                                value={codigo}
                                                onChange={(e) => setCodigo(e.target.value)}
                                                required
                                                autoComplete="one-time-code"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            isLoading={enviandoCodigo}
                                            onClick={handleEnviarCodigo}
                                            disabled={enviandoCodigo}
                                        >
                                            {codigoEnviado ? "Reenviar" : "Enviar código"}
                                        </Button>
                                    </div>
                                    {aviso && <Alerta tono="info">{aviso}</Alerta>}
                                </>
                            )}
                            {!modoCrear && (
                                <Input
                                    label="Contraseña actual"
                                    type="password"
                                    value={passwordActual}
                                    onChange={(e) => setPasswordActual(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                />
                            )}
                            <Input
                                label="Nueva contraseña"
                                type="password"
                                value={passwordNueva}
                                onChange={(e) => setPasswordNueva(e.target.value)}
                                required
                                autoComplete="new-password"
                            />
                            <Input
                                label="Confirmar nueva contraseña"
                                type="password"
                                value={passwordConfirmar}
                                onChange={(e) => setPasswordConfirmar(e.target.value)}
                                required
                                autoComplete="new-password"
                            />
                            {error && (
                                <Alerta tono="error">
                                    {error}
                                </Alerta>
                            )}
                            <Button type="submit" isLoading={isSubmitting} className="w-full">
                                {modoCrear ? "Crear contraseña" : "Guardar contraseña"}
                            </Button>
                        </form>
                    )}
                </GlassCard>
            </div>
        </main>
    );
}
