"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function LoginForm({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password) {
            setError("Ingresa email y contraseña.");
            return;
        }
        setError("");
        setIsLoading(true);
        try {
            await onLogin(email.trim(), password);
        } catch {
            setError("Credenciales incorrectas.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input
                label="Correo electrónico"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            <div>
                <Input
                    label="Contraseña"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <div className="mt-1.5 text-right">
                    <Link href="/recuperar" className="text-xs font-medium text-primary-600 hover:underline">
                        ¿Olvidaste tu contraseña?
                    </Link>
                </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" isLoading={isLoading} className="w-full">
                Iniciar sesión
            </Button>
        </form>
    );
}