"use client";

// SPEC-325 (002-PI-225) · "A quién protejo" — el padre registra hijos y
// familiares cercanos con sus identificadores. Si alguien reporta el
// identificador de un hijo, el padre se entera (mecanismo compartido). Lenguaje
// de padre (A-62): esto NO es vigilancia, es cuidar a los tuyos.
// SPEC-589: la ficha del menor ya NO pide documento (decisión CEO 06-09-2026).
//
// SPEC-599: el ALTA pasa de formulario plano a wizard (RegistroHijoWizard),
// aprobado sobre el mockup design/padre-hijos-registro-mockup.html. La lógica
// de negocio no cambia: validaciones (documento-menor), alta múltiple de
// identificadores y payload del POST intactos. Este archivo conserva la carga
// de datos, el contador de cupo y las acciones de las tarjetas existentes.
//
// SPEC-325 (extensión UI) · el alta acepta VARIOS identificadores y cada tarjeta
// expone las cuatro acciones del backend, que NO son equivalentes:
//   · activar/inactivar HIJO ....... estado del hijo (`cambiarEstadoHijo`).
//   · agregar identificador ........ a un hijo ya creado (`agregarIdentificador`).
//   · activar/inactivar IDENTIFICADOR → flag GLOBAL compartido (§3.1-bis: los
//     datos del niño son compartidos entre sus dos padres). Afecta a ambos.
//   · quitar identificador ......... desvincula de la vista de ESTE padre; el
//     registro compartido NO se borra (`desvincularIdentificador`).
// Las dos últimas se ven parecidas y hacen cosas distintas: la UI las separa y
// nombra el alcance en el texto visible, no solo en el aria-label.

import { useEffect, useState } from "react";

// SPEC-539: la tarjeta del menor, sus tipos y catálogos viven en HijoCard.tsx
// (MisHijos.tsx superaba el máximo de líneas al sumar la edición inline).
import { HijoCard, type Hijo, type Plataforma } from "./HijoCard";
import { RegistroHijoWizard } from "./registro-hijo/RegistroHijoWizard";

/**
 * SPEC-339: `onListaCambio` avisa al Paso 3 del camino cuántos menores activos
 * hay, para habilitar el "Siguiente" sin duplicar la consulta.
 */
