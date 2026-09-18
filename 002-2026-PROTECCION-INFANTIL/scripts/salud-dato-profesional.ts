/**
 * SONDA de SALUD del dato del profesional (SOLO LECTURA) · antes de la prueba de Jelkin.
 *
 * NO escribe nada: solo `count`/`findMany`/`groupBy`/`$queryRaw SELECT`. Corre en prod sin
 * riesgo. Si algo hay que corregir, va en un corrector aparte con dry-run (lo decide el CEO).
 *
 * Uso: node --import tsx scripts/salud-dato-profesional.ts
 */
import { prisma } from "../src/lib/prisma";

function titulo(n: number, t: string): void {
    console.log(`\n──────── ${n}. ${t} ────────`);
}

async function esDemo(perfilIds: string[]): Promise<Set<string>> {
    if (perfilIds.length === 0) return new Set();
    const marcas = await prisma.demoMarcado.findMany({
        where: { entidad: "PerfilProfesional", entidadId: { in: perfilIds } },
        select: { entidadId: true },
    });
    return new Set(marcas.map((m) => m.entidadId));
}

async function main() {
    console.log("SONDA salud del dato del profesional (SOLO LECTURA) —", new Date().toISOString());

    // 1 · Tarifa nula o 0, por estado. (null = «por fijar» es LEGÍTIMO desde SPEC-685; 0 NO debería existir.)
    titulo(1, "Perfiles con tarifa NULL o 0, por estado");
    const tarifaNulaCero = await prisma.perfilProfesional.groupBy({
        by: ["estado"],
        where: { OR: [{ tarifaConsultaCOP: null }, { tarifaConsultaCOP: 0 }] },
        _count: { _all: true },
    });
    console.table(tarifaNulaCero.map((r) => ({ estado: r.estado, perfiles: r._count._all })));
    const cero = await prisma.perfilProfesional.count({ where: { tarifaConsultaCOP: 0 } });
    console.log(`  tarifa = 0 (centinela prohibido, debería ser 0 filas): ${cero}`);

    // 2 · ACTIVO sin verificación VIGENTE (APROBADO con venceEn futuro).
    titulo(2, "Perfiles ACTIVO sin verificación vigente (APROBADO · venceEn > now)");
    const activos = await prisma.perfilProfesional.findMany({
        where: { estado: "ACTIVO" },
        select: { id: true, nombreVisible: true, verificaciones: { where: { resultado: "APROBADO", venceEn: { gt: new Date() } }, select: { id: true }, take: 1 } },
    });
    const activosSinVig = activos.filter((p) => p.verificaciones.length === 0);
    const demoAct = await esDemo(activosSinVig.map((p) => p.id));
    console.log(`  ACTIVO total: ${activos.length} · sin verificación vigente: ${activosSinVig.length}`);
    console.table(activosSinVig.map((p) => ({ id: p.id, nombre: p.nombreVisible, demo: demoAct.has(p.id) })));

    // 3 · Documentos del requisito RETIRADO «otro», por estado (SPEC-700 lo dio de baja).
    titulo(3, "Documentos con requisito «otro» (retirado), por estado");
    const docsOtro = await prisma.documentoProfesional.groupBy({
        by: ["estado"],
        where: { requisitoClave: "otro" },
        _count: { _all: true },
    });
    console.table(docsOtro.map((r) => ({ estado: r.estado, documentos: r._count._all })));

    // 4 · Perfiles sin profesión / áreas / edades — con cuáles y si son demo.
    titulo(4, "Perfiles sin profesión / áreas / rango etario (columnas de catálogo vacías)");
    const sinCatalogo = await prisma.perfilProfesional.findMany({
        where: { OR: [{ profesion: null }, { areasAtencion: { isEmpty: true } }, { rangoEtario: { isEmpty: true } }] },
        select: { id: true, nombreVisible: true, estado: true, profesion: true, areasAtencion: true, rangoEtario: true, usuario: { select: { email: true } } },
    });
    const demoCat = await esDemo(sinCatalogo.map((p) => p.id));
    console.log(`  total: ${sinCatalogo.length} (el CEO espera ~2 cuentas de prueba SIN marca demo)`);
    console.table(
        sinCatalogo.map((p) => ({
            email: p.usuario.email,
            estado: p.estado,
            sinProf: p.profesion === null,
            sinAreas: p.areasAtencion.length === 0,
            sinRango: p.rangoEtario.length === 0,
            demo: demoCat.has(p.id),
        })),
    );

    // 5 · Franjas libres futuras que terminan DESPUÉS del vencimiento de la verificación vigente.
    titulo(5, "Franjas (libres, futuras) que terminan tras el vencimiento de la verificación");
    const franjasPostVenc = await prisma.$queryRaw<Array<{ profesionalId: string; franjas: bigint; ultima_fin: Date; vence: Date }>>`
        SELECT f."profesionalId",
               count(*)                 AS franjas,
               max(f.fin)               AS ultima_fin,
               v.vence
        FROM "FranjaDisponible" f
        JOIN (
            SELECT "perfilProfesionalId", max("venceEn") AS vence
            FROM "VerificacionProfesional"
            WHERE resultado = 'APROBADO'
            GROUP BY "perfilProfesionalId"
        ) v ON v."perfilProfesionalId" = f."profesionalId"
        WHERE f.tomada = false AND f.fin > now() AND f.fin > v.vence
        GROUP BY f."profesionalId", v.vence
        ORDER BY franjas DESC
        LIMIT 50`;
    console.log(`  profesionales con franjas libres futuras más allá de su vigencia: ${franjasPostVenc.length}`);
    console.table(
        franjasPostVenc.map((r) => ({ profesionalId: r.profesionalId, franjas: Number(r.franjas), ultima_fin: r.ultima_fin.toISOString().slice(0, 10), vence: r.vence.toISOString().slice(0, 10) })),
    );

    // 6 · Solicitudes de cita con monto 0 (cita «gratis»), por estado.
    titulo(6, "Solicitudes de cita con monto 0 (montoConsulta o montoTotal = 0), por estado");
    const citas0 = await prisma.solicitudCita.groupBy({
        by: ["estado"],
        where: { OR: [{ montoConsulta: 0 }, { montoTotal: 0 }] },
        _count: { _all: true },
    });
    console.table(citas0.map((r) => ({ estado: r.estado, solicitudes: r._count._all })));

    console.log("\n[sonda] FIN — solo lectura, no se escribió nada.");
}

main()
    .catch((e) => {
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
