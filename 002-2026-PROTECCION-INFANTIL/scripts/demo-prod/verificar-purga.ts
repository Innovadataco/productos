#!/usr/bin/env tsx
/**
 * Verifica conteos de entidades demo antes/después de la purga.
 * Uso:
 *   node --env-file=.env.test --import tsx scripts/demo-prod/verificar-purga.ts [--antes|--despues]
 */
import { prisma } from "./lib/prisma";

const modo = process.argv.includes("--despues") ? "DESPUÉS" : "ANTES";

const ENTIDADES = [
    "Tenant",
    "Colegio",
    "Curso",
    "Profesor",
    "Estudiante",
    "AcudienteEstudiante",
    "IdentificadorEstudiante",
    "Usuario",
    "PerfilOperador",
    "IntegranteComite",
    "ContactoConfianza",
    "IdentificadorContacto",
    "Reporte",
    "ClasificacionIA",
    "TransicionReporte",
    "AlertaColegio",
    "PatronInstitucional",
    "IdentificadorReportado",
    "EventoMatch",
    "SeguimientoCaso",
    "NotaSeguimiento",
    "RegistroAvisoColegio",
    "PreferenciaAlertaColegio",
    "AuditLog",
];

async function contarDemo(entidad: string): Promise<number> {
    return prisma.demoMarcado.count({ where: { entidad } });
}

async function contarTotal(entidad: string): Promise<number> {
    // @ts-expect-error — acceso dinámico a modelos contadores
    const model = prisma[entidad.charAt(0).toLowerCase() + entidad.slice(1)];
    if (!model || typeof model.count !== "function") {
        return -1;
    }
    return model.count();
}

async function main() {
    console.log(`=== VERIFICACIÓN ${modo} ===`);
    console.log("Entidad             | Demo | Total");
    console.log("-".repeat(45));
    let totalDemo = 0;
    for (const entidad of ENTIDADES) {
        const demo = await contarDemo(entidad);
        const total = await contarTotal(entidad);
        totalDemo += demo;
        console.log(`${entidad.padEnd(20)} | ${String(demo).padStart(4)} | ${total >= 0 ? total : "N/A"}`);
    }
    const totalMarcados = await prisma.demoMarcado.count();
    console.log("-".repeat(45));
    console.log(`Registros DemoMarcado: ${totalMarcados}`);
    console.log(`Suma de conteos demo:  ${totalDemo}`);
    if (modo === "DESPUÉS" && (totalMarcados > 0 || totalDemo > 0)) {
        console.error("\n[ERROR] Quedan entidades demo tras la purga.");
        process.exit(1);
    }
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
