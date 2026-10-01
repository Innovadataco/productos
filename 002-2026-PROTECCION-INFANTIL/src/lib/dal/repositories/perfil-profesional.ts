/**
 * `PerfilProfesional` — repositorio compartido por L1b (SPEC-391: registro y
 * perfil del profesional) y L3 (SPEC-392: directorio abierto del padre).
 *
 * **CANDADO LEGAL — Ley 2375/2024 · brief A-75 §5 · veredicto CEO 07:10.**
 * Los métodos PÚBLICOS del padre (`listarActivos`, `obtenerPublicoPorId`,
 * `facetas`) usan una allowlist EXPLÍCITA en `SELECT`. Fuera de ella caen — y
 * NUNCA pueden volver — los campos internos del `PerfilProfesional`
 * (`numeroTarjetaProfesional`, `datosFacturacion`) y **el contacto del
 * profesional** que vive en `Usuario` base (`email`, `telefono`, `documentoTipo`,
 * `documentoNumero`, `fechaNacimiento`, `apellidos`, `nombre`).
 *
 * **Por qué el contacto no viaja acá:** el módulo entero (cita, reloj 48 h,
 * cobro, evidencia de que se vieron) existe **porque el contacto se entrega
 * recién con la cita confirmada**. Si el teléfono viaja en el JSON del
 * directorio, cualquiera abre DevTools, lo copia y llama por fuera — se cae
 * la plata, la métrica y la razón de ser del frente. El test `route.test.ts`
 * barre el JSON de los tres endpoints públicos y falla si aparece cualquier
 * cosa que huela a contacto.
 *
 * Los métodos privados del profesional (`findConCiudadPorUsuarioId`,
 * `crearBorrador`, `actualizarParcial`, `cambiarEstado`, `findPorUsuarioId`)
 * SÍ devuelven todo el perfil — se usan desde `/api/profesional/**` con auth
 * del propio profesional. La barrera del contacto es del DIRECTORIO PÚBLICO,
 * no del propietario del perfil.
 */
import type { EstadoPerfilProfesional, PerfilProfesional } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";
import { idsPerfilesProfesionalesSembrados } from "../demo-exclusion";
import { verificacionVigente, type VerificacionResumenInput } from "@/lib/profesionales/vigencia";
import { getParametroSistemaValor } from "@/lib/parametros";
import { repsElegible, type ConfigReps, type EstadoReps, type HechoReps, type ModalidadReps } from "@/lib/profesional/reps/reps-elegibilidad";

// SPEC-790 · parámetros del gate REPS (parametrizables; sembrados en el seed, fail-safe por defecto).
const PARAM_REPS_VENTANA = "reps.ventana_verificacion_dias";
const PARAM_REPS_EXIGIR = "reps.exigir_reps_verificado";

/**
 * SPEC-790 (T6) · Fila de la pantalla admin de carga manual REPS: el profesional `ACTIVO` + su estado REPS
 * DERIVADO de la última fila (sin fila → `SIN_VERIFICAR`). Es solo-lectura; el estado NO decide el gate acá.
 */
export interface RepsCargaItem {
    id: string;
    nombreVisible: string;
    tituloProfesional: string;
    estadoReps: EstadoReps;
    /** De la última fila: ISO, o null (no aplica salvo VIGENTE). */
    vigenteHasta: string | null;
    /** Modalidades que cubrió la última carga (vacío si no VIGENTE o sin fila). */
    modalidades: ModalidadReps[];
    /** Cuándo se registró la última verificación (ISO), o null si nunca. */
    verificadoEn: string | null;
}

/** L1b (SPEC-391): perfil completo + ciudad para la vista propia del profesional.
 *  SPEC-434 (I-302): agregamos `paisId` — la pantalla de completar necesita
 *  seleccionar el país para armar el `<CiudadSearchSelect>` en la recarga.
 *  Sigue siendo vista PROPIA; H-2 (Ley 2375/2024) no aplica sobre `paisId`. */
const INCLUDE_CIUDAD = { ciudad: { select: { id: true, nombre: true, paisId: true } } } as const;
export type PerfilConCiudad = PerfilProfesional & { ciudad: { id: string; nombre: string; paisId: string } };

/**
 * L3 (SPEC-392) · H-2 · protección de tipo, no convención.
 *
 * `PerfilPublicoDTO` es una interface EXPLÍCITA con la lista finita de campos
 * que el padre puede ver. La allowlist del `select` es la primera línea; el
 * DTO es la segunda: aunque alguien mañana agregue un campo prohibido al
 * `select`, el mapeo `toPublicoDTO` no lo copia y el tipo devuelto no lo
 * carga — el compilador rechaza la fuga antes de que un test tenga que verla.
 *
 * Regla: agregar un campo a este DTO requiere **tres** cambios coordinados
 * (interface + select + `toPublicoDTO`). Quitar uno también. Cualquier
 * descoordinación no compila.
 */