export function MisHijos({
    onListaCambio,
    // SPEC-361 (F6): el tope llega del servidor (parámetro `padre.hijos.maximo`)
    // para poder mostrar "3 de 5" sin que la pantalla lo adivine.
    maximoActivos,
}: { onListaCambio?: (activos: number) => void; maximoActivos?: number } = {}) {
    const [hijos, setHijos] = useState<Hijo[]>([]);
    const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // SPEC-361 (F5/F6): el cupo se mide SOLO con los activos. Inactivar es
    // decisión del padre y libera lugar solo; el producto nunca inactiva.
    const activos = hijos.filter((h) => h.estado === "activo").length;

    async function cargar() {
        setCargando(true);
        try {
            const res = await fetch("/api/padre/hijos");
            if (!res.ok) throw new Error("No se pudo cargar");
            const lista = (await res.json()) as Hijo[];
            setHijos(lista);
            onListaCambio?.(lista.filter((h) => h.estado === "activo").length);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error");
        } finally {
            setCargando(false);
        }
    }

    useEffect(() => {
        void cargar();
        // Las plataformas son opcionales: si el catálogo falla, el padre igual
        // puede registrar el identificador "suelto" (plataformaId null).
        fetch("/api/plataformas")
            .then((res) => (res.ok ? res.json() : { plataformas: [] }))
            .then((json: { plataformas?: Plataforma[] }) => setPlataformas(json.plataformas ?? []))
            .catch(() => setPlataformas([]));
    }, []);

    // SPEC-555 (I-337): «Sin plataforma» confundía al padre —parecía una opción
    // afirmativa de «esto no está en ninguna plataforma»— cuando lo que faltaba
    // era el «Número telefónico» (ahora sembrado por Datos, entra por el catálogo
    // de abajo). La primera entrada pasa a ser un prompt neutro. Se CONSERVA su
    // value "" a propósito: es la red de resiliencia del comentario de arriba
    // (registrar el identificador «suelto», plataformaId null, si el catálogo
    // /api/plataformas no carga) y el estado inicial del select.
    const opcionesPlataforma = [
        { value: "", label: "Elige una plataforma" },
        ...plataformas.map((p) => ({ value: p.id, label: p.nombre })),
    ];

    /** Envuelve una acción del backend: limpia el error y recarga la lista. */
    async function accion(fn: () => Promise<Response>, mensajeError: string) {
        setError(null);
        try {
            const res = await fn();
            if (!res.ok) {
                // SPEC-361 (F4): igual que en el alta — manda el motivo real.
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error?.message ?? mensajeError);
            }
            await cargar();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error");
        }
    }

    const cambiarEstadoHijo = (hijoId: string, estado: "activo" | "inactivo") =>
        accion(
            () =>
                fetch(`/api/padre/hijos/${hijoId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ estado }),
                }),
            "No se pudo cambiar el estado"
        );

    // SPEC-539: editar los datos de un menor (nombre, apellidos, año, sexo).
    // El endpoint PATCH /api/padre/hijos/[id] ya lo soporta (patchSchema · actualizarHijo);
    // lo que faltaba era la UI. `estado` va por su propio botón, no acá.
    const editarHijo = (
        hijoId: string,
        datos: {
            nombre: string;
            apellidos: string;
            anioNacimiento: number | null;
            sexo: string | null;
        }
    ) =>
        accion(
            () =>
                fetch(`/api/padre/hijos/${hijoId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(datos),
                }),
            "No se pudieron guardar los cambios"
        );

    // Flag GLOBAL: el identificador es del niño, no del padre (§3.1-bis).
    const cambiarEstadoIdentificador = (identificadorId: string, activo: boolean) =>
        accion(
            () =>
                fetch(`/api/padre/hijos/identificadores/${identificadorId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ activo }),
                }),
            "No se pudo cambiar la cuenta"
        );

    // Solo saca el identificador de la vista de ESTE padre.
    const desvincular = (identificadorId: string) =>
        accion(
            () => fetch(`/api/padre/hijos/identificadores/${identificadorId}`, { method: "DELETE" }),
            "No se pudo quitar"
        );

    const agregarIdentificador = (hijoId: string, valor: string, plataformaId: string) =>
        accion(
            () =>
                fetch("/api/padre/hijos/identificadores", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        hijoId,
                        valor,
                        ...(plataformaId ? { plataformaId } : {}),
                    }),
                }),
            "No se pudo agregar la cuenta"
        );

    return (
        <section aria-label="A quién protejo" data-testid="mis-hijos" className="space-y-4">
            <header>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-body">A quién protejo</h2>
                    {/* SPEC-361 (F6): el cupo siempre a la vista, sin tener que
                        chocar contra el tope para enterarse de que existe. */}
                    {maximoActivos !== undefined && (
                        <span
                            data-testid="contador-menores"
                            className="rounded-full bg-tinta/5 px-3 py-1 text-sm font-medium text-body dark:bg-papel/10"
                        >
                            {activos} de {maximoActivos} menores activos
                        </span>
                    )}
                </div>
                <p className="text-sm text-muted">
                    Registra a tus hijos y a los familiares cercanos. Si alguien reporta una de sus
                    cuentas (su Roblox, un teléfono, un correo), te avisamos.
                </p>
                {maximoActivos !== undefined && activos >= maximoActivos && (
                    <p className="mt-2 rounded-xl border border-ambar/40 bg-ambar/10 px-3 py-2 text-sm text-ambar" role="status">
                        Tienes {activos} de {maximoActivos} menores activos. Si quieres registrar otro,
                        primero inactiva uno.
                    </p>
                )}
            </header>

            {/* SPEC-599: el alta es un wizard aprobado sobre el mockup de diseño;
                la lógica de negocio (POST, validaciones) vive en el orquestador. */}
            <RegistroHijoWizard opcionesPlataforma={opcionesPlataforma} onRegistrado={cargar} />

            {cargando ? (
                <p className="text-sm text-muted">Cargando…</p>
            ) : hijos.length === 0 ? (
                <p className="text-sm text-muted" data-testid="mis-hijos-vacio">Todavía no registraste a nadie.</p>
            ) : (
                <ul className="space-y-3" data-testid="lista-hijos">
                    {hijos.map((h) => (
                        <li key={h.id}>
                            <HijoCard
                                hijo={h}
                                opcionesPlataforma={opcionesPlataforma}
                                onCambiarEstadoHijo={cambiarEstadoHijo}
                                onEditarHijo={editarHijo}
                                onCambiarEstadoIdentificador={cambiarEstadoIdentificador}
                                onDesvincular={desvincular}
                                onAgregarIdentificador={agregarIdentificador}
                            />
                        </li>
                    ))}
                </ul>
            )}
            {error && <p className="text-sm text-rubi" data-testid="mis-hijos-error">{error}</p>}
        </section>
    );
}
