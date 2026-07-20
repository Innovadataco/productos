"use client";

import { Button } from "@/components/ui/Button";
import type { DetalleReporte, UseReporteDetalleResult } from "./types";
import { CATEGORIAS } from "./types";

interface AccionesReporteProps {
    reporte: DetalleReporte;
    puedeEscalarProp: boolean;
    textoAnonimizado: string;
    setTextoAnonimizado: (v: string) => void;
    categoriaCorreccion: string;
    setCategoriaCorreccion: (v: string) => void;
    motivoCorreccion: string;
    setMotivoCorreccion: (v: string) => void;
    actionLoading: boolean;
    confirmando: boolean;
    mostrarBaja: boolean;
    setMostrarBaja: (v: boolean) => void;
    motivoBaja: string;
    setMotivoBaja: (v: string) => void;
    notaBaja: string;
    setNotaBaja: (v: string) => void;
    mostrarReactivar: boolean;
    setMostrarReactivar: (v: boolean) => void;
    notaReactivar: string;
    setNotaReactivar: (v: string) => void;
    mostrarEscalar: boolean;
    setMostrarEscalar: (v: boolean) => void;
    motivoEscalar: string;
    setMotivoEscalar: (v: string) => void;
    observacionesValidacion: string;
    setObservacionesValidacion: (v: string) => void;
    validando: boolean;
    handleAnonimizar: () => Promise<void>;
    handleConfirmar: () => Promise<void>;
    handleCorregir: () => Promise<void>;
    handleBaja: () => Promise<void>;
    handleReactivar: () => Promise<void>;
    handleValidarAnonimizacion: (valida: boolean) => Promise<void>;
    handleEscalar: () => Promise<void>;
}

