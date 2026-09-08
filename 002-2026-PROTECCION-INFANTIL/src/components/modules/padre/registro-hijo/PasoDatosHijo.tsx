"use client";

import type { FormEvent, Ref } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { SEXOS } from "../HijoCard";
import { ChipEdad } from "./ChipEdad";
import { PreviewCirculoVivo } from "./PreviewCirculoVivo";
import type { DatosHijoForm, ErroresPasoDatos, IdentificadorNuevo } from "./types";

/**
 * SPEC-599 · Paso 2 del wizard: datos del hijo. Mismos campos y obligatoriedad
 * que el formulario real de SPEC-589 (nombre/apellidos obligatorios; edad, sexo
 * e identificadores opcionales). El preview del círculo a la derecha se
 * actualiza en vivo mientras el padre escribe.
 */
export function PasoDatosHijo({
    tituloRef,
    form,
    errores,
    nuevos,
    borrador,
    opcionesPlataforma,
    guardando,
    onCambio,
    onBorrador,
    onAgregarBorrador,
    onQuitarIdentificador,
    onAtras,
    onSubmit,
}: {
    tituloRef: Ref<HTMLHeadingElement>;
    form: DatosHijoForm;
    errores: ErroresPasoDatos;
    nuevos: IdentificadorNuevo[];
    borrador: IdentificadorNuevo;
    opcionesPlataforma: { value: string; label: string }[];
    guardando: boolean;
    onCambio: (patch: Partial<DatosHijoForm>) => void;
    onBorrador: (patch: Partial<IdentificadorNuevo>) => void;
    onAgregarBorrador: () => void;
    onQuitarIdentificador: (indice: number) => void;
    onAtras: () => void;
    onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
    const edadEtiquetaId = "lbl-edad-chips";
    return (
        <div>
            <p className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-estado-pino">
                <span aria-hidden="true" className="h-0.5 w-[22px] rounded-full bg-pino" />
                Paso 2 de 4
            </p>
            <h2 ref={tituloRef} tabIndex={-1} className="text-2xl font-bold leading-tight tracking-tight text-body sm:text-3xl">
                Cuéntanos de tu hijo
            </h2>
            <p className="mt-3 max-w-[62ch] text-[15.5px] leading-relaxed text-muted">
                Solo lo esencial. Las cuentas que agregues son las que vamos a cuidar.
            </p>

            <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1.08fr_0.92fr]">
                {/* El form conserva data-testid="form-hijo": es el contrato del alta. */}
                <form onSubmit={onSubmit} data-testid="form-hijo" noValidate className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            label="Nombres"
                            value={form.nombre}
                            onChange={(e) => onCambio({ nombre: e.target.value })}
                            error={errores.nombre}
                            required
                            autoComplete="off"
                        />
                        <Input
                            label="Apellidos"
                            value={form.apellidos}
                            onChange={(e) => onCambio({ apellidos: e.target.value })}
                            error={errores.apellidos}
                            required
                            autoComplete="off"
                        />
                    </div>

                    <div>
                        {/* Etiqueta del grupo de chips: `aria-labelledby`, no <label> (no control único). */}
                        <p id={edadEtiquetaId} className="mb-1.5 text-sm font-medium text-body">
                            Edad <span className="font-normal text-subtle">(opcional)</span>
                        </p>
                        <ChipEdad value={form.edad} onChange={(edad) => onCambio({ edad })} etiquetaId={edadEtiquetaId} />
                    </div>

                    <div className="sm:w-1/2">
                        <Select
                            label="Sexo"
                            options={SEXOS}
                            value={form.sexo}
                            onChange={(e) => onCambio({ sexo: e.target.value })}
                        />
                    </div>

                    <div className="rounded-2xl border border-cielo/40 p-4 dark:border-cielo/30">
                        <p className="text-sm font-medium text-body">Sus cuentas</p>
                        <p className="mb-3 text-xs text-muted">
                            Agrega todos los que conozcas: su usuario de Roblox, su teléfono, su correo.
                            Puedes sumar más después.
                        </p>
                        {nuevos.length > 0 && (
                            <ul className="mb-3 flex flex-wrap gap-2" data-testid="identificadores-nuevos">
                                {nuevos.map((i, idx) => (
                                    <li key={`${i.valor}-${i.plataformaId}-${idx}`} className="inline-flex items-center gap-1">
                                        <Badge>
                                            {i.valor}
                                            {i.plataformaId
                                                ? ` · ${opcionesPlataforma.find((p) => p.value === i.plataformaId)?.label ?? ""}`
                                                : ""}
                                        </Badge>
                                        <button
                                            type="button"
                                            aria-label={`Sacar ${i.valor} de la lista`}
                                            className="text-xs text-muted hover:text-rubi"
                                            onClick={() => onQuitarIdentificador(idx)}
                                        >
                                            ✕
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[2fr_1fr_auto]">
                            <Input
                                label="Cuenta"
                                placeholder="su Roblox, teléfono, correo…"
                                value={borrador.valor}
                                onChange={(e) => onBorrador({ valor: e.target.value })}
                                autoComplete="off"
                            />
                            <Select
                                label="Plataforma"
                                options={opcionesPlataforma}
                                value={borrador.plataformaId}
                                onChange={(e) => onBorrador({ plataformaId: e.target.value })}
                            />
                            <Button type="button" variant="outline" onClick={onAgregarBorrador} disabled={!borrador.valor.trim()}>
                                Agregar otro
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={onAtras}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M19 12H5m6 6-6-6 6-6" />
                            </svg>
                            Atrás
                        </Button>
                        <Button type="submit" isLoading={guardando} disabled={guardando}>
                            Ver cómo queda en mi círculo
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 12h14m-6-6 6 6-6 6" />
                            </svg>
                        </Button>
                    </div>
                </form>

                <aside
                    aria-label="Vista previa de tu círculo de confianza"
                    className="rounded-2xl border border-tinta/10 bg-papel/60 p-5 shadow-sm lg:sticky lg:top-6"
                >
                    <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-body">Tu círculo de confianza</p>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-estado-pino">
                            <i aria-hidden="true" className="anim-pulso inline-block h-[7px] w-[7px] rounded-full bg-pino" />
                            Vista previa
                        </span>
                    </div>
                    <p className="mb-2 text-xs text-subtle">Se actualiza mientras escribes.</p>
                    <PreviewCirculoVivo
                        nombre={form.nombre}
                        apellidos={form.apellidos}
                        edad={form.edad}
                        totalCuentas={nuevos.length}
                        tono="verde"
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-4 border-t border-dashed border-tinta/15 pt-2.5 text-[11.5px] text-subtle">
                        <span className="inline-flex items-center gap-1.5">
                            <i aria-hidden="true" className="h-2 w-2 rounded-full bg-pino" /> Sin reportes
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <i aria-hidden="true" className="h-2 w-2 rounded-full bg-ambar" /> Requiere atención
                        </span>
                    </div>
                </aside>
            </div>
        </div>
    );
}
