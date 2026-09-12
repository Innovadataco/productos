/**
 * SPEC-412/v5 · TAPA-HUECO: sembrar el consentimiento de los usuarios demo5.
 *
 * El poblador v5 creó rectores (SCHOOL_ADMIN) y comité (COMITE_CONVIVENCIA) SIN
 * consentimiento → `/dashboard/colegio` rebota a `/consentimiento` y bloquea el
 * recorrido del colegio, SPEC-670 y el semáforo del comité. Este script lo cierra
 * por el CARRIL DEL POBLADOR, no a mano.
 *
 * MARCADO ≠ FORJADO (regla del CEO y de Calidad `calidad-audit-consentimientos-nunca-forjar`):
 * un INSERT suelto de consentimiento sería un registro de cumplimiento indistinguible de
 * uno real. Acá cada `AuditConsentimiento` sembrado se ETIQUETA en `demo_marcado` (corrida
 * v5), como todo lo demás que sembró el poblador — un registro sembrado y declarado como
 * tal, no una aceptación humana falsa. El `ip` es un marcador visible («demo5-seed»).
 *
 * DOS SALVAGUARDAS DURAS:
 *  1. SOLO toca usuarios YA marcados demo_marcado (entidad="Usuario", corrida v5). Un
 *     usuario real NUNCA entra al barrido — la query lo excluye por construcción.
 *  2. NO dispara la notificación. La aceptación real (`ConsentimientoService.aceptar`)
 *     programa un aviso `consentimiento.aceptado`; sembrar 50+ dispararía 50+ correos sobre
 *     un proveedor ya sobre-cupo (I-402: sembrar datos NO es silencioso). Este script
 *     escribe SOLO las filas (Usuario + AuditConsentimiento + demo_marcado).
 *
 * Espeja la escritura de `aceptar()` campo por campo (versión vigente, hash del documento
 * por rol, AuditConsentimiento, 4 campos de Usuario) para que el consentimiento sembrado
 * sea ESTRUCTURALMENTE idéntico a uno real — solo etiquetado.
 *
 * Uso (lo corre el CEO en el VPS; Datos no escribe prod a mano):
 *   node --import tsx scripts/demo/sembrar-consentimiento-demo5.ts --dry-run   # inspeccionar
 *   node --import tsx scripts/demo/sembrar-consentimiento-demo5.ts             # sembrar
 *
 * Idempotente: salta a quien ya tiene la versión vigente. Re-correr no duplica.
 */
import { PrismaClient } from "@prisma/client";
import { ConsentimientoService } from "../../src/lib/dal/services/consentimiento";
import { CORRIDA_V5 } from "./_marcado";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const IP_SEMBRADO = "demo5-seed"; // marcador visible, no una IP real
const USER_AGENT_SEMBRADO = "poblar-demo-v5:consentimiento";

async function main() {
    const servicio = new ConsentimientoService();
    const versionActual = await servicio.versionVigente(); // lanza si el parámetro no está

    // SALVAGUARDA 1: solo usuarios marcados demo_marcado (corrida v5) que NO tienen la
    // versión vigente. Un real no está en demo_marcado → no entra jamás.
    const marcados = await prisma.demoMarcado.findMany({
        where: { entidad: "Usuario" },
        select: { entidadId: true, metadata: true },
    });
    const idsV5 = marcados
        .filter((m) => (m.metadata as { corrida?: string } | null)?.corrida === CORRIDA_V5)
        .map((m) => m.entidadId);

    const usuarios = await prisma.usuario.findMany({
        where: {
            id: { in: idsV5 },
            OR: [{ consentimientoVersion: null }, { consentimientoVersion: { not: versionActual } }],
        },
        select: { id: true, rol: true, email: true },
    });

    console.log(`[consent-demo5] versión vigente: ${versionActual}`);
    console.log(`[consent-demo5] usuarios v5 sin consentimiento vigente: ${usuarios.length}${DRY_RUN ? "  (DRY-RUN, no escribe)" : ""}`);

    // Cache de hash por documentoTipo (solo 2 tipos: CONVENIO_INSTITUCIONAL / POLITICA_DATOS).
    const hashPorTipo = new Map<string, string>();
    const hashDe = async (tipo: string) => {
        if (!hashPorTipo.has(tipo)) {
            const doc = await servicio.obtenerDocumentoVigente(tipo as never);
            hashPorTipo.set(tipo, servicio.calcularHash(doc));
        }
        return hashPorTipo.get(tipo)!;
    };

    let sembrados = 0;
    for (const u of usuarios) {
        const documentoTipo = servicio.documentoPorRol(u.rol);
        // El rector firma como representante legal del colegio (mismo criterio que el
        // modal del colegio, ModalConsentimiento). El comité/otros no.
        const esRepresentanteLegal = u.rol === "SCHOOL_ADMIN";

        if (DRY_RUN) {
            console.log(`  [dry] ${u.email} (${u.rol}) → doc=${documentoTipo} repLegal=${esRepresentanteLegal}`);
            continue;
        }

        const documentoHash = await hashDe(documentoTipo); // lee el doc legal — solo en el camino real
        const aceptadoEn = new Date();

        await prisma.$transaction(async (tx) => {
            const audit = await tx.auditConsentimiento.create({
                data: {
                    usuarioId: u.id,
                    version: versionActual,
                    documentoTipo,
                    documentoHash,
                    aceptadoEn,
                    ip: IP_SEMBRADO,
                    userAgent: USER_AGENT_SEMBRADO,
                    esRepresentanteLegal,
                },
                select: { id: true },
            });
            await tx.usuario.update({
                where: { id: u.id },
                data: {
                    consentimientoAceptadoEn: aceptadoEn,
                    consentimientoVersion: versionActual,
                    consentimientoDocumentoHash: documentoHash,
                    consentimientoIP: IP_SEMBRADO,
                },
            });
            // MARCA el registro de cumplimiento como sembrado (idempotente por @@unique).
            await tx.demoMarcado.upsert({
                where: { entidad_entidadId: { entidad: "AuditConsentimiento", entidadId: audit.id } },
                create: {
                    entidad: "AuditConsentimiento",
                    entidadId: audit.id,
                    metadata: { corrida: CORRIDA_V5, script: "sembrar-consentimiento-demo5", notas: "consentimiento SEMBRADO, no aceptación humana real" },
                },
                update: {},
            });
        });
        sembrados++;
    }

    console.log(`[consent-demo5] ${DRY_RUN ? "would seed" : "sembrados"}: ${DRY_RUN ? usuarios.length : sembrados}`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error("[consent-demo5] FALLO:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
});
