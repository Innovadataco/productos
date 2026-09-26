"use client";

/**
 * SPEC-685 (PR2-bis) + SPEC-709 (FORMA-MI-PERFIL §1) · «Mi perfil» del profesional
 * habilitado. Cuatro secciones, en el orden de altitud de Diseño: primero lo que la
 * familia ve (datos), luego la tarifa, y al final la trastienda que lo sostiene
 * (documentos y el estado de la verificación).
 *
 *   1. Sus datos      — EDITABLE ahí mismo, POR BLOQUE (SPEC-709): «muere el botón
 *                       global de guardar»; cada bloque guarda lo suyo con un PUT
 *                       parcial a `/api/profesional/perfil` y confirma en el sitio.
 *                       El habilitado ya no va a la ficha (esa queda para el que aún
 *                       no está habilitado). El servidor sigue validando el catálogo
 *                       CERRADO (SPEC-685) y la invariante de modalidad (SPEC-673).
 *   2. Su tarifa      — EDITABLE acá (salió de la ficha); guarda su propio bloque.
 *   3. Sus documentos — `DocumentosRequisitos` tal cual.
 *   4. Estado         — `EstadoVerificacionProfesionalClient` (variante activa).
 *
 * SPEC-708 (después): la captura de dirección/enlace entra en el bloque de datos,
 * junto a la modalidad — por eso este bloque queda preparado para sumar campos.
 */
import { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";
import { CiudadSearchSelect, type CiudadOpcion } from "@/components/ui/CiudadSearchSelect";
import { DocumentosRequisitos } from "@/components/modules/profesional/DocumentosRequisitos";
import { EstadoVerificacionProfesionalClient } from "@/components/modules/verificacion/EstadoVerificacionProfesionalClient";
import { conPuntosDeMiles, tarifaDesdeTexto } from "@/lib/profesional/formato-tarifa";
import type { PerfilProfesionalPropioDto } from "@/lib/profesional/dto";
import type { OpcionCatalogo, GrupoAreas } from "@/lib/profesional/catalogos";
import type { VistaProfesionalVerificacion } from "@/lib/profesionales/verificador/vista-profesional";

interface Props {
    perfil: PerfilProfesionalPropioDto;
    /** SPEC-709: los tres catálogos CERRADOS (SPEC-685) para editar los datos en sitio. */
    catalogos: { profesion: OpcionCatalogo[]; areas: GrupoAreas[]; rangoEtario: OpcionCatalogo[] };
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

/** Resuelve claves a nombres visibles del catálogo (una). */
function nombreDeOpcion(clave: string, catalogo: OpcionCatalogo[]): string {
    return catalogo.find((o) => o.clave === clave)?.nombre ?? clave;
}
/** Resuelve una lista de claves plana (rango) a «a · b · c». */
function etiquetasPlanas(claves: string[], catalogo: OpcionCatalogo[]): string {
    return claves.length > 0 ? claves.map((c) => nombreDeOpcion(c, catalogo)).join(" · ") : "—";
}
/** Resuelve claves de áreas (agrupadas) a «a · b · c». */
function etiquetasAreas(claves: string[], grupos: GrupoAreas[]): string {
    const porClave = new Map(grupos.flatMap((g) => g.items).map((o) => [o.clave, o.nombre]));
    return claves.length > 0 ? claves.map((c) => porClave.get(c) ?? c).join(" · ") : "—";
}

/**
 * SPEC-709 · un bloque editable en sitio. Cerrado = etiqueta + valor + «Editar».
 * Abierto = los campos (children) + «Guardar»/«Cancelar». No hay botón global: cada
 * bloque es autónomo.
 */
function BloqueDato({
    etiqueta,
    valor,
    abierto,
    onEditar,
    onCancelar,
    onGuardar,
    guardando,
    guardarDeshabilitado,
    children,
}: {
    etiqueta: string;
    valor: string;
    abierto: boolean;
    onEditar: () => void;
    onCancelar: () => void;
    onGuardar: () => void;
    guardando: boolean;
    guardarDeshabilitado?: boolean;
    children?: React.ReactNode;
}) {
    return (
        <div className="border-t border-tinta/8 py-3 first:border-0 first:pt-0">
            <div className="flex items-start justify-between gap-4">
                <span className="text-sm text-subtle">{etiqueta}</span>
                {!abierto && (
                    <button type="button" onClick={onEditar} className="shrink-0 text-xs font-medium text-accent underline">
                        Editar
                    </button>
                )}
            </div>
            {abierto ? (
                <div className="mt-2 space-y-3">
                    {children}
                    <div className="flex gap-2">
                        <Button onClick={onGuardar} isLoading={guardando} disabled={guardarDeshabilitado}>
                            Guardar
                        </Button>
                        <Button variant="ghost" type="button" onClick={onCancelar} disabled={guardando}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            ) : (
                <p className="mt-0.5 whitespace-pre-line text-sm text-body sm:text-right">{valor || "—"}</p>
            )}
        </div>
    );
}

export function MiPerfilProfesionalClient({ perfil, catalogos, aviso, vista, autorizacion }: Props) {
    // SPEC-709 · estado editable de los datos, sembrado del perfil. Cada bloque
    // guarda lo suyo (PUT parcial); el que está abierto es `editando`.
    const [nombreVisible, setNombreVisible] = useState(perfil.nombreVisible);
    const [profesion, setProfesion] = useState(perfil.profesion ?? "");
    const [areasAtencion, setAreasAtencion] = useState<string[]>(perfil.areasAtencion);
    const [rangoEtario, setRangoEtario] = useState<string[]>(perfil.rangoEtario);
    const [ciudad, setCiudad] = useState<CiudadOpcion | null>({
        id: perfil.ciudad.id,
        nombre: perfil.ciudad.nombre,
        paisId: perfil.ciudad.paisId,
        departamentoId: null,
        departamento: null,
    });
    const [atiendeVirtual, setAtiendeVirtual] = useState(perfil.atiendeVirtual);
    const [atiendePresencial, setAtiendePresencial] = useState(perfil.atiendePresencial);
    const [aniosExperiencia, setAniosExperiencia] = useState(perfil.aniosExperiencia);
    const [presentacion, setPresentacion] = useState(perfil.presentacion);

    const [editando, setEditando] = useState<string | null>(null);
    const [guardandoDato, setGuardandoDato] = useState(false);
    const [errorDato, setErrorDato] = useState("");
    const [okDato, setOkDato] = useState("");
    // SPEC-709 · «Cancelar» revierte al valor con el que se ABRIÓ el bloque (el último
    // guardado), no al del render inicial del servidor. Se fotografía al abrir.
    type Datos = {
        nombreVisible: string; profesion: string; areasAtencion: string[]; rangoEtario: string[];
        ciudad: CiudadOpcion | null; atiendeVirtual: boolean; atiendePresencial: boolean;
        aniosExperiencia: number; presentacion: string;
    };
    const [snapshot, setSnapshot] = useState<Datos | null>(null);

    // SPEC-685 (PR2-bis): la tarifa es nulable («por fijar»). En el input se ve vacío
    // (conPuntosDeMiles(0) === "") hasta que la fija.
    const [tarifaConsultaCOP, setTarifaConsultaCOP] = useState<number>(perfil.tarifaConsultaCOP ?? 0);
    const [duracionMinutos, setDuracionMinutos] = useState<number>(perfil.duracionMinutos || 45);
    const tarifaSinFijar = tarifaConsultaCOP <= 0;
    const [guardando, setGuardando] = useState(false);
    const [ok, setOk] = useState("");
    const [error, setError] = useState("");

    const modalidadTexto = useMemo(
        () =>
            [atiendeVirtual ? "Virtual" : null, atiendePresencial ? "Presencial" : null]
                .filter(Boolean)
                .join(" · ") || "—",
        [atiendeVirtual, atiendePresencial],
    );

    /**
     * SPEC-709 · PUT PARCIAL con solo los campos de UN bloque. El servidor valida el
     * catálogo cerrado (SPEC-685) y la modalidad (SPEC-673) y responde el mensaje real
     * (I-410). En éxito se aplica el cambio local y se cierra el bloque.
     */
    async function guardarBloque(cambios: Record<string, unknown>) {
        // El estado local ya trae el valor nuevo (lo puso el onChange); el PUT solo
        // manda los campos de ESTE bloque (parcial). El servidor valida catálogo +
        // modalidad y devuelve el mensaje real.
        setGuardandoDato(true);
        setErrorDato("");
        setOkDato("");
        try {
            const res = await fetch("/api/profesional/perfil", {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cambios),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setErrorDato(json?.error?.message ?? "No fue posible guardar el cambio.");
                return;
            }
            setEditando(null);
            setOkDato("Cambio guardado.");
        } finally {
            setGuardandoDato(false);
        }
    }

    function abrir(clave: string) {
        setSnapshot({
            nombreVisible, profesion, areasAtencion, rangoEtario, ciudad,
            atiendeVirtual, atiendePresencial, aniosExperiencia, presentacion,
        });
        setEditando(clave);
        setErrorDato("");
        setOkDato("");
    }
    function cancelar() {
        // Revierte a la foto tomada al abrir (el último valor guardado).
        if (snapshot) {
            setNombreVisible(snapshot.nombreVisible);
            setProfesion(snapshot.profesion);
            setAreasAtencion(snapshot.areasAtencion);
            setRangoEtario(snapshot.rangoEtario);
            setCiudad(snapshot.ciudad);
            setAtiendeVirtual(snapshot.atiendeVirtual);
            setAtiendePresencial(snapshot.atiendePresencial);
            setAniosExperiencia(snapshot.aniosExperiencia);
            setPresentacion(snapshot.presentacion);
        }
        setEditando(null);
        setErrorDato("");
    }

    function toggleEnLista(lista: string[], clave: string): string[] {
        return lista.includes(clave) ? lista.filter((c) => c !== clave) : [...lista, clave];
    }

    const guardarTarifa = async () => {
        setError("");
        setOk("");
        // SPEC-685 (Diseño): campo vacío ⇒ tarifaDesdeTexto("")=0. No se manda 0
        // (el servidor lo rechaza 400 min(1)); se pide fijarla, sin ir al servidor.
        if (tarifaConsultaCOP <= 0) {
            setError("Escriba su tarifa.");
            return;
        }
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

            {/* 1 · Sus datos — SPEC-709: se editan ACÁ, por bloque (muere el botón global). */}
            <GlassCard className="mt-6">
                <h2 className="text-lg font-semibold text-body">Sus datos</h2>
                {errorDato && (
                    <Alerta tono="advertencia" className="mt-3">
                        {errorDato}
                    </Alerta>
                )}
                {okDato && (
                    <Alerta tono="exito" className="mt-3">
                        {okDato}
                    </Alerta>
                )}
                <div className="mt-4">
                    <BloqueDato
                        etiqueta="Nombre público"
                        valor={nombreVisible}
                        abierto={editando === "nombre"}
                        onEditar={() => abrir("nombre")}
                        onCancelar={cancelar}
                        onGuardar={() => guardarBloque({ nombreVisible: nombreVisible.trim() })}
                        guardando={guardandoDato}
                        guardarDeshabilitado={nombreVisible.trim().length === 0}
                    >
                        <Input
                            label="Nombre público"
                            value={nombreVisible}
                            maxLength={50}
                            onChange={(e) => setNombreVisible(e.target.value)}
                            placeholder="Dra. Ramírez"
                        />
                    </BloqueDato>

                    <BloqueDato
                        etiqueta="Profesión"
                        valor={profesion ? nombreDeOpcion(profesion, catalogos.profesion) : "—"}
                        abierto={editando === "profesion"}
                        onEditar={() => abrir("profesion")}
                        onCancelar={cancelar}
                        onGuardar={() => guardarBloque({ profesion })}
                        guardando={guardandoDato}
                        guardarDeshabilitado={profesion.length === 0}
                    >
                        <Select
                            label="Profesión"
                            value={profesion}
                            onChange={(e) => setProfesion(e.target.value)}
                            options={[
                                { value: "", label: "Elija una profesión…" },
                                ...catalogos.profesion.map((o) => ({ value: o.clave, label: o.nombre })),
                            ]}
                        />
                    </BloqueDato>

                    <BloqueDato
                        etiqueta="Áreas de atención"
                        valor={etiquetasAreas(areasAtencion, catalogos.areas)}
                        abierto={editando === "areas"}
                        onEditar={() => abrir("areas")}
                        onCancelar={cancelar}
                        onGuardar={() => guardarBloque({ areasAtencion })}
                        guardando={guardandoDato}
                        guardarDeshabilitado={areasAtencion.length === 0}
                    >
                        <div className="space-y-3">
                            {catalogos.areas.map((grupo) => (
                                <fieldset key={grupo.grupo}>
                                    <legend className="text-xs font-semibold text-subtle">{grupo.grupo}</legend>
                                    <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                                        {grupo.items.map((o) => (
                                            <label key={o.clave} className="flex items-center gap-2 text-sm text-body">
                                                <input
                                                    type="checkbox"
                                                    checked={areasAtencion.includes(o.clave)}
                                                    onChange={() => setAreasAtencion((prev) => toggleEnLista(prev, o.clave))}
                                                />
                                                {o.nombre}
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>
                            ))}
                        </div>
                    </BloqueDato>

                    <BloqueDato
                        etiqueta="Edad que atiende"
                        valor={etiquetasPlanas(rangoEtario, catalogos.rangoEtario)}
                        abierto={editando === "rango"}
                        onEditar={() => abrir("rango")}
                        onCancelar={cancelar}
                        onGuardar={() => guardarBloque({ rangoEtario })}
                        guardando={guardandoDato}
                        guardarDeshabilitado={rangoEtario.length === 0}
                    >
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                            {catalogos.rangoEtario.map((o) => (
                                <label key={o.clave} className="flex items-center gap-2 text-sm text-body">
                                    <input
                                        type="checkbox"
                                        checked={rangoEtario.includes(o.clave)}
                                        onChange={() => setRangoEtario((prev) => toggleEnLista(prev, o.clave))}
                                    />
                                    {o.nombre}
                                </label>
                            ))}
                        </div>
                    </BloqueDato>

                    <BloqueDato
                        etiqueta="Ciudad"
                        valor={ciudad?.nombre ?? "—"}
                        abierto={editando === "ciudad"}
                        onEditar={() => abrir("ciudad")}
                        onCancelar={cancelar}
                        onGuardar={() => (ciudad ? void guardarBloque({ ciudadId: ciudad.id }) : undefined)}
                        guardando={guardandoDato}
                        guardarDeshabilitado={!ciudad}
                    >
                        <CiudadSearchSelect
                            paisId={perfil.ciudad.paisId}
                            value={ciudad}
                            onSelect={(o) => setCiudad(o)}
                        />
                    </BloqueDato>

                    <BloqueDato
                        etiqueta="Modalidad"
                        valor={modalidadTexto}
                        abierto={editando === "modalidad"}
                        onEditar={() => abrir("modalidad")}
                        onCancelar={cancelar}
                        onGuardar={() => guardarBloque({ atiendeVirtual, atiendePresencial })}
                        guardando={guardandoDato}
                        guardarDeshabilitado={!atiendeVirtual && !atiendePresencial}
                    >
                        <div className="space-y-1">
                            <label className="flex items-center gap-2 text-sm text-body">
                                <input type="checkbox" checked={atiendeVirtual} onChange={(e) => setAtiendeVirtual(e.target.checked)} />
                                Atiendo virtual
                            </label>
                            <label className="flex items-center gap-2 text-sm text-body">
                                <input type="checkbox" checked={atiendePresencial} onChange={(e) => setAtiendePresencial(e.target.checked)} />
                                Atiendo presencial
                            </label>
                            {!atiendeVirtual && !atiendePresencial && (
                                <p className="text-xs text-estado-ambar">Elija al menos una: es lo que permite que las familias lo encuentren.</p>
                            )}
                        </div>
                    </BloqueDato>

                    <BloqueDato
                        etiqueta="Años de experiencia"
                        valor={aniosExperiencia > 0 ? String(aniosExperiencia) : "—"}
                        abierto={editando === "anios"}
                        onEditar={() => abrir("anios")}
                        onCancelar={cancelar}
                        onGuardar={() => guardarBloque({ aniosExperiencia })}
                        guardando={guardandoDato}
                    >
                        <Input
                            label="Años de experiencia"
                            type="number"
                            min={0}
                            max={80}
                            value={aniosExperiencia}
                            onChange={(e) => setAniosExperiencia(Number(e.target.value))}
                        />
                    </BloqueDato>

                    <BloqueDato
                        etiqueta="Presentación"
                        valor={presentacion}
                        abierto={editando === "presentacion"}
                        onEditar={() => abrir("presentacion")}
                        onCancelar={cancelar}
                        onGuardar={() => guardarBloque({ presentacion: presentacion.trim() })}
                        guardando={guardandoDato}
                        guardarDeshabilitado={presentacion.trim().length < 20}
                    >
                        <div>
                            <textarea
                                className="w-full rounded-xl border border-tinta/15 bg-tinta/[0.03] p-3 text-sm text-body ring-accent-input"
                                rows={4}
                                value={presentacion}
                                onChange={(e) => setPresentacion(e.target.value)}
                                placeholder="Cuénteles a las familias quién es, en pocas palabras."
                            />
                            {presentacion.trim().length < 20 && (
                                <p className="mt-1 text-xs text-estado-ambar">
                                    Faltan {20 - presentacion.trim().length} caracteres (mínimo 20).
                                </p>
                            )}
                        </div>
                    </BloqueDato>
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

                {/* FORMA §2-bis · aviso de cómo se cobra. Decisión de Jelkin (probando):
                    se reduce a UNA sola frase, SIN el precio estándar en vivo ni el % de
                    servicio. Diseño actualiza §2-bis en paralelo. */}
                <p className="mt-3 text-sm text-subtle">
                    El valor que fija aquí es lo que usted recibe desde la segunda cita con cada familia.
                </p>

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
