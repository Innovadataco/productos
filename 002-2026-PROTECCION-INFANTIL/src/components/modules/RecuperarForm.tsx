"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

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
        // SPEC-623 (I-376) · un ÚNICO estado de éxito, IDÉNTICO para todo correo (inexistente o
        // registrado). Es deliberadamente ciego a `metodo`/`message`/`emailSent`: personalizarlo
        // confirmaría que ese correo tiene cuenta, y en protección infantil saber que un correo está
        // registrado puede delatar que un padre denunció (la EXISTENCIA de la cuenta es el dato sensible).
        // SPEC-647 (D-136): Google salió del producto — ya no hay una «puerta de Google» que ofrecer
        // aquí; el estado de éxito queda con su único mensaje genérico, que es lo que preserva la
        // no-enumeración.
        return (
            <div className="space-y-6 text-center" data-testid="recuperar-exito">
                <p className="text-sm text-muted">
                    Si el correo está registrado, te enviamos un enlace para cambiar tu contraseña (revisa también spam).
                </p>
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
