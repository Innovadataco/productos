"use client";

/**
 * SPEC-685 (PR2-bis · FORMA-MI-PERFIL-PROFESIONAL-HABILITADO) · «Mi perfil» del
 * profesional habilitado. Cuatro secciones, en el orden de altitud de Diseño:
 * primero lo que la familia ve (datos), luego la tarifa, y al final la trastienda
 * que lo sostiene (documentos y el estado de la verificación).
 *
 *   1. Sus datos      — resumen; se editan en la ficha (link). *(La edición en
 *                       sitio por-bloque llega en una entrega siguiente; hoy la
 *                       ficha sigue siendo el lugar de edición para no duplicar el
 *                       formulario ni romper su candado de listas cerradas.)*
 *   2. Su tarifa      — EDITABLE acá (salió de la ficha); guarda su propio bloque.
 *                       Debajo del número, el aviso de cómo se cobra (FORMA §2-bis).
 *   3. Sus documentos — `DocumentosRequisitos` tal cual.
 *   4. Estado         — `EstadoVerificacionProfesionalClient` (variante activa).
 */
import { useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";
import { DocumentosRequisitos } from "@/components/modules/profesional/DocumentosRequisitos";
import { EstadoVerificacionProfesionalClient } from "@/components/modules/verificacion/EstadoVerificacionProfesionalClient";
import { conPuntosDeMiles, tarifaDesdeTexto } from "@/lib/profesional/formato-tarifa";
import type { PerfilProfesionalPropioDto } from "@/lib/profesional/dto";
import type { OpcionCatalogo } from "@/lib/profesional/catalogos";
import type { VistaProfesionalVerificacion } from "@/lib/profesionales/verificador/vista-profesional";

interface Props {
    perfil: PerfilProfesionalPropioDto;
    rangoCatalogo: OpcionCatalogo[];
    aviso: { precioEstandar: number | null; pct: number | null };
    vista: VistaProfesionalVerificacion;
    /**
     * SPEC-686 (I-420 · forma hermana): el registro de la autorización aceptada. `version`/
     * `aceptadaEn` null = todavía no aceptó ninguna (no debería para un habilitado que pasó
     * la guardia). `hayActualizacionMenor` = hay una versión nueva MENOR sin aceptar (aviso
     * suave, no bloqueo — la guardia solo fuerza las DE FONDO).
     */
    autorizacion?: {
        version: string | null;
        aceptadaEn: string | null;
        hayActualizacionMenor: boolean;
    };
}

/** Resuelve claves de rango a sus nombres visibles (el resto ya viene con etiqueta). */
function etiquetasRango(claves: string[], catalogo: OpcionCatalogo[]): string {
    const porClave = new Map(catalogo.map((o) => [o.clave, o.nombre]));
    const nombres = claves.map((c) => porClave.get(c) ?? c);
    return nombres.length > 0 ? nombres.join(" · ") : "—";
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
    return (
        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
            <span className="text-sm text-subtle">{etiqueta}</span>
            <span className="text-sm text-body sm:text-right">{valor || "—"}</span>
        </div>
    );
}

export function MiPerfilProfesionalClient({ perfil, rangoCatalogo, aviso, vista, autorizacion }: Props) {
    // SPEC-685 (PR2-bis): la tarifa es nulable («por fijar»). En el input se ve vacío
    // (conPuntosDeMiles(0) === "") hasta que la fija.
    const [tarifaConsultaCOP, setTarifaConsultaCOP] = useState<number>(perfil.tarifaConsultaCOP ?? 0);
    const [duracionMinutos, setDuracionMinutos] = useState<number>(perfil.duracionMinutos || 45);
    const tarifaSinFijar = tarifaConsultaCOP <= 0;
    const [guardando, setGuardando] = useState(false);
    const [ok, setOk] = useState("");
    const [error, setError] = useState("");

    const modalidad = [
        perfil.atiendeVirtual ? "Virtual" : null,
        perfil.atiendePresencial ? "Presencial" : null,
    ].filter(Boolean).join(" · ") || "—";

    const guardarTarifa = async () => {
        setError("");
        setOk("");
        setGuardando(true);
        try {
            const res = await fetch("/api/profesional/perfil", {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tarifaConsultaCOP, duracionMinutos }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(json?.error?.message ?? "No fue posible guardar la tarifa.");
                return;
            }
            setOk("Tarifa guardada.");
        } finally {
            setGuardando(false);
        }
    };

    return (
        <main className="mx-auto max-w-3xl px-4 py-8">
            <h1 className="font-serif text-3xl text-body">Mi perfil</h1>

            {/* 1 · Sus datos — resumen; se editan en la ficha. */}
            <GlassCard className="mt-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-body">Sus datos</h2>
                    <Link href="/perfil-profesional/completar" className="text-sm text-accent underline">
                        Editar mis datos
                    </Link>
                </div>
                <div className="mt-4 space-y-2">
                    <Dato etiqueta="Nombre público" valor={perfil.nombreVisible} />
                    <Dato etiqueta="Profesión" valor={perfil.tituloProfesional} />
                    <Dato etiqueta="Áreas de atención" valor={perfil.especialidades.join(" · ")} />
                    <Dato etiqueta="Edad que atiende" valor={etiquetasRango(perfil.rangoEtario, rangoCatalogo)} />
                    <Dato etiqueta="Ciudad" valor={perfil.ciudad.nombre} />
                    <Dato etiqueta="Modalidad" valor={modalidad} />
                    <Dato etiqueta="Años de experiencia" valor={perfil.aniosExperiencia > 0 ? String(perfil.aniosExperiencia) : "—"} />
                    <Dato etiqueta="Presentación" valor={perfil.presentacion} />
                </div>
            </GlassCard>

            {/* 2 · Su tarifa — editable acá; solo la ve el habilitado. */}
            <GlassCard className="mt-6">
                <h2 className="text-lg font-semibold text-body">Su tarifa</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* SPEC-694: se ve con puntos de miles, se guarda el entero. */}
                    <Input
                        label="Tarifa por consulta (COP)"
                        type="text"
                        inputMode="numeric"
                        placeholder="Por fijar"
                        value={conPuntosDeMiles(tarifaConsultaCOP)}
                        onChange={(e) => setTarifaConsultaCOP(tarifaDesdeTexto(e.target.value))}
                    />
                    <Input
                        label="Duración (min)"
                        type="number"
                        min={15}
                        max={240}
                        value={duracionMinutos}
                        onChange={(e) => setDuracionMinutos(Number(e.target.value))}
                    />
                </div>

                {/* SPEC-685 (PR2-bis · FORMA §2-ter a): estado «tarifa por fijar», en POSITIVO
                    (ámbar de acción pendiente, no alarma), enmarcado en lo que ya puede hacer.
                    Valor del precio estándar EN VIVO; si falta, la frase va sin número. */}
                {tarifaSinFijar && (
                    <p className="mt-2 text-sm text-estado-ambar">
                        <span className="font-medium">Su tarifa está sin fijar.</span> Ya puede recibir familias: la
                        primera cita se cobra al precio estándar
                        {aviso.precioEstandar !== null ? ` (hoy ${conPuntosDeMiles(aviso.precioEstandar)} COP)` : ""}.{" "}
                        <span className="font-medium">Fije su tarifa</span> para poder atender de la segunda cita en
                        adelante.
                    </p>
                )}

                {/* FORMA §2-bis · aviso de cómo se cobra. Nota informativa NEUTRA
                    (no ámbar): es contexto, no una alarma. Valores EN VIVO; si falta
                    un parámetro, la frase va SIN número — nunca una cifra inventada. */}
                <div className="mt-3 text-sm text-subtle">
                    <p>
                        <span className="font-medium text-body">Cómo se cobra.</span> El valor que fija aquí es lo que
                        usted recibe <span className="font-medium">desde la segunda cita</span> con cada familia. La{" "}
                        <span className="font-medium">primera cita</span> se cobra a un precio estándar que fija la
                        Plataforma
                        {aviso.precioEstandar !== null ? `: hoy ${conPuntosDeMiles(aviso.precioEstandar)} COP.` : "."}{" "}
                        En cualquier cita, la familia paga la consulta más un % de servicio de la Plataforma
                        {aviso.pct !== null ? ` (hoy ${aviso.pct}%)` : ""} que{" "}
                        <span className="font-medium">no se descuenta de lo suyo</span> — se suma a lo que paga la familia.
                    </p>
                </div>

                {error && (
                    <Alerta tono="advertencia" className="mt-3 text-center">
                        {error}
                    </Alerta>
                )}
                {ok && (
                    <Alerta tono="exito" className="mt-3">
                        {ok}
                    </Alerta>
                )}
                <Button onClick={guardarTarifa} isLoading={guardando} className="mt-4">
                    Guardar tarifa
                </Button>
            </GlassCard>

            {/* 3 · Sus documentos. */}
            <GlassCard className="mt-6">
                <h2 className="text-lg font-semibold text-body">Sus documentos</h2>
                <div className="mt-4">
                    <DocumentosRequisitos />
                </div>
            </GlassCard>

            {/* 4 · El estado de su verificación — al final de los documentos. */}
            <div className="mt-6">
                <EstadoVerificacionProfesionalClient vista={vista} habilitado={true} />
            </div>

            {/* 5 · SPEC-686 · el registro de la autorización aceptada + el derecho a releerla. */}
            {autorizacion?.version && (
                <GlassCard className="mt-6">
                    <h2 className="text-lg font-semibold text-body">Autorización</h2>
                    <p className="mt-2 text-sm text-body">
                        Autorización aceptada · versión {autorizacion.version}
                        {autorizacion.aceptadaEn
                            ? ` · ${new Date(autorizacion.aceptadaEn).toLocaleDateString("es-CO", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                            })}`
                            : ""}
                    </p>
                    {autorizacion.hayActualizacionMenor && (
                        // Cambio MENOR: aviso suave, no bloqueo (la guardia no fuerza los menores).
                        <p className="mt-2 text-sm text-estado-ambar">
                            Actualizamos el texto de la autorización. Puede leer la nueva versión.
                        </p>
                    )}
                    <a
                        href="/perfil-profesional/autorizacion?releer=1"
                        className="mt-3 inline-block text-sm font-medium text-body underline underline-offset-2"
                    >
                        {autorizacion.hayActualizacionMenor ? "Leer y aceptar" : "Leer la autorización"}
                    </a>
                </GlassCard>
            )}
        </main>
    );
}
