"use client";

import { NotificacionesInbox } from "@/components/modules/NotificacionesInbox";
import type { NotificacionItem } from "@/components/modules/NotificacionesInbox";

interface NotificacionApiItem {
    id: string;
    titulo: string;
    mensaje: string;
    entidadId: string | null;
    leidaEn: string | null;
    creadoEn: string;
}

function adaptarItem(n: NotificacionApiItem): NotificacionItem {
    return {
        id: n.id,
        titulo: n.titulo,
        mensaje: n.mensaje,
        leidaEn: n.leidaEn,
        creadoEn: new Date(n.creadoEn).toLocaleString("es-CO", {
            timeZone: "America/Bogota",
            dateStyle: "short",
            timeStyle: "short",
        }),
    };
}

export function CentroNotificaciones() {
    async function cargarResumen() {
        const res = await fetch("/api/colegio/notificaciones/resumen");
        if (!res.ok) return { noLeidas: 0 };
        const json = (await res.json()) as { noLeidas?: number };
        return { noLeidas: json.noLeidas ?? 0 };
    }

    async function cargarListado() {
        const res = await fetch("/api/colegio/notificaciones?pageSize=10");
        if (!res.ok) return { items: [] };
        const json = (await res.json()) as { items?: NotificacionApiItem[] };
        return { items: (json.items ?? []).map(adaptarItem) };
    }

    async function marcarLeida(id: string) {
        const res = await fetch(`/api/colegio/notificaciones/${id}`, { method: "PATCH" });
        if (!res.ok) throw new Error("No se pudo marcar como leída");
    }

    async function marcarTodasLeidas() {
        const res = await fetch("/api/colegio/notificaciones/marcar-leidas", { method: "PATCH" });
        if (!res.ok) throw new Error("No se pudieron marcar todas");
    }

    async function archivar(id: string) {
        const res = await fetch(`/api/colegio/notificaciones/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("No se pudo archivar");
    }

    return (
        <NotificacionesInbox
            variant="colegio"
            cargarResumen={cargarResumen}
            cargarListado={cargarListado}
            onMarcarLeida={marcarLeida}
            onMarcarTodasLeidas={marcarTodasLeidas}
            onArchivar={archivar}
        />
    );
}
