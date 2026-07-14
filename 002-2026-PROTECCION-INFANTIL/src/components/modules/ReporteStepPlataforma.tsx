"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

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

export function ReporteStepPlataforma({
    identificador,
    plataforma,
    onChange,
}: {
    identificador: string;
    plataforma: string;
    onChange: (v: { identificador: string; plataforma: string }) => void;
}) {
    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">¿Qué identificador quieres reportar?</h2>
            <Input
                label="Número, nick o usuario"
                placeholder="Ej: +573001234567"
                value={identificador}
                onChange={(e) => onChange({ identificador: e.target.value, plataforma })}
            />
            <Select
                label="Plataforma"
                options={PLATAFORMAS}
                value={plataforma}
                onChange={(e) => onChange({ identificador, plataforma: e.target.value })}
            />
        </div>
    );
}
