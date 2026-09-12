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
    tarifaConsultaCOP: number;
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
     * ya no valen. Mismo criterio que `ultimaAprobacion` de `vigencia.ts`,
     * resuelto en la base para no traerse el historial entero.
     */
    async venceEnVigente(perfilProfesionalId: string): Promise<Date | null> {
        const ultima = await this.db.verificacionProfesional.findFirst({
            where: { perfilProfesionalId, resultado: "APROBADO" },
            orderBy: { venceEn: "desc" },
            select: { venceEn: true },
        });
        return ultima?.venceEn ?? null;
    }

    findPorUsuarioId(usuarioId: string): Promise<PerfilProfesional | null> {
        return this.db.perfilProfesional.findUnique({ where: { usuarioId } });
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
     * La condición es la misma que `puedeAparecerEnDirectorio` (`vigencia.ts:127`)
     * expresada en SQL: existe una verificación **APROBADA** cuyo `venceEn`
     * todavía no pasó. El esquema ya trae `@@index([venceEn])` puesto para esto.
     *
     * **Deliberadamente conservador:** un perfil SIN ninguna verificación
     * aprobada tampoco aparece. Es la lectura correcta de la ley — no se muestra
     * a quien nunca se verificó— y coincide con `puedeAparecerEnDirectorio`.
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
    private async idsSembrados(): Promise<string[]> {
        const marcas = await this.db.demoMarcado.findMany({
            where: { entidad: "PerfilProfesional" },
            select: { entidadId: true },
        });
        return marcas.map((m) => m.entidadId);
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
        return rows.map(toPublicoDTO);
    }

    /**
     * SPEC-656 (I-387) · ¿HAY inventario? Cuenta los verificados SIN filtros, con
     * el MISMO predicado que `listarActivos` (estado ACTIVO ∧ vigencia vigente) —
     * por eso el conteo y la lista no pueden discrepar. Lo consume el directorio
     * del padre para separar el vacío ESTRUCTURAL (0 en total) del vacío POR FILTRO
     * (hay, ninguno con esos filtros): sin este conteo la pantalla culpa la
     * búsqueda del padre cuando el problema es que no hay gente. Un `count` no
     * proyecta ningún campo ⇒ nada que ver con el allowlist H-2.
     */
    async contarActivos(viewerUsuarioId: string | null, ahora: Date = new Date()): Promise<number> {
        return this.db.perfilProfesional.count({ where: await this.whereDirectorioPublico(ahora, viewerUsuarioId) });
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
        return row ? toPublicoDTO(row) : null;
    }

    /**
     * Facetas para los filtros del padre — deriva ciudades y especialidades
     * de los perfiles ACTIVO. Sin catálogo cerrado (especialidades es text[]);
     * derivarlas evita dropdowns desincronizados con la data real.
     *
     * Devuelve ciudades ORDENADAS por nombre y especialidades ÚNICAS,
     * ORDENADAS alfabéticamente. Ambas listas pueden venir vacías (sin
     * perfiles ACTIVO todavía) — la UI debe soportarlo sin romperse.
     */
    async facetas(viewerUsuarioId: string | null): Promise<{ ciudades: Array<{ id: string; nombre: string }>; especialidades: string[] }> {
        // SPEC-655: las facetas tampoco derivan de sembrados para un visor real — no
        // pueblan los filtros con la ciudad/especialidad de un profesional que no
        // existe. Exclusión CONDICIONADA al visor, igual que la lista.
        const rows = await this.db.perfilProfesional.findMany({
            where: { estado: "ACTIVO", ...(await this.exclusionSembradosPara(viewerUsuarioId)) },
            select: {
                especialidades: true,
                ciudad: { select: { id: true, nombre: true } },
            },
        });
        const ciudadesMap = new Map<string, { id: string; nombre: string }>();
        const especialidadesSet = new Set<string>();
        for (const r of rows) {
            if (r.ciudad) ciudadesMap.set(r.ciudad.id, { id: r.ciudad.id, nombre: r.ciudad.nombre });
            for (const e of r.especialidades) especialidadesSet.add(e);
        }
        return {
            ciudades: [...ciudadesMap.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
            especialidades: [...especialidadesSet].sort((a, b) => a.localeCompare(b, "es")),
        };
    }
}
