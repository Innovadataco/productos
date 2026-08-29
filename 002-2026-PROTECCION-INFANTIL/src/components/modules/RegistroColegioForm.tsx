"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function RegistroColegioForm({
    onSolicitarCodigo,
}: {
    onSolicitarCodigo: (data: { email: string; nombreColegio: string; nombreRector: string }) => Promise<void>;
}) {
    const [email, setEmail] = useState("");
    const [nombreColegio, setNombreColegio] = useState("");
    const [nombreRector, setNombreRector] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !nombreColegio.trim() || !nombreRector.trim()) {
            setError("Completa todos los campos.");
            return;
        }
        setError("");
        setIsLoading(true);
        try {
            await onSolicitarCodigo({
                email: email.trim(),
                nombreColegio: nombreColegio.trim(),
                nombreRector: nombreRector.trim(),
            });
        } catch {
            setError("No se pudo enviar el código. Intenta de nuevo.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input
                label="Correo electrónico del rector"
                type="email"
                placeholder="rector@colegio.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            <Input
                label="Nombre del colegio"
                placeholder="Ej: Instituto Pedagógico Nacional"
                value={nombreColegio}
                onChange={(e) => setNombreColegio(e.target.value)}
            />
            <Input
                label="Nombre del rector"
                placeholder="Ej: Carlos Rodríguez"
                value={nombreRector}
                onChange={(e) => setNombreRector(e.target.value)}
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <Button type="submit" isLoading={isLoading} className="w-full">
                Enviar código de verificación
            </Button>
        </form>
    );
}
