"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

const PLATAFORMAS = [
    { value: "whatsapp", label: "WhatsApp" },
    { value: "instagram", label: "Instagram" },
    { value: "facebook", label: "Facebook" },
    { value: "tiktok", label: "TikTok" },
    { value: "twitter", label: "X (Twitter)" },
    { value: "discord", label: "Discord" },
    { value: "telegram", label: "Telegram" },
    { value: "snapchat", label: "Snapchat" },
    { value: "youtube", label: "YouTube" },
    { value: "twitch", label: "Twitch" },
];

export function ConsultaForm({ onSearch }: { onSearch: (identificador: string, plataforma: string) => void }) {
    const [identificador, setIdentificador] = useState("");
    const [plataforma, setPlataforma] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!identificador.trim() || !plataforma) {
            setError("Ingresa un identificador y selecciona una plataforma.");
            return;
        }
        setError("");
        onSearch(identificador.trim(), plataforma);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
                <Input
                    label="Número, nick o usuario"
                    placeholder="Ej: +573001234567"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    error={error}
                />
            </div>
            <div className="w-full sm:w-56">
                <Select
                    label="Plataforma"
                    options={PLATAFORMAS}
                    value={plataforma}
                    onChange={(e) => setPlataforma(e.target.value)}
                />
            </div>
            <Button type="submit" className="sm:w-auto">Buscar</Button>
        </form>
    );
}