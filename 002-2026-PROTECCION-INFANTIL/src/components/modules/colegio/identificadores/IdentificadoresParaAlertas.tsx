"use client";

/**
 * SPEC-932 · «Identificadores para alertas» — EL componente único (FORMA SPEC-931 §1/§6, canon = Profesor).
 *
 * Lo consumen los 4 sujetos del colegio: profesor, estudiante, acudiente y integrante del comité. Antes había
 * 3 implementaciones que divergían (el comité con form inline + `<ul>`, sin Plataforma ni Editar; el estudiante
 * sin Editar). Con un solo componente no pueden volver a divergir; el candado
 * `identificadores-patron-unico.candado.test.ts` exige que las 4 pantallas lo rendericen.
 *
 * Forma: tabla Valor·Tipo·Plataforma·[Relación]·Estado·Acciones + modal Valor+Plataforma(+Relación) + Editar +
 * Activar/Desactivar. El Tipo NO se pide: lo infiere el backend del valor.
 *
 * Lo que cambia por sujeto vive en el ADAPTADOR (`api`): los endpoints y la forma del body de cada rol. La
 * «Relación» (`etiquetaRelacion`) es una EXTENSIÓN solo del estudiante (§2.2), opt-in por `relacion`.
 *
 * I-429 · el motor compara SOLO el VALOR, no la plataforma: el copy dice «estos valores», nunca «esta cuenta en
 * esta plataforma». La plataforma es etiqueta organizativa, no llave de la alerta.
 *
 * Voz: usted (colegio).
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";

export interface IdentificadorAlerta {
    id: string;
    tipo: string;
    valor: string;
    plataformaId?: string | null;
    plataforma: { id: string; nombre: string; clave?: string } | null;
    estado: string;
    etiquetaRelacion?: string;
}

export interface DatosIdentificador {
    valor: string;
    plataformaId: string | null;
    etiquetaRelacion?: string;
    /** Warn-override (SPEC-320): el colegio confirma que el valor se comparte con otra persona. */
    confirmarCompartido?: boolean;
}

/** Endpoints del sujeto. Cada función hace SU fetch (URL + body propios del rol). */
export interface ApiIdentificadores {
    crear(datos: DatosIdentificador): Promise<Response>;
    editar(identificador: IdentificadorAlerta, datos: DatosIdentificador): Promise<Response>;
    cambiarEstado(identificador: IdentificadorAlerta, nuevoEstado: "activo" | "inactivo"): Promise<Response>;
}

export interface OpcionRelacion {
    value: string;
    label: string;
}

export interface IdentificadoresParaAlertasProps {
    identificadores: IdentificadorAlerta[];
    api: ApiIdentificadores;
    /** Recargar la lista del padre después de guardar o cambiar el estado. */
    onCambio: () => void | Promise<void>;
    /** Extensión del estudiante (§2.2): columna + selector «Relación». */
    relacion?: { opciones: OpcionRelacion[]; porDefecto: string };
    /** Copy de éxito propio del sujeto (p. ej. el del comité). */
    mensajeAgregado?: string;
    /** «tarjeta» = sección propia (GlassCard). «anidado» = dentro de otra tarjeta (acudiente). */
    variante?: "tarjeta" | "anidado";
}

type Plataforma = { id: string; nombre: string };
type Mensaje = { type: "success" | "error"; text: string } | null;
type Aviso = { message: string; pertenece: { nombre: string; rol: string }[] } | null;

export const TITULO_IDENTIFICADORES = "Identificadores para alertas";
/** FORMA §1 · afirmación de conducta verificada (§5): «valores», nunca «en esta plataforma» (I-429). */
export const DESCRIPCION_IDENTIFICADORES =
    "Registre las cuentas que quiere vigilar (usuario, teléfono o correo). Si alguien reporta uno de estos valores, el aviso llega al colegio — nunca a la persona.";

/**
 * SPEC-874 (I-415) · aviso NEUTRO bajo el selector: «cargando» ≠ «cargado-vacío». El ERROR va en su caja ámbar.
 */
export function hintCargaPlataformas(errorPlataformas: boolean, plataformasCargadas: boolean, cantidad: number): string | null {
    if (errorPlataformas) return null;
    if (!plataformasCargadas) return "Cargando plataformas… el guardado se habilita cuando estén disponibles.";
    if (cantidad === 0) return "No hay plataformas disponibles en este momento.";
    return null;
}

function etiquetaEstado(estado: string): string {
    return estado === "activo" ? "Activo" : "Inactivo";
}

