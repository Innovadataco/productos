"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette, type OpcionCommandPalette } from "@/components/ui/CommandPalette";
import type { ResultadoBusquedaColegio } from "@/lib/dal/repositories/busqueda-colegio";

/**
 * SPEC-148 (US2, FR-002/FR-003) — Buscador global del colegio (⌘K / Ctrl+K).
 * Se monta UNA vez en el layout del colegio; la tecla abre el CommandPalette
 * desde cualquier pantalla. Consulta con debounce 280 ms (brief §9: 250-300),
 * mínimo 2 caracteres, resultados agrupados con contexto (curso del
 * estudiante, titular del curso) y conteo "+N más". Enter navega al destino:
 * estudiante → su ficha, curso → su escritorio, profesor → la pantalla de
 * profesores. Empty state honesto cuando no hay match.
 */

const DEBOUNCE_MS = 280;
/** Mínimo de caracteres (el repo aplica el mismo umbral; aquí evita el fetch). */
const MIN_CARACTERES = 2;

type OpcionConDestino = OpcionCommandPalette & { destino: string };

function aOpciones(r: ResultadoBusquedaColegio): OpcionConDestino[] {
    return [
        ...r.estudiantes.map((e) => ({
            id: `est-${e.id}`,
            grupo: "Estudiantes",
            titulo: `${e.nombre} ${e.apellidos}`.trim(),
            detalle: e.curso,
            destino: `/dashboard/colegio/alumnos/${e.id}`,
        })),
        ...r.cursos.map((c) => ({
            id: `cur-${c.id}`,
            grupo: "Cursos",
            titulo: c.nombre,
            detalle: c.titular ? `Titular: ${c.titular}` : undefined,
            destino: `/dashboard/colegio/cursos/${c.id}`,
        })),
        ...r.profesores.map((p) => ({
            id: `pro-${p.id}`,
            grupo: "Profesores",
            titulo: `${p.nombre} ${p.apellidos}`.trim(),
            destino: "/dashboard/colegio/profesores",
        })),
    ];
}

const ETIQUETAS_RESTANTES: Record<string, string> = {
    estudiantes: "Estudiantes",
    cursos: "Cursos",
    profesores: "Profesores",
};

export function BuscadorGlobal() {
    const router = useRouter();
    const [abierto, setAbierto] = useState(false);
    const [consulta, setConsulta] = useState("");
    const [opciones, setOpciones] = useState<OpcionConDestino[]>([]);
    const [restantes, setRestantes] = useState<Record<string, number>>({});
    const [cargando, setCargando] = useState(false);
    // Guarda de carreras: solo la última consulta pinta resultados.
    const consultaVigenteRef = useRef(0);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                if (abierto) {
                    setAbierto(false);
                } else {
                    // Cada apertura arranca limpia (consulta y resultados).
                    setConsulta("");
                    setOpciones([]);
                    setRestantes({});
                    setAbierto(true);
                }
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [abierto]);

    const cerrar = useCallback(() => setAbierto(false), []);

    useEffect(() => {
        const texto = consulta.trim();
        if (texto.length < MIN_CARACTERES) {
            setOpciones([]);
            setRestantes({});
            setCargando(false);
            return;
        }
        setCargando(true);
        const vigente = ++consultaVigenteRef.current;
        const temporizador = setTimeout(async () => {
            try {
                const res = await fetch(`/api/colegio/buscar?q=${encodeURIComponent(texto)}`, { credentials: "include" });
                if (vigente !== consultaVigenteRef.current) return;
                if (!res.ok) {
                    setOpciones([]);
                    setRestantes({});
                    return;
                }
                const datos = (await res.json()) as ResultadoBusquedaColegio;
                if (vigente !== consultaVigenteRef.current) return;
                setOpciones(aOpciones(datos));
                setRestantes(
                    Object.fromEntries(
                        Object.entries(datos.restantes).map(([grupo, n]) => [ETIQUETAS_RESTANTES[grupo] ?? grupo, n])
                    )
                );
            } catch {
                if (vigente === consultaVigenteRef.current) {
                    setOpciones([]);
                    setRestantes({});
                }
            } finally {
                if (vigente === consultaVigenteRef.current) setCargando(false);
            }
        }, DEBOUNCE_MS);
        return () => clearTimeout(temporizador);
    }, [consulta]);

    const seleccionar = useCallback(
        (opcion: OpcionCommandPalette) => {
            const destino = (opcion as OpcionConDestino).destino;
            setAbierto(false);
            if (destino) router.push(destino);
        },
        [router]
    );

    const texto = consulta.trim();
    const textoVacio =
        texto.length < MIN_CARACTERES
            ? "Escribe al menos 2 caracteres para buscar"
            : `Sin resultados para «${texto}»`;

    return (
        <CommandPalette
            isOpen={abierto}
            onClose={cerrar}
            consulta={consulta}
            onConsultaChange={setConsulta}
            opciones={opciones}
            onSeleccionar={seleccionar}
            cargando={cargando}
            restantes={restantes}
            textoSinResultados={textoVacio}
        />
    );
}

export default BuscadorGlobal;
