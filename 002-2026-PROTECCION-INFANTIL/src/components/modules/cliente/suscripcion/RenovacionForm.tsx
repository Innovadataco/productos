"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import type { OpcionRenovacion } from "@/lib/pagos/suscripcion-vista.types";
import { formatoLocal, formatoUSD, DURACION_LABEL, METODO_PAGO_LABEL, type Acento } from "./util";

const METODOS = Object.keys(METODO_PAGO_LABEL);

interface RenovacionExito {
    pagoId: string;
    estado: string;
    montoNetoUSD: number;
    montoLocalPagado: number;
    monedaLocal: string;
    comprobanteHashSha256: string;
}

/**
 * SPEC-211 (002-PI-111): formulario de renovación (AS-002/AS-003, FR-004/005).
 * Duración, precio local calculado, método de pago, códigos opcionales
 * (referido/bono), notas y upload de comprobante con validación cliente de
 * tamaño/tipo antes de enviar a POST /api/pagos/renovacion.
 */
export function RenovacionForm({
    suscripcionId,
    opciones,
    limites,
    descuentoReferidoPct,
    acento,
    onCerrar,
}: {
    suscripcionId: string;
    opciones: OpcionRenovacion[];
    limites: { tamanoMaxMB: number; formatosPermitidos: string[] };
    descuentoReferidoPct: number;
    acento: Acento;
    onCerrar: () => void;
}) {
    const router = useRouter();
    const [duracion, setDuracion] = useState(opciones[0]?.duracion ?? "");
    const [metodo, setMetodo] = useState("TRANSFERENCIA");
    const [codigoReferido, setCodigoReferido] = useState("");
    const [codigoBono, setCodigoBono] = useState("");
    const [notas, setNotas] = useState("");
    const [archivo, setArchivo] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cargando, setCargando] = useState(false);
    const [exito, setExito] = useState<RenovacionExito | null>(null);

    const opcion = useMemo(() => opciones.find((o) => o.duracion === duracion) ?? null, [opciones, duracion]);

    function validarArchivo(file: File): string | null {
        if (file.size > limites.tamanoMaxMB * 1024 * 1024) {
            return `El archivo excede el tamaño máximo permitido (${limites.tamanoMaxMB} MB)`;
        }
        const mime = file.type.trim().toLowerCase();
        if (!limites.formatosPermitidos.includes(mime)) {
            return `Formato no permitido. Usa: ${limites.formatosPermitidos.join(", ")}`;
        }
        return null;
    }

    async function enviar() {
        setError(null);
        if (!archivo) {
            setError("Adjunta el comprobante de pago");
            return;
        }
        const errorArchivo = validarArchivo(archivo);
        if (errorArchivo) {
            setError(errorArchivo);
            return;
        }

        setCargando(true);
        try {
            const formData = new FormData();
            formData.set("suscripcionId", suscripcionId);
            formData.set("duracion", duracion);
            formData.set("metodoDeclarado", metodo);
            if (notas.trim()) formData.set("notas", notas.trim());
            if (codigoReferido.trim()) formData.set("codigoReferido", codigoReferido.trim());
            if (codigoBono.trim()) formData.set("codigoBono", codigoBono.trim());
            formData.set("comprobante", archivo);

            const res = await fetch("/api/pagos/renovacion", { method: "POST", body: formData });
            if (!res.ok) {
                try {
                    const json = (await res.json()) as { error?: { message?: string } };
                    setError(json.error?.message ?? "No se pudo registrar la renovación");
                } catch {
                    setError("No se pudo registrar la renovación");
                }
                return;
            }
            setExito((await res.json()) as RenovacionExito);
            router.refresh();
        } finally {
            setCargando(false);
        }
    }

    if (exito) {
        return (
            <GlassCard data-testid="renovacion-exito" className="border border-pino/30 p-6">
                <h2 className="text-lg font-bold text-pino">Renovación reportada</h2>
                <p className="mt-2 text-sm text-body">
                    Tu pago quedó registrado como <span className="font-semibold">pendiente de autorización</span> por{" "}
                    {formatoLocal(exito.montoLocalPagado, exito.monedaLocal)} ({formatoUSD(exito.montoNetoUSD)}).
                </p>
                <p className="mt-2 break-all text-xs text-subtle">
                    Hash SHA256 del comprobante: {exito.comprobanteHashSha256}
                </p>
                <button
                    type="button"
                    onClick={onCerrar}
                    className={`mt-4 inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition ${acento.boton}`}
                >
                    Volver al resumen
                </button>
            </GlassCard>
        );
    }

    return (
        <GlassCard data-testid="renovacion-form" className="p-6">
            <h2 className="text-lg font-bold text-body">Renovar suscripción</h2>

            {opciones.length === 0 ? (
                <p className="mt-4 text-sm text-muted">
                    No hay planes activos disponibles para renovar en este momento. Contacta al equipo de soporte.
                </p>
            ) : (
                <div className="mt-5 grid gap-5">
                    <fieldset>
                        <legend className="text-sm font-medium text-body">Duración</legend>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {opciones.map((o) => (
                                <label
                                    key={o.duracion}
                                    className={`cursor-pointer rounded-xl border p-3 text-sm transition ${
                                        duracion === o.duracion
                                            ? `${acento.borde} ${acento.fondoSuave}`
                                            : "border-tinta/15 hover:border-tinta/30"
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="duracion"
                                        value={o.duracion}
                                        checked={duracion === o.duracion}
                                        onChange={() => setDuracion(o.duracion)}
                                        className="sr-only"
                                    />
                                    <span className="block font-semibold text-body">
                                        {DURACION_LABEL[o.duracion] ?? o.duracion}
                                    </span>
                                    <span className="mt-1 block text-muted">
                                        {o.montoLocal !== null
                                            ? formatoLocal(o.montoLocal, o.monedaLocal)
                                            : formatoUSD(o.precioNetoUSD)}
                                        {o.descuentoAnualPct > 0 && (
                                            <span className="ml-1 text-pino">(−{o.descuentoAnualPct}% anual)</span>
                                        )}
                                    </span>
                                </label>
                            ))}
                        </div>
                        {opcion && (
                            <p className="mt-2 text-xs text-subtle">
                                Precio: {formatoUSD(opcion.precioNetoUSD)}
                                {opcion.montoLocal !== null && ` ≈ ${formatoLocal(opcion.montoLocal, opcion.monedaLocal)}`}
                                . Los descuentos por bono o referido se aplican al enviar.
                            </p>
                        )}
                    </fieldset>

                    <div>
                        <label htmlFor="metodo-pago" className="block text-sm font-medium text-body">
                            Método de pago
                        </label>
                        <select
                            id="metodo-pago"
                            value={metodo}
                            onChange={(e) => setMetodo(e.target.value)}
                            className="glass-input mt-1.5 w-full max-w-xs rounded-xl px-4 py-2.5 text-sm text-body"
                        >
                            {METODOS.map((m) => (
                                <option key={m} value={m}>
                                    {METODO_PAGO_LABEL[m]}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="codigo-referido" className="block text-sm font-medium text-body">
                                Código de referido (opcional)
                            </label>
                            <input
                                id="codigo-referido"
                                type="text"
                                value={codigoReferido}
                                onChange={(e) => setCodigoReferido(e.target.value)}
                                maxLength={50}
                                placeholder={descuentoReferidoPct > 0 ? `−${descuentoReferidoPct}% si es válido` : "Código de quien te refirió"}
                                className="glass-input mt-1.5 w-full rounded-xl px-4 py-2.5 text-sm text-body placeholder:text-subtle"
                            />
                        </div>
                        <div>
                            <label htmlFor="codigo-bono" className="block text-sm font-medium text-body">
                                Código de bono (opcional)
                            </label>
                            <input
                                id="codigo-bono"
                                type="text"
                                value={codigoBono}
                                onChange={(e) => setCodigoBono(e.target.value)}
                                maxLength={100}
                                placeholder="Código promocional"
                                className="glass-input mt-1.5 w-full rounded-xl px-4 py-2.5 text-sm text-body placeholder:text-subtle"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="comprobante" className="block text-sm font-medium text-body">
                            Comprobante de pago
                        </label>
                        <input
                            id="comprobante"
                            type="file"
                            accept={limites.formatosPermitidos.join(",")}
                            onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                setArchivo(file);
                                setError(file ? validarArchivo(file) : null);
                            }}
                            className="mt-1.5 block w-full text-sm text-muted file:mr-4 file:rounded-xl file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-body"
                        />
                        <p className="mt-1 text-xs text-subtle">
                            Formatos: {limites.formatosPermitidos.join(", ")}. Máximo {limites.tamanoMaxMB} MB.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="notas-renovacion" className="block text-sm font-medium text-body">
                            Notas (opcional)
                        </label>
                        <textarea
                            id="notas-renovacion"
                            value={notas}
                            onChange={(e) => setNotas(e.target.value)}
                            maxLength={500}
                            rows={2}
                            className="glass-input mt-1.5 w-full rounded-xl px-4 py-2.5 text-sm text-body placeholder:text-subtle"
                            placeholder="Referencia de la transferencia, banco, etc."
                        />
                    </div>

                    {error && (
                        <p role="alert" className="text-sm font-medium text-rubi">
                            {error}
                        </p>
                    )}

                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={enviar}
                            disabled={cargando || !archivo}
                            className={`inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${acento.boton}`}
                        >
                            {cargando ? "Enviando…" : "Enviar renovación"}
                        </button>
                        <button
                            type="button"
                            onClick={onCerrar}
                            className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-muted transition hover:text-body"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </GlassCard>
    );
}
