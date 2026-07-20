"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function SeguimientoForm({
    onSearch,
    initialValue = "",
}: {
    onSearch: (numero: string) => void;
    initialValue?: string;
}) {
    const [numero, setNumero] = useState(initialValue);
    const [error, setError] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const clean = numero.trim().toUpperCase();
        if (!clean || !clean.startsWith("RPT-")) {
            setError("Ingresa un número de seguimiento válido, por ejemplo RPT-XXXXXX.");
            return;
        }
        setError("");
        onSearch(clean);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
                <Input
                    label="Número de seguimiento"
                    placeholder="RPT-XXXXXX"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value.toUpperCase())}
                    error={error}
                />
            </div>
            <Button type="submit" className="sm:w-auto">
                Consultar
            </Button>
        </form>
    );
}
