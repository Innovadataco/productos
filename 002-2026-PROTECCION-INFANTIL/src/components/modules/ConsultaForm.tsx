"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ConsultaForm({
    onSearch,
    compact = false,
}: {
    onSearch: (identificador: string) => void;
    compact?: boolean;
}) {
    const [identificador, setIdentificador] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!identificador.trim()) {
            setError("Ingresa el número, nick o usuario que quieres consultar.");
            return;
        }
        setError("");
        onSearch(identificador.trim());
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1">
                <Input
                    label={compact ? undefined : "Número, nick o usuario"}
                    placeholder="Ej: +573001234567"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    error={error}
                />
            </div>
            <Button type="submit" className="sm:w-auto">Buscar</Button>
        </form>
    );
}
