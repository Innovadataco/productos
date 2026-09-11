"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { BotonContinuaConGoogle } from "@/components/modules/BotonContinuaConGoogle";

export function RecuperarForm() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !trimmed.includes("@")) {
            setError("Ingresa un correo electrónico válido.");
            return;
        }
        setError("");
        setIsLoading(true);
        try {
            const res = await fetch("/api/auth/recuperar/solicitar", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: trimmed }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => null);
                throw new Error(json?.error?.message || "Error al solicitar recuperación");
            }
            // SPEC-623 (I-376): NO se lee el cuerpo para decidir qué mostrar — ver el bloque de éxito.
            setSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo enviar la solicitud. Intenta de nuevo.");
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        // SPEC-623 (I-376) · un ÚNICO estado de éxito, IDÉNTICO para los tres casos (correo inexistente,
        // cuenta con clave local, cuenta de Google). Es deliberadamente ciego a `metodo`/`message`/
        // `emailSent`: personalizarlo —p.ej. «tu cuenta es de Google»— confirmaría que ese correo tiene
        // cuenta en la plataforma, y en protección infantil saber que un correo está registrado puede
        // delatar que un padre denunció (la EXISTENCIA de la cuenta es el dato sensible). Las dos
        // salidas se ofrecen en CONDICIONAL («si…»): el padre de Google se reconoce y encuentra su
        // puerta; quien sondea un correo ajeno no aprende nada. La mitad de seguridad de SPEC-609
        // sigue: a una cuenta de Google la API no le encola ningún correo — acá solo se arregla que el
        // padre ya no queda varado esperándolo.
        return (
            <div className="space-y-6 text-center" data-testid="recuperar-exito">
                <p className="text-sm text-muted">
                    Si el correo está registrado, te enviamos un enlace para cambiar tu contraseña (revisa también spam).
                </p>
                {/* SPEC-623: `space-y-6` afuera separa las DOS salidas; `space-y-3` adentro liga la línea
                    de Google a su botón (si no, el botón flota equidistante entre las dos). Diseño 10-09. */}
                <div className="space-y-3">
                    <p className="text-sm text-muted">
                        Si tu cuenta es de Google, no usa contraseña — entra directo, sin nada que recordar.
                    </p>
                    <BotonContinuaConGoogle label="Entrar con Google" conSeparador={false} />
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input
                label="Correo electrónico"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
            />
            {error && <p className="text-sm text-estado-rubi">{error}</p>}
            <Button type="submit" isLoading={isLoading} className="w-full">
                Enviar enlace de recuperación
            </Button>
        </form>
    );
}
