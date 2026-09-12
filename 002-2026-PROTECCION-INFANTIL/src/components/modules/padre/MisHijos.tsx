"use client";

// SPEC-325 (002-PI-225) · "A quién protejo" — el padre registra hijos y
// familiares cercanos con sus identificadores. Si alguien reporta el
// identificador de un hijo, el padre se entera (mecanismo compartido). Lenguaje
// de padre (A-62): esto NO es vigilancia, es cuidar a los tuyos.
// SPEC-589: la ficha del menor ya NO pide documento (decisión CEO 06-09-2026).
//
// SPEC-627 (D-133): el ALTA es el formulario inline simple (`FormularioAltaHijo`),
// una sola acción alineada a «A quién vigilo» (mockup del área del padre firmado).
// DEROGA el wizard de SPEC-599 (borrado con su simulador). La lógica de negocio
// no cambia: validaciones (documento-menor), alta múltiple de identificadores y
// payload del POST intactos. Este archivo conserva la carga de datos, el contador
// de cupo y las acciones de las tarjetas existentes.
//
// SPEC-325 (extensión UI) · el alta acepta VARIOS identificadores y cada tarjeta
// expone las cuatro acciones del backend, que NO son equivalentes:
//   · activar/inactivar HIJO ....... estado del hijo (`cambiarEstadoHijo`).
//   · agregar identificador ........ a un hijo ya creado (`agregarIdentificador`).
//   · activar/inactivar IDENTIFICADOR → pausa/reactiva el aviso de esa cuenta en
//     la ficha de ESTE padre (`cambiarEstadoIdentificador`). SPEC-339 (D-4): cada
//     padre tiene SU ficha; NO afecta al otro padre. Reversible.
//   · quitar identificador ......... BORRA la fila del identificador de la ficha
//     de ESTE padre (`desvincularIdentificador`); el otro padre tiene la suya y
//     la sigue viendo.
// Las dos últimas se parecen y hacen cosas distintas —pausar-y-conservar vs
// quitar-y-borrar, ambas LOCALES a este padre—: la UI tiene que nombrar esa
// diferencia (no un alcance "global", que SPEC-339 eliminó).

import { useEffect, useState } from "react";

// SPEC-539: la tarjeta del menor, sus tipos y catálogos viven en HijoCard.tsx
// (MisHijos.tsx superaba el máximo de líneas al sumar la edición inline).
import { HijoCard, type Hijo, type Plataforma } from "./HijoCard";
import { FormularioAltaHijo } from "./FormularioAltaHijo";
import { AvisoDeshacerConfirmacion } from "@/components/modules/reporte-detalle/AvisoDeshacerConfirmacion";

/**
 * SPEC-339: `onListaCambio` avisa al Paso 3 del camino cuántos menores activos
 * hay, para habilitar el "Siguiente" sin duplicar la consulta.
 *
 * SPEC-627 (D-133): el alta es SIEMPRE el formulario inline simple («una sola
 * acción», mockup del área del padre firmado). Deroga el wizard de SPEC-599
 * (`RegistroHijoWizard` + su simulador), borrado; Jelkin lo ratificó dos veces
 * («cuatro pasos, mucho texto» + aprobar el mockup). Ya no hay `varianteAlta`.
 */