export function AccionesReporte({
    reporte,
    puedeEscalarProp,
    textoAnonimizado,
    setTextoAnonimizado,
    categoriaCorreccion,
    setCategoriaCorreccion,
    motivoCorreccion,
    setMotivoCorreccion,
    actionLoading,
    confirmando,
    mostrarBaja,
    setMostrarBaja,
    motivoBaja,
    setMotivoBaja,
    notaBaja,
    setNotaBaja,
    mostrarReactivar,
    setMostrarReactivar,
    notaReactivar,
    setNotaReactivar,
    mostrarEscalar,
    setMostrarEscalar,
    motivoEscalar,
    setMotivoEscalar,
    observacionesValidacion,
    setObservacionesValidacion,
    validando,
    handleAnonimizar,
    handleConfirmar,
    handleCorregir,
    handleBaja,
    handleReactivar,
    handleValidarAnonimizacion,
    handleEscalar,
}: AccionesReporteProps) {
    const estaEliminado = reporte.eliminado;
    const puedeAnonimizar = !estaEliminado && reporte.estado === "REQUIERE_ANONIMIZACION";
    const puedeCorregir = !estaEliminado && !!reporte.clasificacion && reporte.estado !== "CORREGIDO" && !reporte.clasificacion?.correccion;
    const puedeConfirmar = !estaEliminado && reporte.estado === "REVISION_MANUAL" && !!reporte.clasificacion && !reporte.clasificacion?.correccion;
    const puedeBaja = !estaEliminado;
    const puedeReactivar = estaEliminado;

    return (
        <div className="space-y-4">
            {puedeConfirmar && (
                <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4">
                    <h3 className="mb-2 font-medium text-body">Confirmar clasificación</h3>
                    <p className="mb-3 text-sm text-subtle">
                        La categoría sugerida por la IA es correcta. Esto registra una confirmación para las métricas de precisión.
                    </p>
                    <Button onClick={handleConfirmar} disabled={confirmando} variant="secondary">
                        {confirmando ? "Guardando..." : "Confirmar clasificación"}
                    </Button>
                </div>
            )}

            {puedeCorregir && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <h3 className="mb-2 font-medium text-body">Corregir clasificación</h3>
                    <select
                        data-testid="select-correccion-categoria"
                        className="mb-2 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                        value={categoriaCorreccion}
                        onChange={(e) => setCategoriaCorreccion(e.target.value)}
                    >
                        <option value="">Seleccionar categoría</option>
                        {CATEGORIAS.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
                    <textarea
                        className="mb-2 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                        rows={2}
                        placeholder="Motivo de la corrección (opcional)"
                        value={motivoCorreccion}
                        onChange={(e) => setMotivoCorreccion(e.target.value)}
                    />
                    <Button onClick={handleCorregir} disabled={actionLoading}>
                        {actionLoading ? "Guardando..." : "Corregir clasificación"}
                    </Button>
                </div>
            )}

            {puedeAnonimizar && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <h3 className="mb-2 font-medium text-body">Validar anonimización</h3>
                    <p className="mb-2 text-sm text-subtle">
                        Revisa el texto anonimizado. Si aún contiene datos personales, recházalo y deja una observación.
                    </p>
                    <textarea
                        className="mb-2 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                        rows={2}
                        placeholder="Observaciones (opcional)"
                        value={observacionesValidacion}
                        onChange={(e) => setObservacionesValidacion(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <Button onClick={() => handleValidarAnonimizacion(true)} disabled={validando}>
                            {validando ? "Validando..." : "Validar"}
                        </Button>
                        <Button onClick={() => handleValidarAnonimizacion(false)} disabled={validando} variant="secondary">
                            {validando ? "Validando..." : "Rechazar"}
                        </Button>
                    </div>
                </div>
            )}

            {puedeAnonimizar && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <h3 className="mb-2 font-medium text-body">Anonimizar reporte</h3>
                    <textarea
                        className="mb-1 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                        rows={6}
                        value={textoAnonimizado}
                        onChange={(e) => setTextoAnonimizado(e.target.value)}
                    />
                    <p className="mb-2 text-xs text-subtle">
                        {textoAnonimizado.length} / 5000 caracteres (mínimo 20)
                    </p>
                    <Button onClick={handleAnonimizar} disabled={actionLoading}>
                        {actionLoading ? "Anonimizando..." : "Confirmar anonimización"}
                    </Button>
                </div>
            )}

            {puedeEscalarProp && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
                    {!mostrarEscalar ? (
                        <>
                            <h3 className="mb-2 font-medium text-body">Escalar a comité</h3>
                            <p className="mb-3 text-sm text-subtle">
                                Solicite una segunda opinión especializada del comité de validación.
                            </p>
                            <Button onClick={() => setMostrarEscalar(true)} variant="secondary" disabled={actionLoading}>
                                Escalar a comité
                            </Button>
                        </>
                    ) : (
                        <>
                            <h3 className="mb-2 font-medium text-body">Confirmar escalamiento</h3>
                            <textarea
                                className="mb-2 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                                rows={4}
                                placeholder="Motivo del escalamiento (mín. 5 caracteres)"
                                value={motivoEscalar}
                                onChange={(e) => setMotivoEscalar(e.target.value)}
                            />
                            <p className="mb-2 text-xs text-subtle">
                                {motivoEscalar.length} / 4000 caracteres
                            </p>
                            <div className="flex gap-2">
                                <Button onClick={handleEscalar} disabled={actionLoading}>
                                    {actionLoading ? "Escalando..." : "Confirmar escalamiento"}
                                </Button>
                                <Button onClick={() => { setMostrarEscalar(false); setMotivoEscalar(""); }} variant="secondary" disabled={actionLoading}>
                                    Cancelar
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {puedeBaja && (
                <div className="rounded-lg border border-red-200 dark:border-red-800 p-4">
                    {!mostrarBaja ? (
                        <>
                            <h3 className="mb-2 font-medium text-body">Dar de baja el reporte</h3>
                            <p className="mb-3 text-sm text-subtle">
                                Desactiva el reporte, borra su embedding y recalcula score/visibilidad. Opcionalmente purga el ejemplo del dataset RAG.
                            </p>
                            <Button onClick={() => setMostrarBaja(true)} variant="secondary" disabled={actionLoading}>
                                Dar de baja
                            </Button>
                        </>
                    ) : (
                        <>
                            <h3 className="mb-2 font-medium text-body">Confirmar baja</h3>
                            <select
                                className="mb-2 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                                value={motivoBaja}
                                onChange={(e) => setMotivoBaja(e.target.value)}
                            >
                                <option value="">Seleccionar motivo</option>
                                <option value="RETIRO_LIMPIEZA">Retiro por limpieza de datos</option>
                                <option value="REPORTE_FALSO">Reporte falso</option>
                                <option value="ORDEN_LEGAL">Orden legal</option>
                            </select>
                            <textarea
                                className="mb-2 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                                rows={3}
                                placeholder="Nota obligatoria (máx. 2000 caracteres)"
                                value={notaBaja}
                                onChange={(e) => setNotaBaja(e.target.value)}
                            />
                            <p className="mb-2 text-xs text-subtle">
                                {notaBaja.length} / 2000 caracteres
                            </p>
                            <div className="flex gap-2">
                                <Button onClick={handleBaja} disabled={actionLoading}>
                                    {actionLoading ? "Procesando..." : "Confirmar baja"}
                                </Button>
                                <Button onClick={() => { setMostrarBaja(false); setMotivoBaja(""); setNotaBaja(""); }} variant="secondary" disabled={actionLoading}>
                                    Cancelar
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {puedeReactivar && (
                <div className="rounded-lg border border-green-200 dark:border-green-800 p-4">
                    {!mostrarReactivar ? (
                        <>
                            <h3 className="mb-2 font-medium text-body">Reactivar reporte</h3>
                            <p className="mb-3 text-sm text-subtle">
                                Deshace la baja, regenera el embedding vía Ollama y recalcula score/visibilidad. Si se purgó dataset, no se restaura.
                            </p>
                            <Button onClick={() => setMostrarReactivar(true)} variant="secondary" disabled={actionLoading}>
                                Reactivar reporte
                            </Button>
                        </>
                    ) : (
                        <>
                            <h3 className="mb-2 font-medium text-body">Confirmar reactivación</h3>
                            <textarea
                                className="mb-2 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                                rows={3}
                                placeholder="Nota obligatoria (máx. 2000 caracteres)"
                                value={notaReactivar}
                                onChange={(e) => setNotaReactivar(e.target.value)}
                            />
                            <p className="mb-2 text-xs text-subtle">
                                {notaReactivar.length} / 2000 caracteres
                            </p>
                            <div className="flex gap-2">
                                <Button onClick={handleReactivar} disabled={actionLoading}>
                                    {actionLoading ? "Procesando..." : "Confirmar reactivación"}
                                </Button>
                                <Button onClick={() => { setMostrarReactivar(false); setNotaReactivar(""); }} variant="secondary" disabled={actionLoading}>
                                    Cancelar
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
