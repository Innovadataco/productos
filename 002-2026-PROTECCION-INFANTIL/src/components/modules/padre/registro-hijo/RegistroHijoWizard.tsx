"use client";

/**
 * SPEC-599 · RegistroHijoWizard — orquestador del alta de hijo aprobada sobre el
 * mockup `design/padre-hijos-registro-mockup.html` (dueño, 08-09-2026).
 * Bienvenida → datos → círculo → listo. Reemplaza el formulario plano de
 * MisHijos SIN tocar la lógica de negocio: validación (documento-menor), alta
 * múltiple de identificadores y payload del POST /api/padre/hijos intactos
 * (SPEC-589: sin documento; nombre/apellidos obligatorios; edad/sexo opcionales).
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { validarEdadMenor } from "@/lib/padre/documento-menor";
import { WizardStepper } from "./WizardStepper";
import { PasoBienvenidaRegistro } from "./PasoBienvenidaRegistro";
import { PasoDatosHijo } from "./PasoDatosHijo";
import { PasoCirculoConfianza } from "./PasoCirculoConfianza";
import { ResumenRegistro } from "./ResumenRegistro";
import { FORM_VACIO, IDENTIFICADOR_VACIO, type DatosHijoForm, type ErroresPasoDatos } from "./types";
import { construirPayloadAltaHijo, type IdentificadorNuevo } from "./payload";

const ULTIMO_PASO = 3;

export function RegistroHijoWizard({
    opcionesPlataforma,
    onRegistrado,
}: {
    opcionesPlataforma: { value: string; label: string }[];
    onRegistrado: () => Promise<void>;
}) {
    const [paso, setPaso] = useState(0);
    // El stepper permite volver a un paso visitado, nunca saltar hacia adelante.
    const [maxVisitado, setMaxVisitado] = useState(0);
    const [form, setForm] = useState<DatosHijoForm>(FORM_VACIO);
    const [nuevos, setNuevos] = useState<IdentificadorNuevo[]>([]);
    const [borrador, setBorrador] = useState<IdentificadorNuevo>(IDENTIFICADOR_VACIO);
    const [errores, setErrores] = useState<ErroresPasoDatos>({});
    const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    // Foco al título del paso activo (cambio de paso anunciado, sin setState en effect).
    const titulos = useRef<(HTMLHeadingElement | null)[]>([]);
    useEffect(() => {
        titulos.current[paso]?.focus({ preventScroll: true });
    }, [paso]);

    function irA(n: number) {
        setPaso(n);
        setMaxVisitado((m) => Math.max(m, n));
    }

    function agregarBorrador() {
        const valor = borrador.valor.trim();
        if (!valor) return;
        setNuevos((lista) => [...lista, { valor, plataformaId: borrador.plataformaId }]);
        setBorrador(IDENTIFICADOR_VACIO);
    }

    /** Validación amable del paso 2: se nombra el campo antes de enviar (SPEC-361/F7). */
    function validarDatos(): boolean {
        const siguientes: ErroresPasoDatos = {};
        if (!form.nombre.trim()) siguientes.nombre = "Escribe el nombre del menor.";
        if (!form.apellidos.trim()) siguientes.apellidos = "Escribe los apellidos del menor.";
        const errorEdad = validarEdadMenor(form.edad);
        if (errorEdad) setErrorEnvio(errorEdad); // no debería pasar con los chips; el servidor también valida
        setErrores(siguientes);
        return Object.keys(siguientes).length === 0 && !errorEdad;
    }

    function alEnviarDatos(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setErrorEnvio(null);
        if (!validarDatos()) return;
        irA(2);
    }

    /** Identificadores a enviar: la cuenta escrita pero no «agregada» no se pierde. */
    function identificadoresPendientes(): IdentificadorNuevo[] {
        const suelto = borrador.valor.trim();
        return suelto ? [...nuevos, { valor: suelto, plataformaId: borrador.plataformaId }] : nuevos;
    }

    async function confirmarRegistro() {
        setGuardando(true);
        setErrorEnvio(null);
        const pendiente = identificadoresPendientes();
        try {
            // SPEC-601 · el payload comparte constructor con la variante formulario.
            const body = construirPayloadAltaHijo(
                {
                    nombre: form.nombre.trim(),
                    apellidos: form.apellidos.trim(),
                    edad: form.edad,
                    sexo: form.sexo,
                },
                pendiente,
            );
            const res = await fetch("/api/padre/hijos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                // El servidor explica el motivo (tope alcanzado, campo faltante).
                const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
                throw new Error(data?.error?.message ?? "No pudimos registrar al menor. Revisa los datos e intenta de nuevo.");
            }
            irA(ULTIMO_PASO);
            await onRegistrado();
        } catch (err) {
            // Se avisa en el paso de datos, donde el padre puede corregir.
            setErrorEnvio(err instanceof Error ? err.message : "Error");
            setPaso(1);
        } finally {
            setGuardando(false);
        }
    }

    function registrarOtro() {
        setForm(FORM_VACIO);
        setNuevos([]);
        setBorrador(IDENTIFICADOR_VACIO);
        setErrores({});
        setErrorEnvio(null);
        setMaxVisitado(1);
        setPaso(1);
    }

    const nombreCompleto = `${form.nombre} ${form.apellidos}`.trim();
    const nombreCorto = form.nombre.trim().split(/\s+/)[0] || "tu hijo";
    const edadTexto = form.edad !== null ? `${form.edad} años` : "Sin especificar";
    const cuentasTexto = nuevos.length
        ? nuevos.map((c) => c.valor).join(", ")
        : "Ninguna todavía (puedes agregar después)";

    return (
        <div>
            <WizardStepper actual={paso} maxVisitado={maxVisitado} onIr={irA} />
            {errorEnvio && (
                <p role="alert" data-testid="wizard-error" className="mb-4 rounded-xl border border-rubi/40 bg-rubi/10 px-3 py-2 text-sm text-rubi">
                    {errorEnvio}
                </p>
            )}
            <GlassCard className="p-5 sm:p-8" data-testid="wizard-registro-hijo">
                {/* Solo el paso activo se monta: cada panel re-entra con su animación. */}
                <div key={paso} className="animate-floatUp">
                    {paso === 0 && (
                        <PasoBienvenidaRegistro
                            tituloRef={(el: HTMLHeadingElement | null) => {
                                titulos.current[0] = el;
                            }}
                            onSiguiente={() => irA(1)}
                            onVerCirculo={() => irA(2)}
                        />
                    )}
                    {paso === 1 && (
                        <PasoDatosHijo
                            tituloRef={(el: HTMLHeadingElement | null) => {
                                titulos.current[1] = el;
                            }}
                            form={form}
                            errores={errores}
                            nuevos={nuevos}
                            borrador={borrador}
                            opcionesPlataforma={opcionesPlataforma}
                            guardando={guardando}
                            onCambio={(patch) => setForm((f) => ({ ...f, ...patch }))}
                            onBorrador={(patch) => setBorrador((b) => ({ ...b, ...patch }))}
                            onAgregarBorrador={agregarBorrador}
                            onQuitarIdentificador={(idx) => setNuevos((lista) => lista.filter((_, j) => j !== idx))}
                            onAtras={() => setPaso(0)}
                            onSubmit={alEnviarDatos}
                        />
                    )}
                    {paso === 2 && (
                        <PasoCirculoConfianza
                            tituloRef={(el: HTMLHeadingElement | null) => {
                                titulos.current[2] = el;
                            }}
                            form={form}
                            totalCuentas={nuevos.length}
                            guardando={guardando}
                            onAtras={() => setPaso(1)}
                            onConfirmar={() => void confirmarRegistro()}
                        />
                    )}
                    {paso === ULTIMO_PASO && (
                        <ResumenRegistro
                            tituloRef={(el: HTMLHeadingElement | null) => {
                                titulos.current[3] = el;
                            }}
                            nombreCorto={nombreCorto}
                            nombreCompleto={nombreCompleto}
                            edadTexto={edadTexto}
                            cuentasTexto={cuentasTexto}
                            onOtro={registrarOtro}
                        />
                    )}
                </div>
            </GlassCard>
        </div>
    );
}
