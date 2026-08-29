"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { UsuarioUI } from "@/lib/bi/tipos-ui";

interface Props {
    usuario: UsuarioUI;
    consultaLogId?: string;
}

export function BotonesFeedback({ usuario, consultaLogId }: Props) {
    const [estado, setEstado] = useState<"idle" | "ok" | "rechazado" | "error">("idle");
    if (usuario.rol !== "ADMIN") return null;
    if (!consultaLogId) return null;

    const enviar = async (path: string, extra?: Record<string, unknown>) => {
        try {
            const res = await fetch(path, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ consultaLogId, ...extra }),
            });
            if (!res.ok) throw new Error(String(res.status));
            setEstado(path.endsWith("/aprobar") ? "ok" : "rechazado");
        } catch {
            setEstado("error");
        }
    };

    if (estado === "ok") return <span data-testid="feedback-ok" className="text-xs text-emerald-700">Aprobado · cache actualizado</span>;
    if (estado === "rechazado") return <span data-testid="feedback-rechazado" className="text-xs text-amber-700">Marcado para revisión</span>;
    if (estado === "error") return <span data-testid="feedback-error" className="text-xs text-red-700">Error al guardar feedback</span>;

    return (
        <div data-testid="botones-feedback" className="mt-2 flex gap-2">
            <Button variant="ghost" onClick={() => enviar("/api/bi/aprobar")}>👍 Aprobar</Button>
            <Button variant="ghost" onClick={() => enviar("/api/bi/rechazar")}>👎 Rechazar</Button>
        </div>
    );
}