export interface PerfilPublicoDTO {
    id: string;
    nombreVisible: string;
    fotoUrl: string | null;
    tituloProfesional: string;
    especialidades: string[];
    ciudadId: string;
    atiendeVirtual: boolean;
    atiendePresencial: boolean;
    aniosExperiencia: number;
    presentacion: string;
    // SPEC-685 (PR2-bis): la tarifa se fija tras la habilitación; `null` = «por fijar».
    // La tarjeta/perfil del padre NO la muestran cuando es null (nunca 0 ni inventada).
    tarifaConsultaCOP: number | null;
    duracionMinutos: number;
    emiteFactura: boolean;
    /**
     * SPEC-441: la ubicación DEL PROFESIONAL, con país. Antes el DTO solo
     * llevaba `{id, nombre}`, así que la tarjeta imprimía una ciudad suelta
     * —«Bogotá»— sin decir de qué país ni de quién era. `pais` puede venir
     * `null` si la ciudad no lo tiene cargado: la pantalla NO inventa uno.
     */
    ciudad: { id: string; nombre: string; pais: string | null };
}

const SELECT_TARJETA_PUBLICA = {
    id: true,
    nombreVisible: true,
    fotoUrl: true,
    tituloProfesional: true,
    especialidades: true,
    ciudadId: true,
    atiendeVirtual: true,
    atiendePresencial: true,
    aniosExperiencia: true,
    presentacion: true,
    tarifaConsultaCOP: true,
    duracionMinutos: true,
    emiteFactura: true,
    // SPEC-441: el país viaja para poder decir «ciudad, país» y no una ciudad suelta.
    ciudad: { select: { id: true, nombre: true, pais: { select: { nombre: true } } } },
} satisfies Prisma.PerfilProfesionalSelect;

/**
 * Mapeo del payload de Prisma al DTO. **Único punto de conversión** — si el
 * `select` traspasa campos nuevos, no aparecen acá y quedan fuera del DTO;
 * si el DTO gana un campo, el compilador exige agregarlo abajo.
 * `ciudad` es no-nulo en el DTO pero opcional en el join (relación obligatoria
 * del schema `ciudadId String`); el fallback cae al `ciudadId` que sí es
 * obligatorio, y no expone contacto.
 */
function toPublicoDTO(row: Prisma.PerfilProfesionalGetPayload<{ select: typeof SELECT_TARJETA_PUBLICA }>): PerfilPublicoDTO {
    return {
        id: row.id,
        nombreVisible: row.nombreVisible,
        fotoUrl: row.fotoUrl,
        tituloProfesional: row.tituloProfesional,
        especialidades: row.especialidades,
        ciudadId: row.ciudadId,
        atiendeVirtual: row.atiendeVirtual,
        atiendePresencial: row.atiendePresencial,
        aniosExperiencia: row.aniosExperiencia,
        presentacion: row.presentacion,
        tarifaConsultaCOP: row.tarifaConsultaCOP,
        duracionMinutos: row.duracionMinutos,
        emiteFactura: row.emiteFactura,
        // SPEC-441: el fallback conserva la forma pero NO inventa datos —
        // nombre vacío y país null. La pantalla decide qué hacer con eso; antes
        // el guard era `p.ciudad &&`, que con este objeto siempre es cierto y
        // pintaba un pin con el nombre en blanco.
        ciudad: row.ciudad
            ? { id: row.ciudad.id, nombre: row.ciudad.nombre, pais: row.ciudad.pais?.nombre ?? null }
            : { id: row.ciudadId, nombre: "", pais: null },
    };
}

export interface FiltrosDirectorio {
    ciudadId?: string | undefined;
    especialidad?: string | undefined;
    /**
     * `virtual` | `presencial` | undefined (ambos). El brief usa dos booleanos
     * en el modelo (`atiendeVirtual`, `atiendePresencial`) — el filtro cruza
     * uno u otro; sin filtro trae ambos.
     */
    modalidad?: "virtual" | "presencial" | undefined;
}

