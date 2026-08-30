"use client";
import { useEffect, useState } from "react";

// SPEC-033 · reloj vivo de Colombia. Copiado del <script> del artefacto:
// Intl.DateTimeFormat en-GB + America/Bogota, formato DD-MM-YYYY HH:MM:SS,
// tick cada segundo, con fallback local si Intl falla. Es el único Client
// Component de la vista; sigue corriendo aunque el archivo no tenga datos.

function pad(n: number): string {
    return String(n).padStart(2, "0");
}

function ahoraColombia(): string {
    try {
        const p = new Intl.DateTimeFormat("en-GB", {
            timeZone: "America/Bogota",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        })
            .formatToParts(new Date())
            .reduce<Record<string, string>>((a, x) => {
                a[x.type] = x.value;
                return a;
            }, {});
        return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}:${p.second}`;
    } catch {
        const d = new Date();
        return (
            `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ` +
            `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
        );
    }
}

export function RelojColombia() {
    // Arranca vacío para evitar mismatch de hidratación (server no tiene reloj);
    // el efecto lo puebla en el cliente y lo actualiza cada segundo.
    const [hora, setHora] = useState<string>("—");

    useEffect(() => {
        setHora(ahoraColombia());
        const id = setInterval(() => setHora(ahoraColombia()), 1000);
        return () => clearInterval(id);
    }, []);

    return <b id="now">{hora}</b>;
}