export function MisHijos({
    onListaCambio,
    // SPEC-361 (F6): el tope llega del servidor (parámetro `padre.hijos.maximo`)
    // para poder mostrar "3 de 5" sin que la pantalla lo adivine.
    maximoActivos,
}: {
    onListaCambio?: (activos: number) => void;
    maximoActivos?: number;
} = {}) {
    const [hijos, setHijos] = useState<Hijo[]>([]);
    const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // SPEC-660 (Fase D): «Quitar» ya no pide confirmación por modal (clic
    // automático, I-345); la red es DESHACER. Guardamos lo suficiente para
    // reconstruir el identificador borrado (hijo, valor, plataforma) y ofrecer
    // un toast «Deshacer» durante 8 s. Es la contraparte de haber quitado el modal.
    const [quitado, setQuitado] = useState<{ hijoId: string; valor: string; plataformaId: string } | null>(null);

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

    /**
     * Envuelve una acción del backend: limpia el error y recarga la lista.
     * Devuelve si la operación tuvo éxito, para que el llamador decida si
     * mostrar el toast de deshacer (SPEC-660 Fase D): solo se ofrece «Deshacer»
     * cuando el borrado REALMENTE ocurrió, no cuando falló.
     */
    async function accion(fn: () => Promise<Response>, mensajeError: string): Promise<boolean> {
        setError(null);
        try {
            const res = await fn();
            if (!res.ok) {
                // SPEC-361 (F4): igual que en el alta — manda el motivo real.
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error?.message ?? mensajeError);
            }
            await cargar();
            return true;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error");
            return false;
        }
    }

    // Los handlers que consume HijoCard son fire-and-forget (Promise<void>); el
    // booleano de `accion` solo lo miran `desvincular`/`deshacerQuitar`.
    const cambiarEstadoHijo = async (hijoId: string, estado: "activo" | "inactivo") => {
        await accion(
            () =>
                fetch(`/api/padre/hijos/${hijoId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ estado }),
                }),
            "No se pudo cambiar el estado"
        );
    };

    // SPEC-539: editar los datos de un menor (nombre, apellidos, año, sexo).
    // El endpoint PATCH /api/padre/hijos/[id] ya lo soporta (patchSchema · actualizarHijo);
    // lo que faltaba era la UI. `estado` va por su propio botón, no acá.
    const editarHijo = async (
        hijoId: string,
        datos: {
            nombre: string;
            apellidos: string;
            anioNacimiento: number | null;
            sexo: string | null;
        }
    ) => {
        await accion(
            () =>
                fetch(`/api/padre/hijos/${hijoId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(datos),
                }),
            "No se pudieron guardar los cambios"
        );
    };

    // Local a ESTE padre (SPEC-339 · D-4): pausa/reactiva el aviso de esa cuenta
    // en SU ficha; no toca al otro padre.
    const cambiarEstadoIdentificador = async (identificadorId: string, activo: boolean) => {
        await accion(
            () =>
                fetch(`/api/padre/hijos/identificadores/${identificadorId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ activo }),
                }),
            "No se pudo cambiar la cuenta"
        );
    };

    const agregarIdentificador = async (hijoId: string, valor: string, plataformaId: string) => {
        await accion(
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
    };

    // Solo saca el identificador de la vista de ESTE padre.
    // SPEC-660 (Fase D): antes de borrar, capturamos con qué reconstruirlo
    // (hijo + valor + plataforma) leyendo la lista ACTUAL; si el DELETE tuvo
    // éxito, mostramos el toast de deshacer. La fila ya no está, pero el toast
    // es `fixed` y sobrevive a que desaparezca.
    const desvincular = async (identificadorId: string) => {
        let capturado: { hijoId: string; valor: string; plataformaId: string } | null = null;
        for (const h of hijos) {
            const ident = h.identificadores.find((i) => i.id === identificadorId);
            if (ident) {
                capturado = { hijoId: h.id, valor: ident.valor, plataformaId: ident.plataforma?.id ?? "" };
                break;
            }
        }
        const ok = await accion(
            () => fetch(`/api/padre/hijos/identificadores/${identificadorId}`, { method: "DELETE" }),
            "No se pudo quitar"
        );
        if (ok && capturado) setQuitado(capturado);
    };

    // «Deshacer» del quitar: vuelve a agregar la cuenta con los datos capturados.
    // No es un rollback del backend (no existe un endpoint de «restaurar»): es
    // una alta idéntica, que es exactamente lo que el padre quería recuperar.
    const deshacerQuitar = async () => {
        if (!quitado) return;
        const { hijoId, valor, plataformaId } = quitado;
        setQuitado(null);
        await agregarIdentificador(hijoId, valor, plataformaId);
    };

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

            {/* SPEC-627 (D-133): una sola acción — el formulario inline simple,
                alineado a «A quién vigilo». El wizard de SPEC-599 quedó derogado. */}
            <FormularioAltaHijo opcionesPlataforma={opcionesPlataforma} onRegistrado={cargar} />

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

            {/* SPEC-660 (Fase D): la red del «Quitar» sin modal — «Deshacer» por 8 s. */}
            {quitado && (
                <AvisoDeshacerConfirmacion
                    mensaje={`Quitaste ${quitado.valor} de tu lista.`}
                    onDeshacer={deshacerQuitar}
                    onExpirar={() => setQuitado(null)}
                />
            )}
        </section>
    );
}
