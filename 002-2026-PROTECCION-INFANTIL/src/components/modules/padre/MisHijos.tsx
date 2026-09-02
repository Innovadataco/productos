"use client";

// SPEC-325 (002-PI-225) · "A quién protejo" — el padre registra hijos y
// familiares cercanos con su documento e identificadores. Si alguien reporta el
// identificador de un hijo, el padre se entera (mecanismo compartido). Lenguaje
// de padre (A-62): esto NO es vigilancia, es cuidar a los tuyos.
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
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
    validarDocumentoMenor,
    validarEdadMenor,
    anioDesdeEdad,
    edadDesdeAnio,
    edadesMenor,
} from "@/lib/padre/documento-menor";
import type { DocumentoTipo } from "@/lib/dal/services/hijos/tipos";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";

const DOCUMENTO_TIPOS = [
    { value: "RC", label: "Registro civil" },
    { value: "TI", label: "Tarjeta de identidad" },
    { value: "CC", label: "Cédula" },
    { value: "CE", label: "Cédula de extranjería" },
    { value: "PASAPORTE", label: "Pasaporte" },
    { value: "OTRO", label: "Otro" },
];
const SEXOS = [
    { value: "", label: "Prefiero no decir" },
    { value: "M", label: "Masculino" },
    { value: "F", label: "Femenino" },
    { value: "OTRO", label: "Otro" },
];

type Plataforma = { id: string; clave: string; nombre: string };
type Identificador = {
    id: string;
    valor: string;
    tipo: string | null;
    activo: boolean;
    plataforma: { id: string; nombre: string; clave: string } | null;
};
type Hijo = {
    id: string;
    nombre: string;
    apellidos: string;
    documentoTipo: string;
    documentoNumero: string;
    anioNacimiento: number | null;
    sexo: string | null;
    estado: string;
    identificadores: Identificador[];
};
/** Identificador aún no guardado: se acumula en el formulario de alta. */
type IdentificadorNuevo = { valor: string; plataformaId: string };

