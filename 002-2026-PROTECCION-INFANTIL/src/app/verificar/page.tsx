"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/**
 * SPEC-532 (I-327) · índice público de verificación del sello del PDF. Hasta ahora
 * solo existía `/verificar/[codigo]`; `/verificar` sin código daba 404, así que la
 * verificación era inalcanzable si no se conocía la URL exacta. Acá se pega el
 * código impreso al pie del documento y se navega a `/verificar/<codigo>`.
 */
export default function VerificarIndexPage() {
    const router = useRouter();
    const [codigo, setCodigo] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const limpio = codigo.trim();
        if (!limpio) {
            setError("Pega el código impreso al pie del documento.");
            return;
        }
        setError("");
        router.push(`/verificar/${encodeURIComponent(limpio)}`);
    };

    return (
        <main className="mx-auto max-w-2xl px-4 py-12 text-body">
            <h1 className="text-2xl font-bold">Verificación del informe</h1>
            <p className="mt-2 text-sm text-muted">
                Comprueba que un informe generado por Protección Infantil existe en el
                sistema. Basta con el código impreso al pie del documento.
            </p>

            <form
                onSubmit={handleSubmit}
                className="glass mt-6 flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-start"
            >
                <div className="flex-1">
                    <Input
                        label="Código del informe"
                        placeholder="Pega aquí el código"
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value)}
                        error={error}
                    />
                </div>
                <Button type="submit" className="sm:w-auto">
                    Verificar
                </Button>
            </form>
        </main>
    );
}
