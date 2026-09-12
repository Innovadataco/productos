/**
 * SPEC-679 · candados de CONDUCTA del purgador demo-prod. Tres propiedades, cada una con
 * su instrumento — NINGUNA una lista de nombres a mano:
 *   1. ALCANCE (anti-I-405): correr purgar({corrida:A}) borra A y deja B USABLE (no solo presente).
 *   2. ORDEN: derivado de pg_constraint (las FKs REALES tras migrate deploy), no de una lista.
 *   3. PERTENENCIA: todo lo que los pobladores demo-prod MARCAN lo limpia ALGUNA fase.
 *
 * Integración (1 y 2 tocan la BD; el catálogo sólo tiene las FKs tras `migrate deploy`).
 * Vive en `src/**` A PROPÓSITO: un test de integración fuera de src/ NO corre en CI
 * (dev-candado-integracion-src-y-seed-no-se-trunca). Precedente del método pg_constraint:
 * `purga-fk-cobertura.candado.test.ts` (SPEC-615 / I-374): «que muera la clase, no el caso».
 */
import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../../scripts/demo-prod/lib/prisma";
import { ORDEN_BORRADO } from "../../scripts/demo-prod/lib/orden-borrado";
import { purgar } from "../../scripts/demo-prod/purgar-demo";

const DEMO_PROD = path.join(__dirname, "../../scripts/demo-prod");
// Nombre de tabla real de un modelo, respetando @@map (mismo método que SPEC-615).
const tablaDe = (entidad: string): string =>
    Prisma.dmmf.datamodel.models.find((m) => m.name === entidad)?.dbName ?? entidad;