export function IdentificadoresParaAlertas({
    identificadores,
    api,
    onCambio,
    relacion,
    mensajeAgregado = "Identificador agregado",
    variante = "tarjeta",
}: IdentificadoresParaAlertasProps) {
    const vacio = { valor: "", plataformaId: "", etiquetaRelacion: relacion?.porDefecto ?? "" };
    const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
    const [errorPlataformas, setErrorPlataformas] = useState(false);
    const [plataformasCargadas, setPlataformasCargadas] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(vacio);
    const [editando, setEditando] = useState<IdentificadorAlerta | null>(null);
    const [message, setMessage] = useState<Mensaje>(null);
    const [aviso, setAviso] = useState<Aviso>(null);

    useEffect(() => {
        void cargarPlataformas();
    }, []);

    // /api/plataformas responde { plataformas: [...] }; error visible con reintento (SPEC-173, H03).
    async function cargarPlataformas() {
        try {
            const res = await fetch("/api/plataformas", { credentials: "include" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: unknown = await res.json();
            const lista = (data as { plataformas?: unknown }).plataformas;
            setPlataformas(Array.isArray(lista) ? (lista as Plataforma[]) : []);
            setErrorPlataformas(false);
            setPlataformasCargadas(true);
        } catch {
            setErrorPlataformas(true);
        }
    }

    function abrirNuevo() {
        setEditando(null);
        setForm(vacio);
        setAviso(null);
        setModalOpen(true);
    }

    function abrirEditar(identificador: IdentificadorAlerta) {
        setEditando(identificador);
        setForm({
            valor: identificador.valor,
            plataformaId: identificador.plataformaId ?? identificador.plataforma?.id ?? "",
            etiquetaRelacion: identificador.etiquetaRelacion ?? relacion?.porDefecto ?? "",
        });
        setAviso(null);
        setModalOpen(true);
    }

    function cerrarModal() {
        setModalOpen(false);
        setAviso(null);
    }

    async function guardar(confirmarCompartido = false) {
        if (!form.valor.trim()) return;
        setSaving(true);
        setMessage(null);
        const datos: DatosIdentificador = {
            valor: form.valor.trim(),
            plataformaId: form.plataformaId || null,
            ...(relacion ? { etiquetaRelacion: form.etiquetaRelacion } : {}),
            ...(confirmarCompartido ? { confirmarCompartido: true } : {}),
        };
        try {
            const res = editando ? await api.editar(editando, datos) : await api.crear(datos);
            const data = await res.json().catch(() => ({}));
            if (res.ok && data?.aviso) {
                // SPEC-320 warn-override: el backend NO guardó; pide confirmar que el valor se comparte.
                setAviso({ message: data.aviso.message, pertenece: data.aviso.pertenece ?? [] });
                return;
            }
            if (res.ok) {
                setModalOpen(false);
                setAviso(null);
                setEditando(null);
                setForm(vacio);
                setMessage({ type: "success", text: editando ? "Identificador actualizado" : mensajeAgregado });
                await onCambio();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "No pudimos guardar el identificador." });
                setModalOpen(false);
            }
        } catch {
            setMessage({ type: "error", text: "Error de red al guardar el identificador." });
            setModalOpen(false);
        } finally {
            setSaving(false);
        }
    }

    async function toggleEstado(identificador: IdentificadorAlerta) {
        const nuevoEstado = identificador.estado === "activo" ? "inactivo" : "activo";
        setMessage(null);
        try {
            const res = await api.cambiarEstado(identificador, nuevoEstado);
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: `Identificador ${nuevoEstado === "activo" ? "activado" : "desactivado"}` });
                await onCambio();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "No pudimos cambiar el estado." });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red al cambiar el estado." });
        }
    }

    const hintPlataformas = hintCargaPlataformas(errorPlataformas, plataformasCargadas, plataformas.length);
    const etiquetaRelacion = (valor: string | undefined) =>
        relacion?.opciones.find((o) => o.value === valor)?.label ?? valor ?? "—";

    const encabezado =
        variante === "tarjeta" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-body">{TITULO_IDENTIFICADORES}</h2>
                    <p className="mt-1 text-sm text-muted">{DESCRIPCION_IDENTIFICADORES}</p>
                </div>
                <Button onClick={abrirNuevo} className="shrink-0">
                    Nuevo identificador
                </Button>
            </div>
        ) : (
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-body">{TITULO_IDENTIFICADORES}</h3>
                <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={abrirNuevo}>
                    Nuevo identificador
                </Button>
            </div>
        );

    const cuerpo = (
        <>
            {encabezado}

            {message && (
                <div
                    className={`mt-4 rounded-xl p-4 text-sm ${
                        message.type === "error"
                            ? "bg-rubi/10 text-estado-rubi dark:bg-rubi/20"
                            : "bg-pino/10 text-estado-pino dark:bg-pino/20"
                    }`}
                    role={message.type === "error" ? "alert" : "status"}
                >
                    {message.text}
                </div>
            )}

            {identificadores.length === 0 ? (
                <EmptyState
                    title="No hay identificadores"
                    description="Agregue un identificador para usarlo en futuras alertas."
                    action={<Button onClick={abrirNuevo}>Agregar identificador</Button>}
                />
            ) : (
                <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-tinta/15">
                            <tr className="text-subtle">
                                <th className="pb-3 font-medium">Valor</th>
                                <th className="pb-3 font-medium">Tipo</th>
                                <th className="pb-3 font-medium">Plataforma</th>
                                {relacion && <th className="pb-3 font-medium">Relación</th>}
                                <th className="pb-3 font-medium">Estado</th>
                                <th className="pb-3 font-medium text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-tinta/10">
                            {identificadores.map((identificador) => (
                                <tr key={identificador.id} className="align-top">
                                    <td className="py-3 pr-3 font-medium text-body">{identificador.valor}</td>
                                    <td className="py-3 pr-3 text-muted">{identificador.tipo}</td>
                                    <td className="py-3 pr-3 text-muted">{identificador.plataforma?.nombre || "—"}</td>
                                    {relacion && (
                                        <td className="py-3 pr-3 text-muted">{etiquetaRelacion(identificador.etiquetaRelacion)}</td>
                                    )}
                                    <td className="py-3 pr-3">
                                        <Badge variant={identificador.estado === "activo" ? "success" : "neutral"}>
                                            {etiquetaEstado(identificador.estado)}
                                        </Badge>
                                    </td>
                                    <td className="py-3 text-right">
                                        <span className="inline-flex flex-wrap justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                className="px-3 py-1.5 text-xs"
                                                onClick={() => abrirEditar(identificador)}
                                            >
                                                Editar
                                            </Button>
                                            <Button
                                                variant={identificador.estado === "activo" ? "danger" : "secondary"}
                                                className="px-3 py-1.5 text-xs"
                                                onClick={() => toggleEstado(identificador)}
                                            >
                                                {identificador.estado === "activo" ? "Desactivar" : "Activar"}
                                            </Button>
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={modalOpen} onClose={cerrarModal} title={editando ? "Editar identificador" : "Agregar identificador"}>
                <div className="space-y-4">
                    <Input
                        label="Valor"
                        required
                        maxLength={255}
                        value={form.valor}
                        onChange={(e) => setForm({ ...form, valor: e.target.value })}
                        placeholder="Ej. +573001234567, correo@dominio.com o nick"
                    />
                    {/* SPEC-874 (I-415): falla TRANSITORIA → ÁMBAR operativo, NUNCA rubí (D-120). */}
                    {errorPlataformas && (
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-ambar/10 p-3 text-sm text-estado-ambar dark:bg-ambar/20">
                            <span>No pudimos cargar las plataformas. Suele ser temporal.</span>
                            <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={cargarPlataformas}>
                                Reintentar
                            </Button>
                        </div>
                    )}
                    <Select
                        label="Plataforma"
                        options={[{ value: "", label: "Ninguna / General" }, ...plataformas.map((p) => ({ value: p.id, label: p.nombre }))]}
                        value={form.plataformaId}
                        onChange={(e) => setForm({ ...form, plataformaId: e.target.value })}
                    />
                    {hintPlataformas && <p className="text-xs text-muted">{hintPlataformas}</p>}
                    {relacion && (
                        <Select
                            label="Relación"
                            options={relacion.opciones}
                            value={form.etiquetaRelacion}
                            onChange={(e) => setForm({ ...form, etiquetaRelacion: e.target.value })}
                        />
                    )}
                    {/* SPEC-320 warn-override: el valor ya está registrado para otra persona del colegio. El
                        backend NO guardó; el colegio decide si lo comparte. Ámbar (operativo), no rubí. */}
                    {aviso && (
                        <div className="space-y-2 rounded-xl bg-ambar/10 p-3 text-sm text-estado-ambar dark:bg-ambar/20" role="alert">
                            <p>{aviso.message}</p>
                            {aviso.pertenece.length > 0 && (
                                <p>{aviso.pertenece.map((p) => `${p.nombre} (${p.rol.toLowerCase()})`).join(", ")}</p>
                            )}
                            <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => guardar(true)} isLoading={saving}>
                                Guardar de todos modos
                            </Button>
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        <Button onClick={() => guardar()} isLoading={saving} disabled={plataformas.length === 0}>
                            Guardar
                        </Button>
                        <Button variant="outline" onClick={cerrarModal}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );

    return variante === "tarjeta" ? <GlassCard>{cuerpo}</GlassCard> : <div className="mt-3">{cuerpo}</div>;
}
