"use client";

/**
 * SPEC-601 · FormularioAltaHijo — alta inline simple de hijo, restaurada de la
 * versión pre-SPEC-599 de `MisHijos.tsx` (commit e74e1a44a^). El dueño pidió
 * revertir el wizard: «esta ventana estaba bien, reversa el último cambio».
 * El wizard (SPEC-599) se retiró: hoy esta alta inline es la ÚNICA variante,
 * tanto en `/camino/hijos` (paso 3) como en `/dashboard/padre/hijos` (vía
 * `MisHijos`).
 *
 * Contrato del POST `/api/padre/hijos`: validaciones de `documento-menor`,
 * alta múltiple de identificadores y payload sin documento (SPEC-589: nombre y
 * apellidos obligatorios; año de nacimiento/sexo/cuentas opcionales — el AÑO,
 * no una edad congelada, por SPEC-627 D-134). El payload compartido vive en
 * `registro-hijo/payload.ts`.
 */
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { aniosNacimientoMenor, edadDesdeAnio, validarAnioNacimientoMenor } from "@/lib/padre/documento-menor";
import { SEXOS } from "./HijoCard";
import { construirPayloadAltaHijo, type IdentificadorNuevo } from "./registro-hijo/payload";

const FORM_VACIO = { nombre: "", apellidos: "", anioNacimiento: "", sexo: "" };
const BORRADOR_VACIO: IdentificadorNuevo = { valor: "", plataformaId: "" };

export function FormularioAltaHijo({
    opcionesPlataforma,
    onRegistrado,
}: {
    opcionesPlataforma: { value: string; label: string }[];
    onRegistrado: () => Promise<void>;
}) {
    const [form, setForm] = useState(FORM_VACIO);
    // Identificadores del alta: se agregan a una lista ANTES de crear al hijo,
    // así el padre carga todos los que conoce (Roblox, teléfono, correo) de una.
    const [nuevos, setNuevos] = useState<IdentificadorNuevo[]>([]);
    const [borrador, setBorrador] = useState<IdentificadorNuevo>(BORRADOR_VACIO);
    const [error, setError] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    // SPEC-721: una cuenta sin plataforma no se puede vigilar (I-429: sin la red no
    // se sabe si un reporte es sobre tu hijo o sobre otra persona con el mismo
    // usuario). Por eso NO se agrega sin la red — el botón queda inactivo hasta que
    // estén el valor Y la plataforma; este guardia es su contraparte en la lógica.
    function agregarBorrador() {
        const valor = borrador.valor.trim();
        if (!valor || !borrador.plataformaId) return;
        setNuevos((lista) => [...lista, { valor, plataformaId: borrador.plataformaId }]);
        setBorrador(BORRADOR_VACIO);
    }

    async function registrar(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!form.nombre.trim()) {
            setError("Escribe el nombre del menor.");
            return;
        }
        if (!form.apellidos.trim()) {
            setError("Escribe los apellidos del menor.");
            return;
        }
        // SPEC-361 (F7) / SPEC-627 (D-134): avisar ANTES de enviar, nombrando el
        // campo. El servidor vuelve a validar: esto es cortesía, no la única defensa.
        const anioNum = form.anioNacimiento ? Number(form.anioNacimiento) : null;
        const errorAnio = validarAnioNacimientoMenor(anioNum);
        if (errorAnio) {
            setError(errorAnio);
            return;
        }

        // SPEC-721: el identificador escrito pero no "agregado" no se pierde: entra
        // igual. Pero sin plataforma no se puede vigilar (I-429), así que si falta la
        // red se pide (no se envía suelto): el mensaje dice la razón, no regaña.
        const borradorValor = borrador.valor.trim();
        if (borradorValor && !borrador.plataformaId) {
            setError("Elige la red o app de esta cuenta — es lo que nos deja vigilarla. Si no sabes cuál es, mejor no la agregues todavía.");
            return;
        }

        setGuardando(true);
        setError(null);
        const pendiente = borradorValor ? [...nuevos, { valor: borradorValor, plataformaId: borrador.plataformaId }] : nuevos;
        try {
            const res = await fetch("/api/padre/hijos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    construirPayloadAltaHijo(
                        {
                            nombre: form.nombre.trim(),
                            apellidos: form.apellidos.trim(),
                            anioNacimiento: anioNum,
                            sexo: form.sexo,
                        },
                        pendiente,
                    ),
                ),
            });
            if (!res.ok) {
                // El servidor explica el motivo (tope alcanzado, campo faltante).
                const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
                throw new Error(data?.error?.message ?? "No pudimos registrar al menor. Revisa los datos e intenta de nuevo.");
            }
            setForm(FORM_VACIO);
            setNuevos([]);
            setBorrador(BORRADOR_VACIO);
            await onRegistrado();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
        } finally {
            setGuardando(false);
        }
    }

    return (
        <GlassCard className="p-4">
            {/* data-testid="form-hijo": mismo contrato de alta que el wizard. */}
            <form onSubmit={registrar} className="space-y-3" data-testid="form-hijo" noValidate>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input label="Nombres" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                    <Input label="Apellidos" value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} required />
                    <Select
                        label="Año de nacimiento"
                        options={[
                            { value: "", label: "Sin especificar" },
                            ...aniosNacimientoMenor().map((anio) => ({
                                value: String(anio),
                                label: `${anio} (${edadDesdeAnio(anio)} años)`,
                            })),
                        ]}
                        value={form.anioNacimiento}
                        onChange={(e) => setForm({ ...form, anioNacimiento: e.target.value })}
                    />
                    <Select label="Sexo" options={SEXOS} value={form.sexo} onChange={(e) => setForm({ ...form, sexo: e.target.value })} />
                </div>

                <div className="rounded-xl border border-cielo/40 p-3 dark:border-cielo/30">
                    <p className="text-sm font-medium text-body">Sus cuentas</p>
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
                                            ? ` · ${opcionesPlataforma.find((p) => p.value === i.plataformaId)?.label ?? ""}`
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
                            label="Cuenta"
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
                        <Button type="button" variant="outline" onClick={agregarBorrador} disabled={!borrador.valor.trim() || !borrador.plataformaId}>
                            Agregar otro
                        </Button>
                    </div>
                    {/* SPEC-721 (forma de Diseño): el porqué en voz del padre, una línea
                        (no un muro). Sin la red, `ruby1` en Discord y `ruby1` en Roblox
                        son cuentas distintas y un reporte sobre una no dice nada de la otra. */}
                    <p className="mt-2 text-xs text-muted">
                        <span className="font-medium text-body">¿En qué red o app está esta cuenta?</span>{" "}
                        Sin la red no podemos saber si un reporte es sobre <strong>tu</strong> hijo o sobre otra
                        persona con el mismo usuario.{" "}
                        <span className="italic">(«ruby1» en Discord no es «ruby1» en Roblox.)</span>
                    </p>
                </div>

                <Button type="submit" isLoading={guardando} disabled={guardando}>
                    Registrar
                </Button>
            </form>
            {error && <p className="mt-2 text-sm text-rubi" data-testid="form-alta-error">{error}</p>}
        </GlassCard>
    );
}
