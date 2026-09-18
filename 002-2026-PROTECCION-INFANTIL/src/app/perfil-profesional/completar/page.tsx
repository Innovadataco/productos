"use client";

/**
 * SPEC-391 (A-75 · L1b) · SPEC-434 (I-302) · SPEC-706 — el profesional completa su ficha.
 *
 * SPEC-706: la ficha es la ÚNICA pantalla del profesional no habilitado («Mi estado» se retiró).
 * Lleva ARRIBA el ENCABEZADO de estado (display-only) y, cuando es su turno (BORRADOR/VENCIDO),
 * el formulario editable con DOS acciones explícitas: «Guardar borrador» (guarda, no transiciona)
 * y «Guardar y enviar a revisión». Enviar es un acto EXPLÍCITO —ya NO hay auto-transición al
 * completarse—: el botón queda inerte hasta que no falte nada (como el «Acepto» de la
 * autorización) y el servidor revalida nombrando lo que falta. En EN_REVISION/SUSPENDIDO la ficha
 * es de SOLO LECTURA (fieldset deshabilitado + el servidor lo aplica en el PUT). El modal de
 * «ficha entregada» se retiró (pasaba desapercibido y su copy contradecía el bloqueo).
 *
 * De SPEC-434: país+ciudad con `CiudadSearchSelect`; voz neutra Colombia; años como selector 1..50.
 */
import { useEffect, useState } from "react";
import type { PerfilProfesional } from "@prisma/client";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";
import { DocumentosRequisitos } from "@/components/modules/profesional/DocumentosRequisitos";
import { EstadoVerificacionProfesionalClient } from "@/components/modules/verificacion/EstadoVerificacionProfesionalClient";
import { CiudadSearchSelect, type CiudadOpcion } from "@/components/ui/CiudadSearchSelect";
import { MENSAJE_MODALIDAD_FALTA_CAMPO } from "@/lib/profesional/modalidad-estado";
import { camposFaltantesParaRevision } from "@/lib/profesional/dto";
import type { OpcionCatalogo, GrupoAreas } from "@/lib/profesional/catalogos";

type Catalogos = { profesion: OpcionCatalogo[]; areas: GrupoAreas[]; rangoEtario: OpcionCatalogo[] };

type Perfil = {
    id: string;
    nombreVisible: string;
    // SPEC-685 (PR2): listas cerradas en vez de título/especialidades libres.
    profesion: string | null;
    areasAtencion: string[];
    rangoEtario: string[];
    ciudad: { id: string; nombre: string; paisId: string };
    atiendeVirtual: boolean;
    atiendePresencial: boolean;
    aniosExperiencia: number;
    presentacion: string;
    emiteFactura: boolean;
    estado: string;
};

// SPEC-703: estado de la autorización ACEPTADA EN PANTALLA (reemplaza la subida de PDF).
type Autorizacion = {
    version: string | null;
    aceptadaVigente: boolean;
    aceptadaEn: string | null;
    versionAceptada: string | null;
};

// SPEC-706: el estado de verificación que antes vivía en «Mi estado» viaja con el perfil y se pinta
// como ENCABEZADO de la ficha (una sola pantalla). Mismo shape que `EstadoVerificacionProfesionalClient`.
type Vista = {
    estadoPerfil: "BORRADOR" | "EN_REVISION" | "ACTIVO" | "RECHAZADO" | "VENCIDO" | "SUSPENDIDO";
    puedeReenviar: boolean;
    observaciones: Array<{ requisito: string; observacion: string }>;
};

type PaisOption = { id: string; nombre: string };

// SPEC-685 (PR2): alterna una clave en una lista múltiple (áreas / rango).
const toggleEnLista = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    clave: string,
) => setter((prev) => (prev.includes(clave) ? prev.filter((x) => x !== clave) : [...prev, clave]));

// SPEC-685 (PR2): catálogos ya resueltos (vacíos mientras cargan) para el render.
const catalogosOVacio = (c: Catalogos | null) => ({
    profesion: c?.profesion ?? [],
    areas: c?.areas ?? [],
    rangoEtario: c?.rangoEtario ?? [],
});

