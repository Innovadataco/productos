"use client";
import Link from "next/link";

/**
 * Puntos de integración del chat NL→SQL para SPEC-024 (sidebar) y SPEC-025 (home).
 * Ambos SPECs importan de aquí al mergear. Mantener la firma estable.
 */

export const NAV_ITEM_CHAT = {
    href: "/chat" as const,
    label: "Chat NL→SQL" as const,
    icon: "💬" as const,
};

interface Props {
    className?: string;
}

export function EnlaceChatNav({ className = "" }: Props) {
    const base = "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900";
    return (
        <Link href={NAV_ITEM_CHAT.href} className={`${base} ${className}`.trim()} data-testid="enlace-chat-nav">
            <span aria-hidden="true">{NAV_ITEM_CHAT.icon}</span>
            <span>{NAV_ITEM_CHAT.label}</span>
        </Link>
    );
}

export function BotonPreguntaAlgo({ className = "" }: Props) {
    const base =
        "inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-primary-700";
    return (
        <Link href={NAV_ITEM_CHAT.href} className={`${base} ${className}`.trim()} data-testid="boton-pregunta-algo">
            <span aria-hidden="true">{NAV_ITEM_CHAT.icon}</span>
            <span>Preguntá algo</span>
        </Link>
    );
}