const FORM_VACIO = {
    nombre: "",
    apellidos: "",
    documentoTipo: "TI",
    documentoNumero: "",
    // SPEC-361 (F8): se pide la EDAD; el año de nacimiento se deriva de ella.
    edad: "",
    sexo: "",
};

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
    const [form, setForm] = useState(FORM_VACIO);
    // Identificadores del alta: se agregan a una lista ANTES de crear al hijo,
    // así el padre carga todos los que conoce (Roblox, teléfono, correo) de una.
    const [nuevos, setNuevos] = useState<IdentificadorNuevo[]>([]);
    const [borrador, setBorrador] = useState<IdentificadorNuevo>({ valor: "", plataformaId: "" });
    const [guardando, setGuardando] = useState(false);

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
            .then((json) => setPlataformas(json.plataformas ?? []))
            .catch(() => setPlataformas([]));
    }, []);

    const opcionesPlataforma = [
        { value: "", label: "Sin plataforma" },
        ...plataformas.map((p) => ({ value: p.id, label: p.nombre })),
    ];

    function agregarBorrador() {
        const valor = borrador.valor.trim();
        if (!valor) return;
        setNuevos((lista) => [...lista, { valor, plataformaId: borrador.plataformaId }]);
        setBorrador({ valor: "", plataformaId: "" });
    }

    async function registrar(e: React.FormEvent) {
        e.preventDefault();
        if (!form.nombre.trim() || !form.documentoNumero.trim()) return;

        // SPEC-361 (F7/F8): avisar ANTES de enviar, nombrando el campo. El
        // servidor vuelve a validar: esto es cortesía, no la única defensa.
        const errorDoc = validarDocumentoMenor(form.documentoTipo as DocumentoTipo, form.documentoNumero);
        if (errorDoc) {
            setError(errorDoc);
            return;
        }
        const edadNum = form.edad ? Number(form.edad) : null;
        const errorEdad = validarEdadMenor(edadNum);
        if (errorEdad) {
            setError(errorEdad);
            return;
        }

        setGuardando(true);
        setError(null);
        // El identificador escrito pero no "agregado" no se pierde: entra igual.
        const pendiente = borrador.valor.trim()
            ? [...nuevos, { valor: borrador.valor.trim(), plataformaId: borrador.plataformaId }]
            : nuevos;
        try {
            const body: Record<string, unknown> = {
                nombre: form.nombre.trim(),
                apellidos: form.apellidos.trim() || undefined,
                documentoTipo: form.documentoTipo,
                documentoNumero: form.documentoNumero.trim(),
                anioNacimiento: edadNum !== null ? anioDesdeEdad(edadNum) : undefined,
                sexo: form.sexo || undefined,
                identificadores: pendiente.length
                    ? pendiente.map((i) => ({
                        valor: i.valor,
                        ...(i.plataformaId ? { plataformaId: i.plataformaId } : {}),
                    }))
                    : undefined,
            };
            const res = await fetch("/api/padre/hijos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                // SPEC-361 (F4): el servidor explica el motivo (documento repetido,
                // tope alcanzado, campo faltante). Antes se descartaba y la
                // pantalla decía "No se pudo registrar" a todo.
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error?.message ?? "No pudimos registrar al menor. Revisa los datos e intenta de nuevo.");
            }
            setForm(FORM_VACIO);
            setNuevos([]);
            setBorrador({ valor: "", plataformaId: "" });
            await cargar();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error");
        } finally {
            setGuardando(false);
        }
    }

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

    // Flag GLOBAL: el identificador es del niño, no del padre (§3.1-bis).
    const cambiarEstadoIdentificador = (identificadorId: string, activo: boolean) =>
        accion(
            () =>
                fetch(`/api/padre/hijos/identificadores/${identificadorId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ activo }),
                }),
            "No se pudo cambiar el identificador"
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
            "No se pudo agregar el identificador"
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
                    Registra a tus hijos y a los familiares cercanos. Si alguien reporta uno de sus
                    identificadores (su Roblox, un teléfono, un correo), te avisamos.
                </p>
                {maximoActivos !== undefined && activos >= maximoActivos && (
                    <p className="mt-2 rounded-xl border border-ambar/40 bg-ambar/10 px-3 py-2 text-sm text-ambar" role="status">
                        Tienes {activos} de {maximoActivos} menores activos. Si quieres registrar otro,
                        primero inactiva uno.
                    </p>
                )}
            </header>

            <GlassCard className="p-4">
                <form onSubmit={registrar} className="space-y-3" data-testid="form-hijo">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Input label="Nombres" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                        <Input label="Apellidos" value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} />
                        <Select label="Tipo de documento" options={DOCUMENTO_TIPOS} value={form.documentoTipo} onChange={(e) => setForm({ ...form, documentoTipo: e.target.value })} />
                        <Input label="Número de documento" value={form.documentoNumero} onChange={(e) => setForm({ ...form, documentoNumero: e.target.value })} required />
                        <Select
                            label="Edad"
                            options={[
                                { value: "", label: "Sin especificar" },
                                ...edadesMenor().map((e) => ({ value: String(e), label: `${e} años` })),
                            ]}
                            value={form.edad}
                            onChange={(e) => setForm({ ...form, edad: e.target.value })}
                        />
                        <Select label="Sexo" options={SEXOS} value={form.sexo} onChange={(e) => setForm({ ...form, sexo: e.target.value })} />
                    </div>

                    <div className="rounded-xl border border-cielo/40 p-3 dark:border-cielo/30">
                        <p className="text-sm font-medium text-body">Sus identificadores</p>
                        <p className="mb-2 text-xs text-muted">
                            Agrega todos los que conozcas: su usuario de Roblox, su teléfono, su correo.
                            Puedes sumar más después.
                        </p>
                        {nuevos.length > 0 && (
                            <ul className="mb-2 flex flex-wrap gap-2" data-testid="identificadores-nuevos">
                                {nuevos.map((i, idx) => (
                                    <li key={`${i.valor}-${i.plataformaId}-${idx}`} className="inline-flex items-center gap-1">
                                        <Badge>
                                            {i.valor}
                                            {i.plataformaId
                                                ? ` · ${plataformas.find((p) => p.id === i.plataformaId)?.nombre ?? ""}`
                                                : ""}
                                        </Badge>
                                        <button
                                            type="button"
                                            aria-label={`Sacar ${i.valor} de la lista`}
                                            className="text-xs text-muted hover:text-rubi"
                                            onClick={() => setNuevos((lista) => lista.filter((_, j) => j !== idx))}
                                        >
                                            ✕
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
                            <Input
                                label="Identificador"
                                placeholder="su Roblox, teléfono, correo…"
                                value={borrador.valor}
                                onChange={(e) => setBorrador({ ...borrador, valor: e.target.value })}
                            />
                            <Select
                                label="Plataforma"
                                options={opcionesPlataforma}
                                value={borrador.plataformaId}
                                onChange={(e) => setBorrador({ ...borrador, plataformaId: e.target.value })}
                            />
                            <Button type="button" variant="outline" onClick={agregarBorrador} disabled={!borrador.valor.trim()}>
                                Agregar otro
                            </Button>
                        </div>
                    </div>

                    <Button type="submit" isLoading={guardando} disabled={guardando}>
                        Registrar
                    </Button>
                </form>
                {error && <p className="mt-2 text-sm text-rubi" data-testid="mis-hijos-error">{error}</p>}
            </GlassCard>

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
                                onCambiarEstadoIdentificador={cambiarEstadoIdentificador}
                                onDesvincular={desvincular}
                                onAgregarIdentificador={agregarIdentificador}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function HijoCard({
    hijo,
    opcionesPlataforma,
    onCambiarEstadoHijo,
    onCambiarEstadoIdentificador,
    onDesvincular,
    onAgregarIdentificador,
}: {
    hijo: Hijo;
    opcionesPlataforma: { value: string; label: string }[];
    onCambiarEstadoHijo: (hijoId: string, estado: "activo" | "inactivo") => Promise<void>;
    onCambiarEstadoIdentificador: (identificadorId: string, activo: boolean) => Promise<void>;
    onDesvincular: (identificadorId: string) => Promise<void>;
    onAgregarIdentificador: (hijoId: string, valor: string, plataformaId: string) => Promise<void>;
}) {
    const [nuevo, setNuevo] = useState({ valor: "", plataformaId: "" });
    const inactivo = hijo.estado === "inactivo";

    return (
        <GlassCard className={`p-4 ${inactivo ? "opacity-60" : ""}`} data-testid={`hijo-${hijo.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-body">
                            {hijo.nombre} {hijo.apellidos}
                        </span>
                        {inactivo && <Badge variant="neutral">Inactivo</Badge>}
                    </div>
                    <div className="text-xs text-muted">
                        {hijo.documentoTipo} {hijo.documentoNumero}
                        {hijo.anioNacimiento ? ` · ${new Date().getFullYear() - hijo.anioNacimiento} años` : ""}
                    </div>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => onCambiarEstadoHijo(hijo.id, inactivo ? "activo" : "inactivo")}
                >
                    {inactivo ? "Activar" : "Inactivar"}
                </Button>
            </div>

            {hijo.identificadores.length > 0 && (
                <ul className="mt-3 space-y-2">
                    {hijo.identificadores.map((i) => (
                        <li key={i.id} className="flex flex-wrap items-center gap-2">
                            <Badge variant={i.activo ? "default" : "neutral"}>
                                {i.valor}
                                {i.plataforma ? ` · ${i.plataforma.nombre}` : ""}
                            </Badge>
                            {!i.activo && <span className="text-xs text-muted">inactivo</span>}
                            {/* Flag GLOBAL: también le cambia al otro padre del niño. */}
                            <button
                                type="button"
                                aria-label={`${i.activo ? "Inactivar" : "Activar"} ${i.valor} para todos`}
                                title="El identificador es del niño: el cambio también aplica al otro padre"
                                className="text-xs text-muted underline hover:text-body"
                                onClick={() => onCambiarEstadoIdentificador(i.id, !i.activo)}
                            >
                                {i.activo ? "Inactivar" : "Activar"}
                            </button>
                            {/* Solo esta cuenta: no borra el registro compartido. */}
                            <button
                                type="button"
                                aria-label={`Quitar ${i.valor}`}
                                title="Lo saca de tu lista; el otro padre lo sigue viendo"
                                className="text-xs text-muted underline hover:text-rubi"
                                onClick={() => onDesvincular(i.id)}
                            >
                                Quitar de mi lista
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
                <Input
                    label="Agregar identificador"
                    placeholder="su Roblox, teléfono, correo…"
                    value={nuevo.valor}
                    onChange={(e) => setNuevo({ ...nuevo, valor: e.target.value })}
                />
                <Select
                    label="Plataforma"
                    options={opcionesPlataforma}
                    value={nuevo.plataformaId}
                    onChange={(e) => setNuevo({ ...nuevo, plataformaId: e.target.value })}
                />
                <Button
                    type="button"
                    variant="outline"
                    disabled={!nuevo.valor.trim()}
                    onClick={async () => {
                        await onAgregarIdentificador(hijo.id, nuevo.valor.trim(), nuevo.plataformaId);
                        setNuevo({ valor: "", plataformaId: "" });
                    }}
                >
                    Agregar
                </Button>
            </div>
        </GlassCard>
    );
}
