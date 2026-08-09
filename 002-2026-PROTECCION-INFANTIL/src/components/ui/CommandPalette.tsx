"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * SPEC-148 (US2, FR-002) — Primitivo CommandPalette (buscador global ⌘K).
 * Portal como `ui/Modal` (mismo patrón: overlay + panel + focus trap +
 * restauración de foco). Aria de combobox/listbox: el foco queda SIEMPRE en
 * el input (aria-activedescendant), ↑↓ navega la opción activa, Enter
 * selecciona, Esc cierra. Sin animaciones: reduced-motion quieto por
 * construcción (brief §9: prefers-reduced-motion apaga todo).
 */

export interface OpcionCommandPalette {
    id: string;
    /** Nombre visible del grupo ("Estudiantes", "Cursos", "Profesores"). */
    grupo: string;
    titulo: string;
    /** Contexto mínimo (curso del estudiante, titular del curso). */
    detalle?: string | undefined;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    consulta: string;
    onConsultaChange: (valor: string) => void;
    /** Opciones en orden de grupos (el índice activo recorre la lista plana). */
    opciones: OpcionCommandPalette[];
    onSeleccionar: (opcion: OpcionCommandPalette) => void;
    cargando?: boolean;
    /** Conteo de resultados no mostrados por grupo ("+N más"). */
    restantes?: Record<string, number> | undefined;
    /** Mensaje honesto cuando la consulta (≥2 caracteres) no trajo nada. */
    textoSinResultados?: string;
    "aria-label"?: string;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
        "[contenteditable]",
    ].join(", ");
    return Array.from(container.querySelectorAll(selector)).filter(
        (el): el is HTMLElement => el instanceof HTMLElement
    );
}

