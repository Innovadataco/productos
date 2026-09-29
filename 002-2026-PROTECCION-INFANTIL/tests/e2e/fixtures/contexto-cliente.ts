/**
 * SPEC-775 · Fixture de CONTEXTO DE CLIENTE para e2e (Calidad).
 *
 * POR QUÉ EXISTE (decisión CEO): varios candados de seguridad estaban MUDOS porque su
 * fixture creaba un ESTADO QUE EL PRODUCTO NO PUEDE PRODUCIR — un `COMITE_CONVIVENCIA`
 * (o `SCHOOL_ADMIN`) SIN colegio no existe en producción, y el login lo corta con 403
 * por la compuerta de vigencia (SPEC-119/168, `login/route.ts`). Un test que "pasa"
 * contra un estado imposible pasó por un motivo que no conocemos. Este helper arma el
 * contexto de cliente VÁLIDO (colegio con servicio vigente + vínculo hecho) para que los
 * resultados signifiquen algo.
 *
 * CONTRATO (las tres condiciones del CEO):
 *   1. VÁLIDO POR DEFECTO: `vigencia: "vigente"`, `estado: "activo"`, vínculo hecho.
 *   2. Las VARIACIONES son PARÁMETROS (`vigencia`), no estado armado a mano en el spec.
 *   3. NO abre la puerta a estados imposibles: el comité/rector se crean SIEMPRE ligados
 *      al colegio que este helper crea — no hay forma de pedir uno "suelto".
 *
 * Solo para `tests/e2e/**`. Escribe por `@/lib/prisma` contra la BD de PRUEBAS (la guardia
 * SPEC-770 del globalSetup garantiza que la corrida apunta a una base `*_test`).
 */
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { randomUUID } from "node:crypto";
import type { RolUsuario } from "@prisma/client";

const DIA_MS = 24 * 60 * 60 * 1000;

/** Estado del servicio del colegio. El producto lo deriva de la ventana inicio/fin. */
export type VigenciaCliente = "vigente" | "vencido" | "no_iniciado";

export interface CredencialUsuario {
    email: string;
    password: string;
}

export interface OpcionesContextoCliente {
    /** Etiqueta de corrida (para nombres/nit únicos y trazabilidad). */
    corrida: string;
    /** Ventana de servicio. Por defecto VIGENTE (lo normal = lo correcto). */
    vigencia?: VigenciaCliente;
    /** Si se pasa, crea un COMITE_CONVIVENCIA activo LIGADO a este colegio. */
    comite?: CredencialUsuario;
    /** Si se pasa, crea un SCHOOL_ADMIN activo LIGADO a este colegio. */
    rector?: CredencialUsuario;
}

export interface ContextoCliente {
    tenantId: string;
    colegioId: string;
    comiteId?: string;
    rectorId?: string;
    /** Ids creados, en orden de borrado seguro (dependientes primero). */
    readonly _limpieza: { usuarios: string[]; colegios: string[]; tenants: string[] };
}

function ventanaDeServicio(vigencia: VigenciaCliente): { inicioServicio: Date; finServicio: Date | null } {
    const ahora = Date.now();
    switch (vigencia) {
        case "vencido":
            return { inicioServicio: new Date(ahora - 30 * DIA_MS), finServicio: new Date(ahora - DIA_MS) };
        case "no_iniciado":
            return { inicioServicio: new Date(ahora + 7 * DIA_MS), finServicio: null };
        case "vigente":
        default:
            return { inicioServicio: new Date(ahora - 7 * DIA_MS), finServicio: null };
    }
}

/**
 * Crea Tenant + Colegio (servicio VIGENTE por defecto) y, opcionalmente, los usuarios de
 * rol ligado a cliente (comité y/o rector) ya vinculados. Devuelve los ids + la info de
 * limpieza para el `afterAll`.
 */
export async function crearContextoCliente(opts: OpcionesContextoCliente): Promise<ContextoCliente> {
    const { corrida, vigencia = "vigente" } = opts;

    const ciudad = await prisma.ciudad.findFirst({ select: { id: true, paisId: true } });
    if (!ciudad) throw new Error("[fixture] prod debe tener al menos una Ciudad sembrada");

    const { inicioServicio, finServicio } = ventanaDeServicio(vigencia);

    const tenant = await prisma.tenant.create({ data: { nombre: `Tenant E2E ${corrida}` } });

    const colegio = await prisma.colegio.create({
        data: {
            nombre: `Colegio E2E ${corrida}`,
            nit: `nit-${corrida}-${randomUUID().slice(0, 8)}`,
            paisId: ciudad.paisId,
            ciudadId: ciudad.id,
            representanteLegalNombre: "Representante E2E",
            representanteLegalIdentificacion: `rep-${corrida}`,
            representanteLegalEmail: `rep-${corrida}@e2e.local`,
            estado: "activo",
            tipoPeriodo: "ANUAL",
            inicioServicio,
            finServicio,
            tenantId: tenant.id,
        },
    });

    const ctx: ContextoCliente = {
        tenantId: tenant.id,
        colegioId: colegio.id,
        _limpieza: { usuarios: [], colegios: [colegio.id], tenants: [tenant.id] },
    };

    if (opts.comite) {
        const u = await prisma.usuario.create({
            data: {
                email: opts.comite.email,
                nombre: `Comité de Convivencia E2E ${corrida}`,
                passwordHash: await hashPassword(opts.comite.password),
                rol: "COMITE_CONVIVENCIA" as RolUsuario,
                estado: "activo",
                tenantId: tenant.id,
                comiteColegioId: colegio.id,
            },
        });
        ctx.comiteId = u.id;
        ctx._limpieza.usuarios.push(u.id);
    }

    if (opts.rector) {
        const u = await prisma.usuario.create({
            data: {
                email: opts.rector.email,
                nombre: `Rector E2E ${corrida}`,
                passwordHash: await hashPassword(opts.rector.password),
                rol: "SCHOOL_ADMIN" as RolUsuario,
                estado: "activo",
                tenantId: tenant.id,
                colegioId: colegio.id,
            },
        });
        ctx.rectorId = u.id;
        ctx._limpieza.usuarios.push(u.id);
    }

    return ctx;
}

/** Borra lo creado por `crearContextoCliente`: dependientes (usuarios) → colegio → tenant. */
export async function limpiarContextoCliente(ctx: ContextoCliente): Promise<void> {
    if (ctx._limpieza.usuarios.length > 0) {
        await prisma.usuario.deleteMany({ where: { id: { in: ctx._limpieza.usuarios } } }).catch(() => undefined);
    }
    await prisma.colegio.deleteMany({ where: { id: { in: ctx._limpieza.colegios } } }).catch(() => undefined);
    await prisma.tenant.deleteMany({ where: { id: { in: ctx._limpieza.tenants } } }).catch(() => undefined);
}
