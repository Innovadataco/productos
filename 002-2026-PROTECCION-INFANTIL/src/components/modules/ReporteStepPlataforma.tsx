"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type PlataformaOption = { id: string; clave: string; nombre: string };

export function ReporteStepPlataforma({
    identificador,
    plataforma,
    otraPlataforma,
    onChange,
}: {
    identificador: string;
    plataforma: string;
    otraPlataforma: string;
    onChange: (v: {
        identificador: string;
        plataforma: string;
        otraPlataforma: string;
    }) => void;
}) {
    const [plataformas, setPlataformas] = useState<PlataformaOption[]>([]);
    const [otra, setOtra] = useState("");

    useEffect(() => {
        fetch("/api/plataformas", { credentials: "include" })
            .then((r) => r.json())
            .then((json) => setPlataformas(json.plataformas || []))
            .catch(() => setPlataformas([]));
    }, []);

    const esOtra = plataforma === "otro";

    const handlePlataformaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === "otro") {
            onChange({ identificador, plataforma: "otro", otraPlataforma: otra || "" });
        } else {
            onChange({ identificador, plataforma: val, otraPlataforma: "" });
            setOtra("");
        }
    };

    const handleOtraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setOtra(val);
        if (esOtra) {
            onChange({ identificador, plataforma: "otro", otraPlataforma: val });
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">¿Qué identificador quieres reportar?</h2>
            <Input
                label="Número, nick o usuario"
                placeholder="Ej: +573001234567"
                value={identificador}
                onChange={(e) => onChange({ identificador: e.target.value, plataforma, otraPlataforma })}
            />
            <Select
                label="Plataforma"
                options={[
                    { value: "", label: "Selecciona una plataforma" },
                    ...plataformas.map((p) => ({ value: p.clave, label: p.nombre })),
                ]}
                value={plataforma}
                onChange={handlePlataformaChange}
            />
            {esOtra && (
                <Input
                    label="Escribe la plataforma"
                    placeholder="Ej: Signal"
                    value={otra}
                    onChange={handleOtraChange}
                />
            )}
        </div>
    );
}