export function CommandPalette({
    isOpen,
    onClose,
    consulta,
    onConsultaChange,
    opciones,
    onSeleccionar,
    cargando = false,
    restantes,
    textoSinResultados = "Sin resultados",
    "aria-label": ariaLabel = "Buscar en tu colegio",
}: CommandPaletteProps) {
    const listboxId = useId();
    const overlayRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const [indiceActivo, setIndiceActivo] = useState(0);

    // Índice activo acotado a la lista plana (deriva, sin efectos).
    const activo = opciones.length === 0 ? -1 : Math.min(indiceActivo, opciones.length - 1);

    const manejarCambio = useCallback(
        (valor: string) => {
            setIndiceActivo(0);
            onConsultaChange(valor);
        },
        [onConsultaChange]
    );

    // Guarda el foco previo al abrir; lo restaura al cerrar (patrón Modal).
    useEffect(() => {
        if (!isOpen) return;
        previousFocusRef.current = document.activeElement as HTMLElement;
        const timer = setTimeout(() => inputRef.current?.focus(), 0);
        return () => clearTimeout(timer);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) return;
        if (previousFocusRef.current) {
            const previo = previousFocusRef.current;
            previousFocusRef.current = null;
            const timer = setTimeout(() => previo.focus(), 0);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Focus trap: Tab cicla dentro del panel; el foco externo se redirige.
    useEffect(() => {
        if (!isOpen) return;

        function handleFocus(e: FocusEvent) {
            if (!panelRef.current || !overlayRef.current) return;
            if (!overlayRef.current.contains(e.target as Node)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                inputRef.current?.focus();
            }
        }

        document.addEventListener("focusin", handleFocus, true);
        return () => document.removeEventListener("focusin", handleFocus, true);
    }, [isOpen]);

    const manejarTeclas = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
                return;
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                if (opciones.length === 0) return;
                e.preventDefault();
                const delta = e.key === "ArrowDown" ? 1 : -1;
                setIndiceActivo((actual) => {
                    const base = opciones.length === 0 ? -1 : Math.min(actual, opciones.length - 1);
                    return (base + delta + opciones.length) % opciones.length;
                });
                return;
            }
            if (e.key === "Enter") {
                if (activo >= 0 && opciones[activo]) {
                    e.preventDefault();
                    onSeleccionar(opciones[activo]);
                }
                return;
            }
            if (e.key === "Tab" && panelRef.current) {
                const focusables = getFocusableElements(panelRef.current);
                if (focusables.length <= 1) {
                    e.preventDefault();
                    inputRef.current?.focus();
                }
            }
        },
        [activo, opciones, onClose, onSeleccionar]
    );

    // La opción activa siempre visible (jsdom no implementa scrollIntoView).
    useEffect(() => {
        if (!isOpen || activo < 0) return;
        const el = document.getElementById(`${listboxId}-opcion-${activo}`);
        el?.scrollIntoView?.({ block: "nearest" });
    }, [isOpen, activo, listboxId]);

    const handleOverlayClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (e.target === overlayRef.current) onClose();
        },
        [onClose]
    );

    if (!isOpen) return null;

    // Grupos en orden de aparición con sus opciones e índices planos.
    const grupos: { nombre: string; items: { opcion: OpcionCommandPalette; indice: number }[] }[] = [];
    opciones.forEach((opcion, indice) => {
        let grupo = grupos.find((g) => g.nombre === opcion.grupo);
        if (!grupo) {
            grupo = { nombre: opcion.grupo, items: [] };
            grupos.push(grupo);
        }
        grupo.items.push({ opcion, indice });
    });

    const palette = (
        <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[15vh]"
            role="presentation"
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
                className="w-full max-w-xl overflow-hidden rounded-2xl glass-strong shadow-xl"
                onKeyDown={manejarTeclas}
            >
                <div className="border-b border-tinta/10 p-3">
                    <input
                        ref={inputRef}
                        type="text"
                        role="combobox"
                        aria-expanded={opciones.length > 0}
                        aria-controls={listboxId}
                        aria-activedescendant={activo >= 0 ? `${listboxId}-opcion-${activo}` : undefined}
                        aria-autocomplete="list"
                        aria-label={ariaLabel}
                        value={consulta}
                        onChange={(e) => manejarCambio(e.target.value)}
                        placeholder="Buscar estudiantes, cursos o profesores..."
                        className="w-full rounded-xl px-4 py-3 text-sm text-body placeholder:text-subtle outline-none glass-input ring-accent-input"
                    />
                </div>
                <div className="max-h-[50vh] overflow-y-auto p-2">
                    {cargando && (
                        <p role="status" className="px-3 py-4 text-sm text-muted">
                            Buscando...
                        </p>
                    )}
                    {!cargando && opciones.length === 0 && (
                        <p role="status" className="px-3 py-4 text-sm text-muted">
                            {textoSinResultados}
                        </p>
                    )}
                    {opciones.length > 0 && (
                        <ul role="listbox" id={listboxId} aria-label="Resultados de la búsqueda">
                            {grupos.map((grupo) => (
                                <li key={grupo.nombre} role="presentation">
                                    <div className="microetiqueta px-3 pb-1 pt-3" role="presentation">
                                        {grupo.nombre}
                                    </div>
                                    <ul role="presentation">
                                        {grupo.items.map(({ opcion, indice }) => (
                                            <li
                                                key={opcion.id}
                                                id={`${listboxId}-opcion-${indice}`}
                                                role="option"
                                                aria-selected={indice === activo}
                                                onMouseEnter={() => setIndiceActivo(indice)}
                                                onClick={() => onSeleccionar(opcion)}
                                                className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 ${
                                                    indice === activo ? "bg-pino/10" : ""
                                                }`}
                                            >
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm font-medium text-body">
                                                        {opcion.titulo}
                                                    </span>
                                                    {opcion.detalle && (
                                                        <span className="block truncate text-xs text-subtle">
                                                            {opcion.detalle}
                                                        </span>
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                    {(restantes?.[grupo.nombre] ?? 0) > 0 && (
                                        <p className="px-3 pb-1 text-xs text-subtle">+{restantes?.[grupo.nombre]} más</p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );

    if (typeof document !== "undefined") {
        return createPortal(palette, document.body);
    }
    return palette;
}

export default CommandPalette;
