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
    ciudad: { id: string; nombre: string };
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
    ciudad: { select: { id: true, nombre: true } },
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
        ciudad: row.ciudad ?? { id: row.ciudadId, nombre: "" },
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
     * Lista PÚBLICA (para el directorio del padre). Solo `estado = ACTIVO`.
     * Sin orden en BD: el orden lo pone Node con una semilla por sesión
     * (candado H-4 · «da turno a todos» sin marear al padre al filtrar).
     */
    async listarActivos(filtros: FiltrosDirectorio): Promise<PerfilPublicoDTO[]> {
        const where: Prisma.PerfilProfesionalWhereInput = { estado: "ACTIVO" };
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
     * Perfil individual público. Mismo allowlist que la lista — la vista de
     * detalle no destapa campos internos. El contacto se entrega en L4, al
     * confirmar la cita, no acá.
     */
    async obtenerPublicoPorId(id: string): Promise<PerfilPublicoDTO | null> {
        const row = await this.db.perfilProfesional.findFirst({
            where: { id, estado: "ACTIVO" },
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
    async facetas(): Promise<{ ciudades: Array<{ id: string; nombre: string }>; especialidades: string[] }> {
        const rows = await this.db.perfilProfesional.findMany({
            where: { estado: "ACTIVO" },
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