// ─────────────────────────────────────────────────────────────────────────────
// 1 · ALCANCE — conducta pura: hay que CORRER el purgador y ver que la otra corrida
//     sobrevive USABLE. No se deriva de nada; es la garantía anti-I-405.
// ─────────────────────────────────────────────────────────────────────────────
describe("SPEC-679 · alcance: purgar una corrida deja las otras USABLES", () => {
    const RUN = `test679-${Date.now()}`;
    const corridaA = `${RUN}-A`;
    const corridaB = `${RUN}-B`;
    const creados: { tenants: string[]; usuarios: string[] } = { tenants: [], usuarios: [] };

    // Cadena mínima que ejercita orden FK (Usuario→Tenant) + una relación para recorrer.
    async function sembrar(corrida: string): Promise<{ tenantId: string; usuarioId: string }> {
        const tenant = await prisma.tenant.create({ data: { nombre: `T-${corrida}` }, select: { id: true } });
        creados.tenants.push(tenant.id);
        await prisma.demoMarcado.create({ data: { entidad: "Tenant", entidadId: tenant.id, metadata: { corrida, script: "test-679" } } });
        const usuario = await prisma.usuario.create({
            data: { email: `${corrida}@test679.local`, passwordHash: "x", rol: "PARENT", tenantId: tenant.id },
            select: { id: true },
        });
        creados.usuarios.push(usuario.id);
        await prisma.demoMarcado.create({ data: { entidad: "Usuario", entidadId: usuario.id, metadata: { corrida, script: "test-679" } } });
        return { tenantId: tenant.id, usuarioId: usuario.id };
    }

    const marcasDe = (corrida: string): Promise<number> =>
        prisma.demoMarcado.count({ where: { metadata: { path: ["corrida"], equals: corrida } } });

    afterAll(async () => {
        // Limpieza MANUAL (no vía purgar, que es lo que se prueba); FK-safe: usuarios antes que tenants.
        await prisma.usuario.deleteMany({ where: { id: { in: creados.usuarios } } });
        await prisma.tenant.deleteMany({ where: { id: { in: creados.tenants } } });
        for (const c of [corridaA, corridaB]) {
            await prisma.demoMarcado.deleteMany({ where: { metadata: { path: ["corrida"], equals: c } } });
        }
    });

    it("purgar({corrida:A}) borra A (filas + marcas) y B queda USABLE, no sólo presente", async () => {
        const a = await sembrar(corridaA);
        const b = await sembrar(corridaB);

        await purgar({ corrida: corridaA });

        // A: borrada por completo (filas + marcas).
        expect(await prisma.usuario.findUnique({ where: { id: a.usuarioId } }), "Usuario de A debe estar borrado").toBeNull();
        expect(await prisma.tenant.findUnique({ where: { id: a.tenantId } }), "Tenant de A debe estar borrado").toBeNull();
        expect(await marcasDe(corridaA), "marcas de A limpiadas").toBe(0);

        // B: no basta que exista — su relación tiene que RECORRERSE intacta (usable, no colgada).
        // Caza de un golpe: over-reach (B borrada), daño por cascada (Tenant de B borrado) y
        // referencia colgada (Usuario de B apuntando a un Tenant muerto).
        const usuarioB = await prisma.usuario.findUnique({ where: { id: b.usuarioId }, include: { tenant: true } });
        expect(usuarioB, "Usuario de B debe seguir existiendo").not.toBeNull();
        expect(usuarioB?.tenant?.id, "Usuario de B debe seguir apuntando a un Tenant VIVO (relación usable)").toBe(b.tenantId);
        expect(await marcasDe(corridaB), "marcas de B intactas (Tenant + Usuario)").toBe(2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · ORDEN — derivado de pg_constraint, sin fixture. Caza una entidad LISTADA en la
//     posición equivocada y el self-FK que alguien cambie a Restrict.
// ─────────────────────────────────────────────────────────────────────────────
describe("SPEC-679 · orden de borrado derivado del catálogo (pg_constraint)", () => {
    it("toda FK RESTRICT/NO-ACTION entre entidades de ORDEN_BORRADO tiene la hija ANTES que el padre", async () => {
        const tablas = ORDEN_BORRADO.map(tablaDe);
        const pos = new Map(tablas.map((t, i) => [t, i]));
        const inList = tablas.map((t) => `'${t}'`).join(",");
        const filas = await prisma.$queryRawUnsafe<Array<{ conname: string; child: string; parent: string }>>(
            `SELECT con.conname, child.relname AS child, parent.relname AS parent
               FROM pg_constraint con
               JOIN pg_class child ON child.oid = con.conrelid
               JOIN pg_class parent ON parent.oid = con.confrelid
              WHERE con.contype = 'f' AND con.confdeltype IN ('r','a')
                AND child.relname IN (${inList}) AND parent.relname IN (${inList})`,
        );

        // Sanity: si da 0, la consulta o la BD están mal (debería haber FKs entre estas tablas).
        expect(filas.length, "debería haber FKs RESTRICT entre las tablas de ORDEN_BORRADO").toBeGreaterThan(0);

        // self-FK RESTRICT (child == parent): un deleteMany masivo no puede ordenarse dentro de la
        // tabla → hay que hacerla SetNull o nulear antes de borrar (como Expediente). Hoy ninguna.
        const selfFk = filas.filter((f) => f.child === f.parent).map((f) => `${f.child} (${f.conname})`);
        expect(selfFk, "self-FK RESTRICT en una tabla de ORDEN_BORRADO — hacela SetNull o nuleá antes de borrar").toEqual([]);

        // hija (child = referencia) antes que padre (parent = referenciado).
        const malOrden = filas
            .filter((f) => f.child !== f.parent)
            .filter((f) => (pos.get(f.child) ?? -1) >= (pos.get(f.parent) ?? -1))
            .map((f) => `${f.child}→${f.parent} (${f.conname})`);
        expect(malOrden, "FK RESTRICT con la hija DESPUÉS del padre en ORDEN_BORRADO: reordená (hoja antes que padre)").toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · PERTENENCIA — conducta-derivada: lo que los pobladores MARCAN lo limpia ALGUNA fase.
//     Barre los marcar()/marcarDemo() reales; no una lista a mano.
// ─────────────────────────────────────────────────────────────────────────────
describe("SPEC-679 · todo lo marcado lo limpia alguna fase de la purga", () => {
    // Entidades marcadas que NO están en ORDEN_BORRADO pero SÍ las limpia una fase derivada
    // (por reporteId / expedienteId / estudianteId). Declaradas + su fase, como SPEC-615.
    const CUBIERTO_POR_FASE_DERIVADA: Record<string, string> = {
        AlertaColegio: "fase1 (reporteId)",
        SolicitudComite: "fase1 (reporteId)",
        ClasificacionIA: "fase1 (reporteId)",
        TransicionReporte: "fase1 (reporteId)",
        AclaracionExpediente: "fase2bis (expedienteId)",
        InformeConsolidado: "fase2bis (expedienteId)",
        Expediente: "fase2bis",
        AcudienteEstudiante: "fase3 (estudianteId)",
        IdentificadorEstudiante: "fase3 (estudianteId)",
    };

    // Escaneo RECURSIVO de todo demo-prod (raíz + lib + subdirs), NO una lista de pobladores a
    // mano: una lista se queda corta EN SILENCIO — me pasó al escribir esto (faltaban
    // desbloqueo-calidad.ts y auditar.ts), y el candado habría dado falso verde sobre lo que
    // esos marcan. La regex sólo matchea una llamada con entidad literal, así que barrer helpers
    // sin llamadas no agrega ruido.
    const marcadas: Set<string> = (() => {
        const set = new Set<string>();
        const scan = (dir: string): void => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    scan(full);
                } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
                    const fuente = fs.readFileSync(full, "utf-8");
                    for (const m of fuente.matchAll(/marcar(?:Demo)?\(\s*(?:tx,\s*)?"([A-Za-z]+)"/g)) {
                        if (m[1]) set.add(m[1]);
                    }
                }
            }
        };
        scan(DEMO_PROD);
        return set;
    })();

    it("el scan encontró marcas (si da 0, el regex o los archivos cambiaron)", () => {
        expect(marcadas.size).toBeGreaterThan(10);
    });

    it("cada entidad marcada está en ORDEN_BORRADO o declarada cubierta por una fase derivada", () => {
        const cubierta = (e: string): boolean => ORDEN_BORRADO.includes(e) || e in CUBIERTO_POR_FASE_DERIVADA;
        const huerfanas = [...marcadas].filter((e) => !cubierta(e));
        expect(
            huerfanas,
            "entidad marcada que NINGUNA fase limpia: agregala a ORDEN_BORRADO (o límpiala en una fase derivada) y, si es derivada, declarala en CUBIERTO_POR_FASE_DERIVADA",
        ).toEqual([]);
    });

    it("CUBIERTO_POR_FASE_DERIVADA no declara entidades que ya nadie marca (mapa honesto)", () => {
        const obsoletas = Object.keys(CUBIERTO_POR_FASE_DERIVADA).filter((e) => !marcadas.has(e));
        expect(obsoletas, "entradas de CUBIERTO_POR_FASE_DERIVADA que ya no se marcan (quitalas)").toEqual([]);
    });
});
