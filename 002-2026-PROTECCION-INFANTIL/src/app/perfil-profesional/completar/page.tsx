"use client";

/**
 * SPEC-391 (A-75 · L1b) · SPEC-434 (I-302) · SPEC-706 — el profesional completa su ficha.
 *
 * SPEC-706: la ficha es la ÚNICA pantalla del profesional no habilitado («Mi estado» /
 * /perfil-profesional/verificacion se retiró — PR B). Lleva ARRIBA el ENCABEZADO de estado
 * (EstadoVerificacionProfesionalClient, display-only) y, cuando es su turno (BORRADOR/VENCIDO), el
 * formulario editable con DOS acciones explícitas: «Guardar borrador» (guarda, no transiciona) y
 * «Guardar y enviar a revisión». El botón de enviar queda INERTE hasta que la ficha esté completa Y
 * la autorización aceptada, y la pantalla NOMBRA lo que falta (como el «Acepto»); ya NO hay
 * auto-transición silenciosa (PR A). Al guardar, el mensaje dice EN QUÉ QUEDÓ, nunca solo «Cambios
 * guardados». En EN_REVISION/SUSPENDIDO la ficha es de SOLO LECTURA EN EL SERVIDOR (409 en el PUT) y
 * el encabezado muestra el aviso de entrega de Diseño; el modal viejo se retiró.
 *
 * PR B: áreas como CHIPS que togglean (antes casillas) + el encabezado de estado reubicado acá.
 * De SPEC-434: país+ciudad con `CiudadSearchSelect`; voz neutra Colombia; años como selector 1..50.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PerfilProfesional } from "@prisma/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";
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

// SPEC-706 (PR B): el estado de verificación viaja con el perfil y se pinta como ENCABEZADO de la
// ficha (una sola pantalla). Mismo shape que `EstadoVerificacionProfesionalClient`.
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
    const router = useRouter();
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
    // SPEC-706 (PR B): estado de verificación (encabezado) + habilitado, para la copy del encabezado.
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
    const guardar = async (enviar: boolean): Promise<boolean> => {
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
                    return false;
                }
                setErrorPerfil(json?.error?.message ?? "No fue posible guardar la ficha.");
                return false;
            }
            const nuevo = json.perfil as Perfil;
            // SPEC-706 (Jelkin): el mensaje dice EN QUÉ QUEDÓ — nunca solo «Cambios guardados».
            // Al ENVIAR y quedar EN_REVISION recargamos: el GET trae la `vista` nueva y el ENCABEZADO
            // muestra el aviso de entrega de Diseño + la ficha queda de solo lectura (PR B). «Guardar
            // borrador» solo confirma, sin transición.
            if (enviar && nuevo.estado === "EN_REVISION") {
                window.location.reload();
                return true;
            }
            setPerfil(nuevo);
            setOk("Guardado como borrador. Todavía no lo enviamos a revisión.");
            return true;
        } finally {
            setGuardando(false);
        }
    };

    // SPEC-740: «Siguiente» = GUARDAR el borrador y AVANZAR al paso 2 (Documentos). Guardar
    // ANTES de navegar es lo que MATA el bug: hoy ir a autorizar sin guardar perdía la ficha
    // al re-cargar. Si el guardado falla, NO se avanza (el error queda a la vista).
    const guardarYSiguiente = async () => {
        if (await guardar(false)) {
            router.push("/perfil-profesional/documentos");
        }
    };

    if (cargando) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <p className="text-muted">Cargando…</p>
            </div>
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

    // SPEC-685 (PR2): catálogos ya con fallback resuelto (vacío mientras cargan).
    const { profesion: opcionesProfesion, areas: gruposAreas, rangoEtario: opcionesRango } =
        catalogosOVacio(catalogos);

    return (
        // SPEC-740: paso 1 del asistente (la Ficha). El marco («Paso 1 de 3», progreso, salida)
        // lo pone `WizardProfesionalShell` desde el layout; acá va SOLO el contenido del paso.
        <div className="space-y-6">
            {/* SPEC-706 PR A/B: el ESTADO de verificación (encabezado display-only) enmarca la ficha
                cuando NO es su turno de editar (EN_REVISION: entregada; SUSPENDIDO; RECHAZADO con
                observaciones). El servidor igual bloquea el PUT. En BORRADOR el asistente edita. */}
            {vista && (
                <div className="mb-2">
                    <EstadoVerificacionProfesionalClient vista={vista} habilitado={habilitado} />
                </div>
            )}
            <header>
                <h1 className="font-serif text-3xl text-body">
                    {soloLectura ? "Su perfil" : "Complete su perfil"}
                </h1>
                {!soloLectura && (
                    <p className="mt-2 text-sm text-muted">
                        {/* SPEC-740: la ficha es el paso 1. Al continuar la GUARDAMOS y seguimos a
                            los documentos; la autorización y el envío a revisión son el último paso. */}
                        Cuéntenos quién es. Guardamos lo que escribe al continuar, así no pierde nada
                        entre pasos.
                    </p>
                )}
            </header>

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

                        {/* SPEC-706 (PR B · punto 1): áreas = grupos legibles con CHIPS (togglean), no
                            casillas planas. Elegida = relleno cielo + tinta (relleno-acento seguro,
                            SPEC-662); sin elegir = contorno tinta fantasma (SPEC-659). Contador de
                            ayuda. Mantiene los grupos + selección múltiple + catálogo parametrizado. */}
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

                    {/* SPEC-740: paso 1 (Ficha). Botones «Guardar borrador» (queda, no avanza) y
                        «Siguiente: documentos» (guarda el borrador y avanza — guardar-por-paso, el
                        bug-killer). El envío a revisión NO vive acá: es el acto terminal del paso 3
                        (Autorización). SOLO cuando es su turno (editable). */}
                    {!soloLectura && (
                        <div className="space-y-3">
                            {errorPerfil && (
                                <Alerta tono="advertencia" className="text-center">
                                    {errorPerfil}
                                </Alerta>
                            )}
                            {camposFaltantesServidor.length > 0 && (
                                <p role="alert" className="text-sm text-estado-ambar">
                                    Faltan datos obligatorios: {camposFaltantesServidor.join(", ")}.
                                </p>
                            )}
                            {/* Guía honesta: lo que aún faltará para enviar al final (no bloquea avanzar). */}
                            {faltantesEnvio.length > 0 && (
                                <p role="status" className="text-sm text-subtle">
                                    Para enviar a revisión al final, aún falta: {faltantesEnvio.join(", ")}.
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
                                    onClick={guardarYSiguiente}
                                    isLoading={guardando}
                                    className="sm:flex-1"
                                >
                                    Siguiente: documentos
                                </Button>
                            </div>
                        </div>
                    )}
                </form>
            </GlassCard>
        </div>
    );
}