const ANIOS_EXPERIENCIA_OPCIONES = (() => {
    const opts: Array<{ value: string; label: string }> = [
        { value: "", label: "Elija los años" },
    ];
    for (let i = 1; i <= 50; i++) {
        opts.push({ value: String(i), label: i === 1 ? "1 año" : `${i} años`});
    }
    return opts;
})();

export default function CompletarPerfilProfesionalPage() {
    const [perfil, setPerfil] = useState<Perfil | null>(null);
    const [cargando, setCargando] = useState(true);
    const [paises, setPaises] = useState<PaisOption[]>([]);
    const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
    const [nombreVisible, setNombreVisible] = useState("");
    // SPEC-685 (PR2): profesión (única) + áreas y rango etario (múltiples), por CLAVE.
    const [profesion, setProfesion] = useState("");
    const [areasAtencion, setAreasAtencion] = useState<string[]>([]);
    const [rangoEtario, setRangoEtario] = useState<string[]>([]);
    const [paisId, setPaisId] = useState("");
    const [ciudad, setCiudad] = useState<CiudadOpcion | null>(null);
    const [atiendeVirtual, setAtiendeVirtual] = useState(false);
    const [atiendePresencial, setAtiendePresencial] = useState(false);
    const [aniosExperiencia, setAniosExperiencia] = useState<string>("");
    const [presentacion, setPresentacion] = useState("");
    const [numeroTarjetaProfesional, setNumeroTarjeta] = useState("");
    // SPEC-703: la autorización se ACEPTA EN PANTALLA (no se sube PDF); acá solo se muestra su estado.
    const [autorizacion, setAutorizacion] = useState<Autorizacion | null>(null);
    // SPEC-706: estado de verificación (encabezado) + habilitado, para la copy y el solo-lectura.
    const [vista, setVista] = useState<Vista | null>(null);
    const [habilitado, setHabilitado] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [errorPerfil, setErrorPerfil] = useState("");
    // SPEC-706: los obligatorios que faltan según el SERVIDOR al intentar enviar (los nombra).
    const [camposFaltantesServidor, setCamposFaltantesServidor] = useState<string[]>([]);
    const [ok, setOk] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const [perfilRes, paisRes, catRes] = await Promise.all([
                    fetch("/api/profesional/perfil", { credentials: "include" }),
                    fetch("/api/paises", { credentials: "include" }),
                    fetch("/api/profesional/catalogos", { credentials: "include" }),
                ]);
                const paisJson = await paisRes.json().catch(() => ({}));
                setPaises((paisJson.paises ?? []) as PaisOption[]);
                const catJson = await catRes.json().catch(() => ({}));
                if (catJson.catalogos) setCatalogos(catJson.catalogos as Catalogos);
                if (perfilRes.ok) {
                    const json = await perfilRes.json();
                    setAutorizacion((json.autorizacion ?? null) as Autorizacion | null);
                    setVista((json.vista ?? null) as Vista | null);
                    setHabilitado(json.habilitado === true);
                    if (json.perfil) {
                        const p: Perfil = json.perfil;
                        setPerfil(p);
                        setNombreVisible(p.nombreVisible);
                        setProfesion(p.profesion ?? "");
                        setAreasAtencion(p.areasAtencion ?? []);
                        setRangoEtario(p.rangoEtario ?? []);
                        if (p.ciudad?.id && p.ciudad.paisId) {
                            setPaisId(p.ciudad.paisId);
                            setCiudad({
                                id: p.ciudad.id,
                                nombre: p.ciudad.nombre,
                                paisId: p.ciudad.paisId,
                                departamentoId: null,
                                departamento: null,
                            });
                        }
                        setAtiendeVirtual(p.atiendeVirtual);
                        setAtiendePresencial(p.atiendePresencial);
                        setAniosExperiencia(p.aniosExperiencia > 0 ? String(p.aniosExperiencia) : "");
                        setPresentacion(p.presentacion);
                    }
                }
            } finally {
                setCargando(false);
            }
        })();
    }, []);

    // SPEC-706: dos acciones sobre la ficha. «Guardar borrador» (enviar=false) guarda tal cual, sin
    // transición — el profesional vuelve luego. «Guardar y enviar a revisión» (enviar=true) pide
    // `enviarARevision`; el servidor valida la completitud y, si falta algo, lo NOMBRA (400
    // FICHA_INCOMPLETA con `campos`) — el botón de enviar ya se inactivó con la misma lista, pero el
    // servidor es la regla. Enviar es un acto EXPLÍCITO: ya no hay auto-transición al completarse.
    const guardar = async (enviar: boolean) => {
        setErrorPerfil("");
        setOk("");
        setCamposFaltantesServidor([]);
        setGuardando(true);
        try {
            const res = await fetch("/api/profesional/perfil", {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombreVisible,
                    profesion,
                    areasAtencion,
                    rangoEtario,
                    ...(ciudad?.id ? { ciudadId: ciudad.id } : {}),
                    atiendeVirtual,
                    atiendePresencial,
                    ...(aniosExperiencia ? { aniosExperiencia: Number(aniosExperiencia) } : {}),
                    presentacion,
                    numeroTarjetaProfesional: numeroTarjetaProfesional || null,
                    ...(enviar ? { enviarARevision: true } : {}),
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (json?.error?.code === "FICHA_INCOMPLETA" && Array.isArray(json.error.campos)) {
                    setCamposFaltantesServidor(json.error.campos as string[]);
                    setErrorPerfil("Faltan datos obligatorios para enviar a revisión.");
                    return;
                }
                setErrorPerfil(json?.error?.message ?? "No fue posible guardar la ficha.");
                return;
            }
            const nuevo = json.perfil as Perfil;
            // Al ENVIAR, el perfil pasa a EN_REVISION → cambia la pantalla (encabezado persistente +
            // solo lectura del servidor). Recargamos para traer el estado nuevo, en vez de un modal
            // que pasa desapercibido (SPEC-706 punto 2). Guardar borrador solo confirma.
            if (enviar && nuevo.estado === "EN_REVISION") {
                window.location.reload();
                return;
            }
            setPerfil(nuevo);
            setOk("Cambios guardados.");
        } finally {
            setGuardando(false);
        }
    };

    if (cargando) {
        return (
            <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
                <p className="text-muted">Cargando…</p>
            </main>
        );
    }

    // SPEC-706 (punto 4): la ficha es de SOLO LECTURA cuando la pelota NO es del profesional —
    // EN_REVISION (la tenemos nosotros) o SUSPENDIDO (de nadie). El servidor lo aplica en el PUT;
    // acá se desactiva y atenúa el formulario, y se dice el bloqueo en el encabezado (antes de que
    // lo descubra tocando un campo muerto). Editable: BORRADOR (incl. «devuelto»), VENCIDO, o alta
    // nueva sin perfil todavía.
    const soloLectura = perfil?.estado === "EN_REVISION" || perfil?.estado === "SUSPENDIDO";

    // SPEC-673 (I-398): la falta de modalidad, legible como hint al lado del campo.
    const faltaModalidad = !atiendeVirtual && !atiendePresencial;

    // SPEC-706 (ampliación): qué falta para ENVIAR, con la MISMA fuente que el servidor
    // (`camposFaltantesParaRevision`). El botón de enviar se inactiva con esta lista y la nombra
    // (como el «Acepto» de la autorización): nada de envío silencioso que deja al profesional
    // trabado sin saber. El servidor revalida y nombra igual (el botón es la forma, no la regla).
    const faltantesEnvio = camposFaltantesParaRevision(
        {
            nombreVisible,
            profesion: profesion || null,
            areasAtencion,
            rangoEtario,
            ciudadId: ciudad?.id ?? "",
            atiendeVirtual,
            atiendePresencial,
            aniosExperiencia: Number(aniosExperiencia) || 0,
            presentacion,
        } as PerfilProfesional,
        autorizacion?.aceptadaVigente ?? false,
    );
    const puedeEnviar = faltantesEnvio.length === 0;

    // SPEC-685 (PR2): catálogos ya con fallback resuelto (vacío mientras cargan).
    const { profesion: opcionesProfesion, areas: gruposAreas, rangoEtario: opcionesRango } =
        catalogosOVacio(catalogos);

    return (
        <main className="mx-auto max-w-3xl px-4 py-8">
            {/* SPEC-706: el ESTADO de verificación va ARRIBA (una sola pantalla; «Mi estado» se
                retiró). Enmarca todo: ¿puedo editar?, ¿qué espero?, ¿qué corrijo? El componente es
                la copy certificada de SPEC-691, reubicada como encabezado (display-only). */}
            {vista && (
                <div className="mb-8">
                    <EstadoVerificacionProfesionalClient vista={vista} habilitado={habilitado} />
                </div>
            )}
            <h1 className="font-serif text-3xl text-body">
                {soloLectura ? "Su perfil" : "Complete su perfil"}
            </h1>
            {!soloLectura && (
                <p className="mt-2 text-sm text-muted">
                    {/* SPEC-704/706: la autorización se ACEPTA en pantalla y el envío es un acto
                        EXPLÍCITO (el botón de abajo), no algo que pase solo al completarse. */}
                    Cuando termine la ficha y acepte la autorización, envíela a revisión con el botón de
                    abajo. Mientras tanto queda como borrador y nadie la ve.
                </p>
            )}

            {ok && (
                <Alerta tono="exito" className="mt-4">
                    {ok}
                </Alerta>
            )}

            <GlassCard className="mt-6">
                <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                    {/* SPEC-706 (punto 4): en revisión/suspendido la ficha es de SOLO LECTURA — el
                        fieldset deshabilitado apaga todos los controles (el servidor igual lo aplica
                        en el PUT). Editable cuando es el turno del profesional. */}
                    <fieldset disabled={soloLectura} className={soloLectura ? "space-y-4 opacity-60" : "space-y-4"}>
                        {/* SPEC-685 (PR2 · FORMA de Diseño): «Nombre público» NOMBRA la cosa
                        (sustantivo) + un ejemplo que ES un nombre → empuja a un nombre, no a
                        una descripción. La ayuda dice «en el directorio» y nada más: tras una
                        cita confirmada el contacto SÍ se comparte (H-2). maxLength 50 ahoga un
                        párrafo. La descripción tiene casa: Presentación. */}
                        <div>
                            <Input
                                label="Nombre público"
                                value={nombreVisible}
                                onChange={(e) => setNombreVisible(e.target.value)}
                                placeholder="Dra. Ramírez"
                                maxLength={50}
                            />
                            <p className="mt-1 text-sm text-subtle">
                            Así lo verán las familias en el directorio. Escríbalo como un nombre, no como una descripción.
                            </p>
                            <p className="mt-1 text-xs text-subtle">
                            ¿Quiere contar su experiencia? Eso va en Presentación.
                            </p>
                        </div>

                        {/* SPEC-685 (PR2): profesión = lista cerrada (única). */}
                        <Select
                            label="Profesión"
                            value={profesion}
                            onChange={(e) => setProfesion(e.target.value)}
                            options={[
                                { value: "", label: "Elija su profesión" },
                                ...opcionesProfesion.map((o) => ({ value: o.clave, label: o.nombre })),
                            ]}
                        />

                        {/* SPEC-706 (punto 1): áreas = grupos legibles con CHIPS (togglean), no casillas
                        planas. Elegida = relleno cielo + tinta (relleno-acento seguro, SPEC-662);
                        sin elegir = contorno tinta fantasma (SPEC-659). Contador de ayuda. Mantiene
                        los 6 grupos + selección múltiple + catálogo parametrizado. */}
                        <fieldset className="space-y-3">
                            <legend className="block text-sm font-medium text-body">Áreas de atención</legend>
                            <p className="text-sm text-subtle">Elija en lo que trabaja. Puede elegir varias.</p>
                            <p className="text-xs text-subtle">{areasAtencion.length} áreas elegidas</p>
                            {gruposAreas.map((g) => (
                                <div key={g.grupo} className="space-y-2 border-t border-tinta/10 pt-3 first:border-0 first:pt-0">
                                    <p className="text-xs uppercase tracking-wide text-subtle">{g.grupo}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {g.items.map((o) => {
                                            const elegido = areasAtencion.includes(o.clave);
                                            return (
                                                <button
                                                    key={o.clave}
                                                    type="button"
                                                    aria-pressed={elegido}
                                                    onClick={() => toggleEnLista(setAreasAtencion, o.clave)}
                                                    className={
                                                        elegido
                                                            ? "rounded-full bg-cielo px-3 py-1.5 text-sm font-medium text-tinta transition"
                                                            : "rounded-full border border-tinta/30 px-3 py-1.5 text-sm text-body transition hover:border-tinta/50"
                                                    }
                                                >
                                                    {o.nombre}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </fieldset>

                        {/* SPEC-685 (PR2): rango etario = lista cerrada (múltiple). Reemplaza «Niños». */}
                        <fieldset className="space-y-1.5">
                            <legend className="block text-sm font-medium text-body">Edad que atiende</legend>
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                                {opcionesRango.map((o) => (
                                    <label key={o.clave} className="flex items-center gap-2 text-sm text-body">
                                        <input
                                            type="checkbox"
                                            checked={rangoEtario.includes(o.clave)}
                                            onChange={() => toggleEnLista(setRangoEtario, o.clave)}
                                        />
                                        {o.nombre}
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        {/* SPEC-434 punto 1 · país + ciudad como en el reporte. */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Select
                                label="País"
                                value={paisId}
                                onChange={(e) => {
                                    setPaisId(e.target.value);
                                    setCiudad(null);
                                }}
                                options={[{ value: "", label: "Elija país" }, ...paises.map((p) => ({ value: p.id, label: p.nombre }))]}
                            />
                            <CiudadSearchSelect
                                paisId={paisId}
                                value={ciudad}
                                onSelect={setCiudad}
                                disabled={!paisId}
                                permitirOtra={false}
                            />
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm">
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={atiendeVirtual} onChange={(e) => setAtiendeVirtual(e.target.checked)} />
                            Atiendo virtual
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={atiendePresencial} onChange={(e) => setAtiendePresencial(e.target.checked)} />
                            Atiendo presencial
                            </label>
                        </div>
                        {/* SPEC-673 (I-398): la incompletitud, legible SIEMPRE (no al intentar). */}
                        {faltaModalidad && (
                            <p role="status" className="text-sm text-estado-ambar">
                                {MENSAJE_MODALIDAD_FALTA_CAMPO}
                            </p>
                        )}
                        {/* SPEC-685 (PR2-bis): la TARIFA y la duración salieron de la ficha
                        y viven en «Mi perfil» (solo el habilitado). Antes de estar
                        habilitado no hay tarifa que fijar ni cobrar. */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {/* SPEC-434 punto 4 · años como selector 1..50. */}
                            <Select
                                label="Años de experiencia"
                                value={aniosExperiencia}
                                onChange={(e) => setAniosExperiencia(e.target.value)}
                                options={ANIOS_EXPERIENCIA_OPCIONES}
                            />
                        </div>
                        <label className="block text-sm text-body">
                        Presentación
                            <textarea
                                value={presentacion}
                                onChange={(e) => setPresentacion(e.target.value)}
                                className="mt-1 w-full min-h-32 rounded-lg border border-tinta/15 bg-transparent px-3 py-2 text-sm"
                                maxLength={1500}
                                placeholder="Escriba quién es y con quién trabaja mejor, en pocas líneas."
                            />
                        </label>
                        <Input
                            label="Número de tarjeta profesional (interno)"
                            value={numeroTarjetaProfesional}
                            onChange={(e) => setNumeroTarjeta(e.target.value)}
                        />
                    </fieldset>

                    {/* SPEC-706: los botones y avisos SOLO cuando es su turno (editable). En
                        revisión/suspendido no hay controles — el encabezado explica por qué. */}
                    {!soloLectura && (
                        <div className="space-y-3">
                            {errorPerfil && (
                                <Alerta tono="advertencia" className="text-center">
                                    {errorPerfil}
                                </Alerta>
                            )}
                            {/* SPEC-706 (ampliación · Jelkin): qué falta para enviar, NOMBRADO. El
                                botón de enviar queda inerte hasta que no falte nada (como el «Acepto»
                                de la autorización); el servidor revalida y nombra igual. */}
                            {!puedeEnviar && (
                                <p role="status" className="text-sm text-estado-ambar">
                                    Para enviar a revisión, falta: {faltantesEnvio.join(", ")}.
                                </p>
                            )}
                            {camposFaltantesServidor.length > 0 && (
                                <p role="alert" className="text-sm text-estado-ambar">
                                    Faltan datos obligatorios: {camposFaltantesServidor.join(", ")}.
                                </p>
                            )}
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => guardar(false)}
                                    isLoading={guardando}
                                    className="sm:flex-1"
                                >
                                    Guardar borrador
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => guardar(true)}
                                    isLoading={guardando}
                                    disabled={!puedeEnviar || guardando}
                                    className="sm:flex-1"
                                >
                                    Guardar y enviar a revisión
                                </Button>
                            </div>
                        </div>
                    )}
                </form>
            </GlassCard>

            <GlassCard className="mt-6">
                {/* SPEC-703: la autorización se ACEPTA EN PANTALLA (Ley 1918/2018), no se sube PDF.
                    Aquí va su ESTADO + el enlace a leerla/aceptarla; al aceptar, el profesional
                    vuelve a esta ficha. La completitud para pasar a revisión exige esta aceptación. */}
                <h2 className="text-lg font-semibold text-body">Autorización</h2>
                <p className="mt-1 text-sm text-muted">
                    Para revisar su perfil necesitamos que autorice la verificación de sus
                    antecedentes y el tratamiento de sus datos. La lee y la acepta en pantalla;
                    queda registrada con su fecha y versión.
                </p>
                <div className="mt-4 space-y-3">
                    {autorizacion?.aceptadaVigente ? (
                        <p className="text-sm text-body">
                            <span className="font-medium">Autorización aceptada.</span>
                            {autorizacion.aceptadaEn
                                ? ` Aceptada el ${new Date(autorizacion.aceptadaEn).toLocaleDateString("es-CO", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                })}`
                                : ""}
                            {autorizacion.version ? ` · versión ${autorizacion.version}` : ""}
                        </p>
                    ) : (
                        <p className="text-sm text-estado-ambar">
                            <span className="font-medium">Falta aceptar la autorización.</span> Sin ella no
                            podemos pasar su perfil a revisión.
                        </p>
                    )}
                    <Link
                        // SPEC-705: si YA aceptó, hay que ir en modo RELEER; sin `?releer=1` la página
                        // ve que ya aceptó y redirige de vuelta a la ficha → «Ver la autorización» no
                        // mostraba nada. Sin aceptar, va sin el parámetro (a leer y aceptar).
                        href={
                            autorizacion?.aceptadaVigente
                                ? "/perfil-profesional/autorizacion?releer=1"
                                : "/perfil-profesional/autorizacion"
                        }
                        className="inline-block text-sm font-medium text-accent underline underline-offset-2"
                    >
                        {autorizacion?.aceptadaVigente ? "Ver la autorización" : "Leer y aceptar la autorización"}
                    </Link>
                </div>

                {/* SPEC-436 (I-304): los requisitos que el Verificador va a revisar.
                    La lista sale del parámetro, no de una constante. */}
                <div className="mt-8 border-t border-tinta/10 pt-6">
                    <h2 className="text-lg font-semibold text-body">Documentos para su verificación</h2>
                    <p className="mt-1 text-sm text-muted">
                        Estos son los documentos que revisa Innovadataco antes de activarte. Se guardan
                        cifrados, igual que la autorización, y solo los abre quien revisa su solicitud.
                    </p>
                    <div className="mt-4">
                        <DocumentosRequisitos />
                    </div>
                </div>
            </GlassCard>
            {/* SPEC-706: se retiró el modal de «ficha entregada» (pasaba desapercibido y decía que
                la pantalla «queda a su disposición para editar», que contradice el bloqueo en
                revisión). Ahora el aviso vive en el ENCABEZADO persistente (arriba) tras enviar. */}
        </main>
    );
}
