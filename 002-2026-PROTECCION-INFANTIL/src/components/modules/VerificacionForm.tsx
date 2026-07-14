"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function VerificacionForm({
    email,
    onCompletar,
}: {
    email: string;
    onCompletar: (data: { email: string; codigo: string; password: string; nombre: string }) => Promise<void>;
}) {
    const [codigo, setCodigo] = useState("");
    const [password, setPassword] = useState("");
    const [nombre, setNombre] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (codigo.length !== 6 || !password || password.length < 8 || !nombre.trim()) {
            setError("Completa todos los campos. La contraseña debe tener al menos 8 caracteres.");
            return;
        }
        setError("");
        setIsLoading(true);
        try {
            await onCompletar({ email, codigo, password, nombre: nombre.trim() });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al crear cuenta");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-600">
                Ingresa el código de 6 dígitos enviado a <strong>{email}</strong>
            </p>
            <Input
                label="Código de verificación"
                placeholder="123456"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            />
            <Input
                label="Tu nombre"
                placeholder="Ej: María García"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
            />
            <Input
                label="Contraseña"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" isLoading={isLoading} className="w-full">
                Crear cuenta
            </Button>
        </form>
    );
}