export class PerfilProfesionalRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    // ─────────────────────────────────────────────────────────────────────
    // L1b (SPEC-391): registro y perfil propio del profesional.
    // ─────────────────────────────────────────────────────────────────────

    findConCiudadPorUsuarioId(usuarioId: string): Promise<PerfilConCiudad | null> {
        return this.db.perfilProfesional.findUnique({
            where: { usuarioId },
            include: INCLUDE_CIUDAD,
        }) as Promise<PerfilConCiudad | null>;
    }

    /** SPEC-436: el perfil por su propio id (para servir sus documentos). */
    findPorId(id: string): Promise<PerfilProfesional | null> {
        return this.db.perfilProfesional.findUnique({ where: { id } });
    }

    /**
     * SPEC-449 (I-313) · el `venceEn` vigente del profesional, o `null` si no
     * tiene ninguna verificación APROBADA.
     *
     * Lo usa el tope de horizonte al publicar una franja: la Ley 2375/2024 mide
     * la obligación en el momento de la ATENCIÓN, así que una franja que termina
     * después de esta fecha sería una cita agendada para cuando los antecedentes
     * ya no valen. Mismo criterio que `ultimaAprobacion` de `vigencia.ts` —
     * resuelto en la base para no traerse el historial entero.
     *
     * SPEC-690-B: ordena por `revisadoEn` (la aprobación MÁS RECIENTE, que es la que
     * rige — una re-verificación SUPERSEDE a la anterior), NO por `venceEn`. Antes
     * ordenaba por `venceEn desc`: coincidía con `ultimaAprobacion` solo mientras
     * `venceEn = revisadoEn + plazo fijo`; el día que el plazo de la ley cambie, una
     * aprobación nueva puede vencer antes que una vieja y las dos formas divergían
     * (el docstring afirmaba «mismo criterio» sin que lo fuera). Ahora es literal.
     */
    async venceEnVigente(perfilProfesionalId: string): Promise<Date | null> {
        const ultima = await this.db.verificacionProfesional.findFirst({
            where: { perfilProfesionalId, resultado: "APROBADO" },
            orderBy: { revisadoEn: "desc" },
            select: { venceEn: true },
        });
        return ultima?.venceEn ?? null;
    }

    findPorUsuarioId(usuarioId: string): Promise<PerfilProfesional | null> {
        return this.db.perfilProfesional.findUnique({ where: { usuarioId } });
    }

    /**
     * SPEC-690 (I-414) · lo que la habilitación necesita y nada más: el `estado` +
     * las verificaciones APROBADAS (para hallar la última vigente). `select` acotado
     * — no trae el perfil entero ni los campos reservados del historial.
     */
    habilitacionPorUsuarioId(usuarioId: string) {
        return this.db.perfilProfesional.findUnique({
            where: { usuarioId },
            select: {
                id: true, // SPEC-790: para derivar `repsAlDia` del mismo perfil sin una segunda lectura.
                estado: true,
                verificaciones: {
                    where: { resultado: "APROBADO" },
                    select: { resultado: true, revisadoEn: true, venceEn: true },
                },
            },
        });
    }

    /**
     * SPEC-707 · estado del perfil + la ÚLTIMA verificación (resultado + checklist), por id.
     * FUENTE ÚNICA para (a) bloquear el reemplazo de un documento ya APROBADO (CUMPLE)
     * mientras el perfil no está ACTIVO, y (b) mostrarle al profesional la observación del
     * requisito que le devolvieron. Solo la más reciente (`revisadoEn desc, take 1`).
     */
    estadoYUltimaRevision(perfilProfesionalId: string) {
        return this.db.perfilProfesional.findUnique({
            where: { id: perfilProfesionalId },
            select: {
                estado: true,
                verificaciones: {
                    orderBy: { revisadoEn: "desc" },
                    take: 1,
                    select: { resultado: true, checklist: true },
                },
            },
        });
    }

    crearBorrador(data: Prisma.PerfilProfesionalCreateInput): Promise<PerfilConCiudad> {
        return this.db.perfilProfesional.create({
            data,
            include: INCLUDE_CIUDAD,
        }) as Promise<PerfilConCiudad>;
    }

    actualizarParcial(id: string, data: Prisma.PerfilProfesionalUpdateInput): Promise<PerfilConCiudad> {
        return this.db.perfilProfesional.update({
            where: { id },
            data,
            include: INCLUDE_CIUDAD,
        }) as Promise<PerfilConCiudad>;
    }

    /** Cambia el estado sin tocar nada más (transición BORRADOR→EN_REVISION). */
    cambiarEstado(id: string, estado: EstadoPerfilProfesional): Promise<PerfilConCiudad> {
        return this.db.perfilProfesional.update({
            where: { id },
            data: { estado },
            include: INCLUDE_CIUDAD,
        }) as Promise<PerfilConCiudad>;
    }

    // ─────────────────────────────────────────────────────────────────────
    // L3 (SPEC-392): directorio abierto del padre — allowlist estricta.
    // ─────────────────────────────────────────────────────────────────────

    /**
     * SPEC-449 (I-313) · la SEGUNDA defensa de la vigencia, y la que no depende
     * de que el reloj haya corrido.
     *
     * La Ley 2375/2024 obliga a revalidar antecedentes cada 4 meses. El worker
     * de SPEC-449 marca `VENCIDO`, pero corre una vez al día: entre que los
     * antecedentes caducan y que el reloj pasa hay una ventana en la que el
     * perfil sigue `ACTIVO`. Este filtro cierra esa ventana **en la consulta**,
     * y por eso las dos defensas suman en vez de sustituirse.
     *
     * SPEC-690-B: es un pre-filtro GRUESO, NO el criterio autoritativo. Expresa
     * «existe ALGUNA verificación APROBADA con `venceEn` > ahora» — un SUPERSET de
     * `puedeAparecerEnDirectorio`/`verificacionVigente`, que exige que la
     * aprobación MÁS RECIENTE (por `revisadoEn`) sea la vigente. Estrecha el
     * barrido por `@@index([venceEn])`; la palabra final la da
     * `idsConVigenciaAutoritativa` en JS. Coinciden hoy (`venceEn = revisadoEn +
     * plazo fijo`), divergen si cambia el plazo — por eso NO se usa este SQL como
     * criterio último.
     *
     * **Deliberadamente conservador:** un perfil SIN ninguna verificación
     * aprobada tampoco aparece — no se muestra a quien nunca se verificó.
     */
    private static vigenciaVigente(ahora: Date): Prisma.PerfilProfesionalWhereInput {
        return {
            verificaciones: {
                some: { resultado: "APROBADO", venceEn: { gt: ahora } },
            },
        };
    }

    /**
     * SPEC-655 (I-387) · ids de los perfiles SEMBRADOS (demo). Se EXCLUYEN del
     * directorio público y del agendamiento: un padre real no puede ver —ni AGENDAR
     * con— un profesional que no existe (pagaría una primera cita a un fantasma;
     * irreversible, y el costo cae sobre el padre).
     *
     * Predicado canónico «es sembrado» (SPEC-414) = marca en `demo_marcado` O
     * pertenencia a `simulacion_reportes`. Para `PerfilProfesional` SOLO puede
     * aplicar `demo_marcado`: `simulacion_reportes` guarda `reporteId` —un
     * profesional NUNCA está ahí—, igual que `inicio-admin.ts` omite ese join para
     * Colegio/Usuario. No es recortar el predicado: para esta entidad, `demo_marcado`
     * ES el completo. `demo_marcado` es polimórfica y sin relación Prisma → se traen
     * los ids y se excluyen con `NOT id in`, que conserva el allowlist H-2 del
     * `select` (raw SQL lo saltaría).
     *
     * LÍMITE (SPEC-420): `NOT id in <ids>` gasta un parámetro de bind por id y
     * Postgres corta en 32.767 (reventó de verdad con 37.176 marcas). Con ~50
     * profesionales sembrados sobra de lejos; si este patrón se lleva a una entidad
     * de VOLUMEN, cambiar a un anti-join (`LEFT JOIN … IS NULL`) ANTES de acercarse
     * a ese piso.
     */
    private idsSembrados(): Promise<string[]> {
        // I-419: predicado canónico compartido (una fuente) con la cola del Verificador.
        return idsPerfilesProfesionalesSembrados(this.db);
    }

    /**
     * SPEC-655 (corregido) · ¿el VISOR es un usuario sembrado? Un usuario demo está
     * marcado en `demo_marcado` con entidad "Usuario" (el poblador marca así a los
     * padres demo). Para un Usuario solo aplica esa marca — `simulacion_reportes`
     * guarda `reporteId`, nunca un usuario.
     */
    private async esUsuarioSembrado(usuarioId: string): Promise<boolean> {
        const marca = await this.db.demoMarcado.findFirst({
            where: { entidad: "Usuario", entidadId: usuarioId },
            select: { id: true },
        });
        return marca !== null;
    }

    /**
     * SPEC-655 (corregido) · fragmento de exclusión de sembrados CONDICIONADO al VISOR.
     * La invariante correcta no es «un sembrado no es alcanzable por un padre» sino
     * «un sembrado es visible SOLO para un usuario sembrado»: un padre real no puede
     * pagarle a un fantasma, pero un padre demo viendo profesionales demo ES el demo.
     * Si el visor está sembrado → sin exclusión (ve los demo). Si no lo está, o no hay
     * sesión (visor null) → se excluyen los sembrados. El visor SIEMPRE viene de la
     * sesión del servidor; un muro cuya condición pone el cliente falla ABIERTO.
     */
    private async exclusionSembradosPara(
        viewerUsuarioId: string | null,
    ): Promise<Prisma.PerfilProfesionalWhereInput> {
        if (viewerUsuarioId && (await this.esUsuarioSembrado(viewerUsuarioId))) return {};
        return { NOT: { id: { in: await this.idsSembrados() } } };
    }

    /**
     * SPEC-655 · WHERE del directorio público: el filtro legal (estado ACTIVO ∧
     * vigencia, SPEC-449) MÁS la exclusión de sembrados CONDICIONADA al visor. Vive en
     * el repositorio, en el MISMO carril que el filtro legal, para que CUALQUIER
     * superficie que consulte el repo herede ambos sin enterarse. Los campos
     * obligatorios van al final: un `extra` del llamador no puede sobreescribirlos.
     *
     * DECISIÓN (D-121 · divergencia conteo↔lista bajo concurrencia — se deja A PROPÓSITO):
     * `listarActivos` y `contarActivos` resuelven la exclusión cada uno por su cuenta (ambos
     * llaman `exclusionSembradosPara`, que lee `esUsuarioSembrado` y —para un visor real—
     * `idsSembrados`), en instantes distintos. Si `demo_marcado` cambia ENTRE los dos, excluyen
     * conjuntos distintos; hoy son DOS lecturas por request, así que la ventana es un pelo más
     * ancha que con la exclusión vieja. NO se corrige, y en concreto NO threadear esos ids/flags
     * por el route: eso filtra un detalle del repositorio hacia arriba y rompe la propiedad que
     * hace ESTRUCTURAL la garantía — que un callsite nuevo herede la exclusión sin enterarse. El
     * costo de dejarlo es una ventana de sub-segundo que SOLO se abre durante una siembra/purga
     * MANUAL (en tráfico real `demo_marcado` está estático), sobre el booleano de fallback
     * `hayVerificados` (route del padre, solo si la lista filtrada quedó vacía), y se auto-cura al
     * recargar. Ya está DECIDIDO: no es un TODO ni un «por ahora» — si lees «puede divergir bajo
     * concurrencia», es esto.
     */
    private async whereDirectorioPublico(
        ahora: Date,
        viewerUsuarioId: string | null,
        extra: Prisma.PerfilProfesionalWhereInput = {},
    ): Promise<Prisma.PerfilProfesionalWhereInput> {
        return {
            ...extra,
            estado: "ACTIVO",
            ...PerfilProfesionalRepository.vigenciaVigente(ahora),
            ...(await this.exclusionSembradosPara(viewerUsuarioId)),
        };
    }

    /**
     * SPEC-690-B (I-414) · Filtro de vigencia AUTORITATIVO. `vigenciaVigente` (SQL,
     * arriba) es un pre-filtro GRUESO —«existe ALGUNA aprobada con venceEn > ahora»,
     * un SUPERSET— que estrecha el barrido por el índice `@@index([venceEn])`. La
     * palabra FINAL la tiene `verificacionVigente`: la aprobación MÁS RECIENTE por
     * `revisadoEn` sigue vigente (una re-verificación SUPERSEDE a la anterior). Es el
     * MISMO término que la compuerta (`estaHabilitado`) y `/api/me`, así el directorio
     * y «poder operar» no pueden divergir. Hoy el SQL y este filtro coinciden porque
     * `venceEn = revisadoEn + plazo fijo`; el día que cambie el plazo, el SQL dejaría
     * pasar a alguien cuya ÚLTIMA verificación venció pero con una vieja aún vigente —
     * este filtro lo excluye (candado `perfil-profesional-directorio-vigencia`).
     *
     * Las verificaciones se traen en esta consulta INTERNA aparte —NUNCA en
     * `SELECT_TARJETA_PUBLICA`— para conservar el allowlist H-2: el DTO público jamás
     * ve `resultado`, `revisadoEn`, `venceEn` ni ningún interno de la verificación.
     */
    private async idsConVigenciaAutoritativa(perfilIds: string[], ahora: Date): Promise<Set<string>> {
        if (perfilIds.length === 0) return new Set();
        const verifs = await this.db.verificacionProfesional.findMany({
            where: { perfilProfesionalId: { in: perfilIds }, resultado: "APROBADO" },
            select: { perfilProfesionalId: true, resultado: true, revisadoEn: true, venceEn: true },
        });
        const porPerfil = new Map<string, VerificacionResumenInput[]>();
        for (const v of verifs) {
            const arr = porPerfil.get(v.perfilProfesionalId) ?? [];
            arr.push({ resultado: v.resultado, revisadoEn: v.revisadoEn, venceEn: v.venceEn });
            porPerfil.set(v.perfilProfesionalId, arr);
        }
        const vigentes = new Set<string>();
        for (const [id, vs] of porPerfil) {
            if (verificacionVigente(vs, ahora)) vigentes.add(id);
        }
        return vigentes;
    }

    /** SPEC-790 · Config del gate REPS (parametrizable, fail-safe): ventana 365 d + cutover ABIERTO por defecto. */
    private async configReps(): Promise<ConfigReps> {
        const ventana = parseInt((await getParametroSistemaValor(PARAM_REPS_VENTANA)) ?? "", 10);
        const exigir = (await getParametroSistemaValor(PARAM_REPS_EXIGIR))?.trim().toLowerCase();
        return {
            ventanaVerificacionDias: Number.isFinite(ventana) && ventana > 0 ? ventana : 365,
            // Ships `false` (cutover ABIERTO): hoy SIN_VERIFICAR es el universo; exigir vaciaría el directorio.
            exigirRepsVerificado: exigir === "true" || exigir === "1",
        };
    }

    /**
     * SPEC-790 · REPS-elegibles entre `perfilIds`. Deriva el estado de la ÚLTIMA fila de `VerificacionReps`
     * (orden `verificadoEn` desc; SIN fila → SIN_VERIFICAR) y aplica `repsElegible` (dos relojes + cutover).
     * `modalidad=null` en el directorio: la vigencia es la compuerta; la modalidad se exige al RESERVAR.
     * NO es una cláusula SQL: con SIN_VERIFICAR como universo y el cutover abierto, un `some(VIGENTE)`
     * vaciaría el directorio — acá SIN_VERIFICAR PASA mientras el parámetro no exija el REPS. FK RESTRICT:
     * la fila-prueba sobrevive a la baja del profesional, así que no asumimos que borrarlo la quita.
     */
    private async idsRepsElegibles(perfilIds: string[], ahora: Date, modalidad: ModalidadReps | null): Promise<Set<string>> {
        if (perfilIds.length === 0) return new Set();
        const config = await this.configReps();
        const filas = await this.db.verificacionReps.findMany({
            where: { profesionalId: { in: perfilIds } },
            orderBy: { verificadoEn: "desc" },
            select: { profesionalId: true, resultado: true, verificadoEn: true, vigenteHasta: true, modalidades: true },
        });
        const ultima = new Map<string, HechoReps>();
        for (const f of filas) {
            // Primera que aparece por profesional = la más reciente (orden desc).
            if (!ultima.has(f.profesionalId)) {
                ultima.set(f.profesionalId, {
                    resultado: f.resultado,
                    verificadoEn: f.verificadoEn,
                    vigenteHasta: f.vigenteHasta,
                    modalidades: f.modalidades,
                });
            }
        }
        const elegibles = new Set<string>();
        for (const id of perfilIds) {
            if (repsElegible(ultima.get(id) ?? null, modalidad, config, ahora).elegible) elegibles.add(id);
        }
        return elegibles;
    }

    /**
     * SPEC-790 (D-3/D-8) · «OFRECIBLE» — los profesionales que pueden OFRECERSE a las familias. Es el SEGUNDO
     * trabajo que `habilitado` hacía mezclado, ahora nombrado: ofrecible = habilitación del directorio
     * (vigencia autoritativa SPEC-690) **∧** `repsAlDia` (SPEC-790). NO es `habilitado` (que es «puede usar el
     * área profesional» = ACTIVO ∧ verificación interna; el REPS NO lo toca, para no encerrar al profesional
     * fuera de su propio panel — el aviso de «fuera de la oferta» usa `habilitado ∧ ¬repsAlDia`). Las CUATRO
     * lecturas del directorio pasan por acá —reemplaza la llamada directa a `idsConVigenciaAutoritativa`— para
     * heredar el gate sin enterarse. El REPS se evalúa SOLO sobre los que ya pasaron la vigencia interna.
     */
    private async idsOfrecibles(perfilIds: string[], ahora: Date): Promise<Set<string>> {
        const vigentes = await this.idsConVigenciaAutoritativa(perfilIds, ahora);
        if (vigentes.size === 0) return vigentes;
        const repsOk = await this.idsRepsElegibles([...vigentes], ahora, null);
        const out = new Set<string>();
        for (const id of vigentes) if (repsOk.has(id)) out.add(id);
        return out;
    }

    /**
     * SPEC-790 · `repsAlDia` — la derivación REPS NOMBRADA y queryable para UN profesional (vigencia-only, sin
     * modalidad). Es la mitad REPS de «ofrecible», extraída para que una PANTALLA pueda preguntarla (hoy la
     * condición existía solo como efecto lateral del filtro del directorio). El aviso «seguís entrando pero
     * estás fuera de la oferta» es `habilitado ∧ ¬repsAlDia`. Deriva de la ÚLTIMA fila; cutover-aware.
     */
    async repsAlDia(profesionalId: string, ahora: Date = new Date()): Promise<boolean> {
        return (await this.idsRepsElegibles([profesionalId], ahora, null)).has(profesionalId);
    }

    /**
     * SPEC-790 (T4b) · ¿el profesional es REPS-elegible para ESTA modalidad, al RESERVAR? El directorio usa
     * vigencia-only (modalidad=null); el booking exige que el REPS cubra la modalidad CONCRETA de la cita —
     * una habilitación presencial no atiende una cita de telemedicina. Lo llama `crearSolicitudCita`.
     */
    async esRepsElegibleParaModalidad(profesionalId: string, modalidad: ModalidadReps, ahora: Date = new Date()): Promise<boolean> {
        return (await this.idsRepsElegibles([profesionalId], ahora, modalidad)).has(profesionalId);
    }

    /**
     * SPEC-790 (T6) · Lista para la PANTALLA de carga manual REPS (admin): los profesionales `ACTIVO` con el
     * estado REPS DERIVADO de su ÚLTIMA fila (orden `verificadoEn` desc; SIN fila → `SIN_VERIFICAR`, el default
     * de hoy — el caso NORMAL mientras nadie cargó nada). NO cachea el estado en una columna (se deriva, igual
     * que el gate). Es SOLO-LECTURA para la pantalla: el estado NO decide el gate acá (lo decide el directorio);
     * se MUESTRA para que el admin sepa a quién le falta. Trae `vigenteHasta`/`modalidades`/`verificadoEn` de la
     * última fila para el detalle, sin una segunda lectura. Mismo patrón «última fila» que `idsRepsElegibles`.
     */
    async listarParaCargaReps(): Promise<RepsCargaItem[]> {
        const profesionales = await this.db.perfilProfesional.findMany({
            // ACTIVO-NO-DIRECTORIO (T6): esta lista NO es el directorio público. El estado NO decide el gate acá
            // (la pantalla es solo-lectura). DEBE incluir a los de REPS VENCIDO —son justo los que el admin abre
            // para cargarles la verificación—; pasar por `whereDirectorioPublico` (suma vigencia+exclusión+REPS)
            // los filtraría y haría la pantalla circular: no podría arreglarse un REPS vencido desde la pantalla
            // que lo arregla. Por eso el predicado va a mano acá, fuera del builder, declarado.
            where: { estado: "ACTIVO" },
            select: { id: true, nombreVisible: true, tituloProfesional: true },
            orderBy: { nombreVisible: "asc" },
        });
        if (profesionales.length === 0) return [];
        const filas = await this.db.verificacionReps.findMany({
            where: { profesionalId: { in: profesionales.map((p) => p.id) } },
            orderBy: { verificadoEn: "desc" },
            select: { profesionalId: true, resultado: true, vigenteHasta: true, modalidades: true, verificadoEn: true },
        });
        const ultima = new Map<string, (typeof filas)[number]>();
        // Primera que aparece por profesional = la más reciente (orden desc), igual que `idsRepsElegibles`.
        for (const f of filas) if (!ultima.has(f.profesionalId)) ultima.set(f.profesionalId, f);
        return profesionales.map((p) => {
            const u = ultima.get(p.id);
            return {
                id: p.id,
                nombreVisible: p.nombreVisible,
                tituloProfesional: p.tituloProfesional,
                estadoReps: u?.resultado ?? "SIN_VERIFICAR",
                vigenteHasta: u?.vigenteHasta?.toISOString() ?? null,
                modalidades: u?.modalidades ?? [],
                verificadoEn: u?.verificadoEn?.toISOString() ?? null,
            };
        });
    }

    /**
     * Lista PÚBLICA (para el directorio del padre). Solo `estado = ACTIVO`.
     * Sin orden en BD: el orden lo pone Node con una semilla por sesión
     * (candado H-4 · «da turno a todos» sin marear al padre al filtrar).
     */
    async listarActivos(
        filtros: FiltrosDirectorio,
        viewerUsuarioId: string | null,
        ahora: Date = new Date(),
    ): Promise<PerfilPublicoDTO[]> {
        // SPEC-449 estado ∧ vigencia + SPEC-655 exclusión de sembrados CONDICIONADA al visor.
        const where = await this.whereDirectorioPublico(ahora, viewerUsuarioId);
        if (filtros.ciudadId) where.ciudadId = filtros.ciudadId;
        if (filtros.especialidad) where.especialidades = { has: filtros.especialidad };
        if (filtros.modalidad === "virtual") where.atiendeVirtual = true;
        if (filtros.modalidad === "presencial") where.atiendePresencial = true;
        const rows = await this.db.perfilProfesional.findMany({
            where,
            select: SELECT_TARJETA_PUBLICA,
        });
        // SPEC-690-B: la palabra final es `verificacionVigente` (autoritativa) sobre
        // el pre-filtro grueso del SQL. Mismo término que la compuerta.
        const vigentes = await this.idsOfrecibles(rows.map((r) => r.id), ahora);
        return rows.filter((r) => vigentes.has(r.id)).map(toPublicoDTO);
    }

    /**
     * SPEC-656 (I-387) · ¿HAY inventario? Cuenta los verificados SIN filtros, con
     * el MISMO predicado que `listarActivos` (estado ACTIVO ∧ vigencia vigente) —
     * por eso el conteo y la lista no pueden discrepar. Lo consume el directorio
     * del padre para separar el vacío ESTRUCTURAL (0 en total) del vacío POR FILTRO
     * (hay, ninguno con esos filtros): sin este conteo la pantalla culpa la
     * búsqueda del padre cuando el problema es que no hay gente. Solo proyecta
     * `id` para el filtro autoritativo ⇒ nada que ver con el allowlist H-2.
     */
    async contarActivos(viewerUsuarioId: string | null, ahora: Date = new Date()): Promise<number> {
        // SPEC-690-B: el conteo pasa por el MISMO filtro autoritativo que la lista
        // (fetch + filter, no `count` crudo), o divergirían justo en el caso que el
        // SQL grueso deja pasar (SPEC-656: el conteo es el que separa vacío
        // estructural de vacío por filtro; si miente, la pantalla culpa al padre).
        const candidatos = await this.db.perfilProfesional.findMany({
            where: await this.whereDirectorioPublico(ahora, viewerUsuarioId),
            select: { id: true },
        });
        const vigentes = await this.idsOfrecibles(candidatos.map((c) => c.id), ahora);
        return candidatos.filter((c) => vigentes.has(c.id)).length;
    }

    /**
     * Perfil individual público. Mismo allowlist que la lista — la vista de
     * detalle no destapa campos internos. El contacto se entrega en L4, al
     * confirmar la cita, no acá.
     */
    async obtenerPublicoPorId(
        id: string,
        viewerUsuarioId: string | null,
        ahora: Date = new Date(),
    ): Promise<PerfilPublicoDTO | null> {
        const row = await this.db.perfilProfesional.findFirst({
            // SPEC-449: mismo par estado ∧ vigencia que la lista. Este método
            // tiene TRES consumidores, y uno es `cita.service.ts`, que lo usa
            // para validar al profesional al crear la cita: filtrar acá bloquea
            // de paso las citas nuevas contra un profesional vencido.
            where: await this.whereDirectorioPublico(ahora, viewerUsuarioId, { id }),
            select: SELECT_TARJETA_PUBLICA,
        });
        if (!row) return null;
        // SPEC-690-B: mismo filtro autoritativo que la lista — un profesional cuya
        // ÚLTIMA verificación venció no se abre por id (ni deja crear cita contra él).
        const vigentes = await this.idsOfrecibles([row.id], ahora);
        return vigentes.has(row.id) ? toPublicoDTO(row) : null;
    }

    /**
     * Facetas para los filtros del padre — deriva ciudades y especialidades
     * de los perfiles del directorio. Sin catálogo cerrado (especialidades es
     * text[]); derivarlas evita dropdowns desincronizados con la data real.
     *
     * Devuelve ciudades ORDENADAS por nombre y especialidades ÚNICAS,
     * ORDENADAS alfabéticamente. Ambas listas pueden venir vacías (sin
     * perfiles en el directorio todavía) — la UI debe soportarlo sin romperse.
     *
     * SPEC-790 · Es el CUARTO consumidor del directorio y debe usar el MISMO
     * predicado que `listarActivos` — ni uno de más. Antes escribía un `where`
     * a mano (`estado: "ACTIVO"` + exclusión) que se SALTABA `vigenciaVigente` y
     * el filtro autoritativo: poblaba una ciudad/especialidad cuyo único
     * profesional estaba VENCIDO, el padre elegía el filtro y la lista salía
     * vacía (opción de filtro muerta). Ahora pasa por `whereDirectorioPublico`
     * (estado ∧ vigencia ∧ exclusión ∧ —cuando entre 790— REPS al día) y por el
     * MISMO filtro autoritativo `idsConVigenciaAutoritativa` que la lista, para
     * que un gate nuevo en el builder lo herede SIN que nadie se acuerde de
     * `facetas`. Candado estructural: `perfil-profesional-activo-solo-en-builder`
     * (el literal `"ACTIVO"` es PROPIEDAD del builder). Vigencia de las facetas:
     * `perfil-profesional-directorio-vigencia` (cubre las CUATRO lecturas).
     */
    async facetas(
        viewerUsuarioId: string | null,
        ahora: Date = new Date(),
    ): Promise<{ ciudades: Array<{ id: string; nombre: string }>; especialidades: string[] }> {
        const rows = await this.db.perfilProfesional.findMany({
            where: await this.whereDirectorioPublico(ahora, viewerUsuarioId),
            select: {
                id: true,
                especialidades: true,
                ciudad: { select: { id: true, nombre: true } },
            },
        });
        // SPEC-690-B: la palabra final de la vigencia es `idsConVigenciaAutoritativa`,
        // igual que la lista; las facetas se derivan SOLO de los habilitados de verdad.
        const vigentes = await this.idsOfrecibles(rows.map((r) => r.id), ahora);
        const ciudadesMap = new Map<string, { id: string; nombre: string }>();
        const especialidadesSet = new Set<string>();
        for (const r of rows) {
            if (!vigentes.has(r.id)) continue;
            if (r.ciudad) ciudadesMap.set(r.ciudad.id, { id: r.ciudad.id, nombre: r.ciudad.nombre });
            for (const e of r.especialidades) especialidadesSet.add(e);
        }
        return {
            ciudades: [...ciudadesMap.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
            especialidades: [...especialidadesSet].sort((a, b) => a.localeCompare(b, "es")),
        };
    }
}
