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

/** L1b (SPEC-391): perfil completo + ciudad para la vista propia del profesional. */
const INCLUDE_CIUDAD = { ciudad: { select: { id: true, nombre: true } } } as const;
export type PerfilConCiudad = PerfilProfesional & { ciudad: { id: string; nombre: string } };

/**
 * L3 (SPEC-392): allowlist de tarjeta pública. Fields "seguros" del propio
 * perfil + `ciudad` REDUCIDA a `{id, nombre}`. Los internos
 * (`numeroTarjetaProfesional`, `datosFacturacion`) están AUSENTES por omisión.
 */
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

export type PerfilProfesionalPublicoRow = Prisma.PerfilProfesionalGetPayload<{
    select: typeof SELECT_TARJETA_PUBLICA;
}>;

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
    listarActivos(filtros: FiltrosDirectorio): Promise<PerfilProfesionalPublicoRow[]> {
        const where: Prisma.PerfilProfesionalWhereInput = { estado: "ACTIVO" };
        if (filtros.ciudadId) where.ciudadId = filtros.ciudadId;
        if (filtros.especialidad) where.especialidades = { has: filtros.especialidad };
        if (filtros.modalidad === "virtual") where.atiendeVirtual = true;
        if (filtros.modalidad === "presencial") where.atiendePresencial = true;
        return this.db.perfilProfesional.findMany({
            where,
            select: SELECT_TARJETA_PUBLICA,
        });
    }

    /**
     * Perfil individual público. Mismo allowlist que la lista — la vista de
     * detalle no destapa campos internos. El contacto se entrega en L4, al
     * confirmar la cita, no acá.
     */
    obtenerPublicoPorId(id: string): Promise<PerfilProfesionalPublicoRow | null> {
        return this.db.perfilProfesional.findFirst({
            where: { id, estado: "ACTIVO" },
            select: SELECT_TARJETA_PUBLICA,
        });
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
