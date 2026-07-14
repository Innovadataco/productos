"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function RegistroForm({
    onSolicitarCodigo,
}: {
    onSolicitarCodigo: (email: string) => Promise<void>;
}) {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
            setError("Ingresa tu correo electrónico.");
            return;
        }
        setError("");
        setIsLoading(true);
        try {
            await onSolicitarCodigo(email.trim());
        } catch {
            setError("No se pudo enviar el código. Intenta de nuevo.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input
                label="Correo electrónico"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" isLoading={isLoading} className="w-full">
                Enviar código de verificación
            </Button>
        </form>
    );
}