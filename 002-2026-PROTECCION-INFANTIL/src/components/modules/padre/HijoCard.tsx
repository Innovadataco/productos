"use client";

/**
 * SPEC-539: la tarjeta de un menor, extraída de MisHijos.tsx (que superaba el
 * máximo de líneas). Incluye la edición inline de los datos del hijo (nombre,
 * apellidos, documento, año, sexo) contra el PATCH /api/padre/hijos/[id] existente.
 */
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { BitacoraMenor } from "./BitacoraMenor";
import { edadesMenor, anioDesdeEdad } from "@/lib/padre/documento-menor";

export const DOCUMENTO_TIPOS = [
    { value: "RC", label: "Registro civil" },
    { value: "TI", label: "Tarjeta de identidad" },
    { value: "CC", label: "Cédula" },
    { value: "CE", label: "Cédula de extranjería" },
    { value: "PASAPORTE", label: "Pasaporte" },
    { value: "OTRO", label: "Otro" },
];
export const SEXOS = [
    { value: "", label: "Prefiero no decir" },
    { value: "M", label: "Masculino" },
    { value: "F", label: "Femenino" },
    { value: "OTRO", label: "Otro" },
];

export type Plataforma = { id: string; clave: string; nombre: string };
export type Identificador = {
    id: string;
    valor: string;
    tipo: string | null;
    activo: boolean;
    plataforma: { id: string; nombre: string; clave: string } | null;
};
export type Hijo = {
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

export function HijoCard({
    hijo,
    opcionesPlataforma,
    onCambiarEstadoHijo,
    onEditarHijo,
    onCambiarEstadoIdentificador,
    onDesvincular,
    onAgregarIdentificador,
}: {
    hijo: Hijo;
    opcionesPlataforma: { value: string; label: string }[];
    onCambiarEstadoHijo: (hijoId: string, estado: "activo" | "inactivo") => Promise<void>;
    onEditarHijo: (
        hijoId: string,
        datos: {
            nombre: string;
            apellidos: string;
            documentoTipo: string;
            documentoNumero: string;
            anioNacimiento: number | null;
            sexo: string | null;
        }
    ) => Promise<void>;
    onCambiarEstadoIdentificador: (identificadorId: string, activo: boolean) => Promise<void>;
    onDesvincular: (identificadorId: string) => Promise<void>;
    onAgregarIdentificador: (hijoId: string, valor: string, plataformaId: string) => Promise<void>;
}) {
    const [nuevo, setNuevo] = useState({ valor: "", plataformaId: "" });
    const [verBitacora, setVerBitacora] = useState(false);
    const inactivo = hijo.estado === "inactivo";
    // SPEC-539: edición de los datos del menor (UI que faltaba sobre el PATCH existente).
    const [editando, setEditando] = useState(false);
    const [edicion, setEdicion] = useState({
        nombre: hijo.nombre,
        apellidos: hijo.apellidos,
        documentoTipo: hijo.documentoTipo,
        documentoNumero: hijo.documentoNumero,
        anioNacimiento: hijo.anioNacimiento ? String(hijo.anioNacimiento) : "",
        sexo: hijo.sexo ?? "",
    });
    const [guardandoEdicion, setGuardandoEdicion] = useState(false);

    async function guardarEdicion(e: React.FormEvent) {
        e.preventDefault();
        setGuardandoEdicion(true);
        try {
            await onEditarHijo(hijo.id, {
                nombre: edicion.nombre.trim(),
                apellidos: edicion.apellidos.trim(),
                documentoTipo: edicion.documentoTipo,
                documentoNumero: edicion.documentoNumero.trim(),
                anioNacimiento: edicion.anioNacimiento ? Number(edicion.anioNacimiento) : null,
                sexo: edicion.sexo || null,
            });
            setEditando(false);
        } finally {
            setGuardandoEdicion(false);
        }
    }

    return (
        <GlassCard className={`p-4 ${inactivo ? "opacity-60" : ""}`} data-testid={`hijo-${hijo.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-body">
                            {hijo.nombre} {hijo.apellidos}
                        </span>
                        {/* SPEC-362 (A-70 · G17 · regla 2 del brief): verde = activo,
                            gris = inactivo. Nunca rojo — el rojo choca con la regla
                            dura del producto y aquí no hay nada malo que señalar. */}
                        {inactivo ? (
                            <Badge variant="neutral">Inactivo</Badge>
                        ) : (
                            <span
                                data-testid="estado-activo"
                                className="inline-flex items-center gap-1.5 rounded-full bg-pino/10 px-2.5 py-0.5 text-xs font-semibold text-pino"
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-pino" aria-hidden="true" />
                                Activo
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-muted">
                        {hijo.documentoTipo} {hijo.documentoNumero}
                        {hijo.anioNacimiento ? ` · ${new Date().getFullYear() - hijo.anioNacimiento} años` : ""}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => setEditando((v) => !v)}>
                        {editando ? "Cancelar" : "Editar"}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onCambiarEstadoHijo(hijo.id, inactivo ? "activo" : "inactivo")}
                    >
                        {inactivo ? "Activar" : "Inactivar"}
                    </Button>
                </div>
            </div>

            {editando && (
                <form onSubmit={guardarEdicion} className="mt-3 space-y-3 rounded-xl border border-tinta/10 p-3" data-testid={`editar-hijo-${hijo.id}`}>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Input label="Nombres" value={edicion.nombre} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} />
                        <Input label="Apellidos" value={edicion.apellidos} onChange={(e) => setEdicion({ ...edicion, apellidos: e.target.value })} />
                        <Select label="Tipo de documento" options={DOCUMENTO_TIPOS} value={edicion.documentoTipo} onChange={(e) => setEdicion({ ...edicion, documentoTipo: e.target.value })} />
                        <Input label="Número de documento" value={edicion.documentoNumero} onChange={(e) => setEdicion({ ...edicion, documentoNumero: e.target.value })} />
                        {/* SPEC-565 (I-348): edad por SELECTOR (5-17), como en el alta — F8 de
                            SPEC-361: teclear el año a mano llevaba a valores absurdos. El value
                            es el AÑO derivado de la edad, así que siempre cae en el rango que el
                            servidor exige; el guardado no cambia. */}
                        <Select
                            label="Edad"
                            options={[
                                { value: "", label: "Sin especificar" },
                                ...edadesMenor().map((edad) => ({ value: String(anioDesdeEdad(edad)), label: `${edad} años` })),
                            ]}
                            value={edicion.anioNacimiento}
                            onChange={(e) => setEdicion({ ...edicion, anioNacimiento: e.target.value })}
                        />
                        <Select label="Sexo" options={SEXOS} value={edicion.sexo} onChange={(e) => setEdicion({ ...edicion, sexo: e.target.value })} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setEditando(false)} disabled={guardandoEdicion}>
                            Cancelar
                        </Button>
                        <Button type="submit" isLoading={guardandoEdicion} disabled={guardandoEdicion}>
                            Guardar cambios
                        </Button>
                    </div>
                </form>
            )}

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
                                title="La cuenta es del niño: el cambio también aplica al otro padre"
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
                    label="Agregar cuenta"
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

            {/* A-70 · F10 — la historia del cuidado, bajo demanda: si se cargara
                sola, abrir "A quién protejo" dispararía una consulta por cada
                menor de la lista para algo que casi nunca se mira. */}
            <div className="mt-3 border-t border-tinta/10 pt-3 dark:border-papel/10">
                <button
                    type="button"
                    className="text-xs text-muted underline hover:text-body"
                    aria-expanded={verBitacora}
                    onClick={() => setVerBitacora((v) => !v)}
                >
                    {verBitacora ? "Ocultar la bitácora" : "Ver la bitácora"}
                </button>
                {verBitacora && (
                    <div className="mt-3">
                        <BitacoraMenor hijoId={hijo.id} />
                    </div>
                )}
            </div>
        </GlassCard>
    );
}
