import { prisma } from "../src/lib/prisma";
import { logAudit } from "../src/lib/audit";
import { CasoEvalFuente, RolUsuario } from "@prisma/client";

const CAMBIOS: { casoId: string; nuevaCategoria: string; motivo: string }[] = [
    {
        casoId: "cmrobzjvw009x1148xqb4oovn",
        nuevaCategoria: "EXTORSION",
        motivo: "Coerción explícita: amenaza con difundir rumores si no se envían fotos íntimas. Inconsistencia interna con casos EXTORSION análogos.",
    },
    {
        casoId: "cmrobzjvw00a311482euqnl0q",
        nuevaCategoria: "EXTORSION",
        motivo: "Amenaza con contar secretos para obtener imágenes. Inconsistencia interna con casos EXTORSION análogos.",
    },
    {
        casoId: "cmrobzjvw00b91148130faty3",
        nuevaCategoria: "EXTORSION",
        motivo: "Amenaza con lastimar a la mascota si no obedece. Todas las corridas predijeron EXTORSION.",
    },
    {
        casoId: "cmrobzjvw00ba114800zbwh31",
        nuevaCategoria: "DOXING",
        motivo: "Texto indica publicación de dirección personal. Inconsistencia interna: casos análogos etiquetados DOXING.",
    },
    {
        casoId: "cmrobzjvw00bf1148m22z3f4q",
        nuevaCategoria: "DOXING",
        motivo: "Publicación de dirección y ubicación en internet. Inconsistencia interna: casos análogos etiquetados DOXING.",
    },
];

const IP_ADDRESS = "script";
const USER_AGENT = "aplicar-curacion-fixture";

async function getAdminUser() {
    const admin = await prisma.usuario.findFirst({
        where: { rol: RolUsuario.ADMIN, estado: "activo" },
        orderBy: { creadoEn: "asc" },
    });
    if (!admin) {
        throw new Error("No se encontró un usuario ADMIN activo para auditar la curación.");
    }
    return admin;
}

async function main() {
    const admin = await getAdminUser();

    const maxRow = await prisma.casoEval.findFirst({ orderBy: { fixtureVersion: "desc" } });
    let nextVersion = (maxRow?.fixtureVersion ?? 0) + 1;

    const aplicados: {
        casoId: string;
        nuevoId: string;
        anterior: string;
        nueva: string;
        versionDisable: number;
        versionCreate: number;
    }[] = [];

    for (const cambio of CAMBIOS) {
        const resultado = await prisma.$transaction(async (tx) => {
            const viejo = await tx.casoEval.findUnique({ where: { id: cambio.casoId } });
            if (!viejo) {
                throw new Error(`Caso ${cambio.casoId} no encontrado`);
            }
            if (!viejo.activo) {
                throw new Error(`Caso ${cambio.casoId} ya está desactivado`);
            }

            const versionDisable = nextVersion++;
            const actualizado = await tx.casoEval.update({
                where: { id: viejo.id },
                data: { activo: false, fixtureVersion: versionDisable },
            });

            await logAudit({
                accion: "EVAL_CASE_DISABLE",
                tipoRecurso: "CasoEval",
                recursoId: viejo.id,
                usuarioId: admin.id,
                valorAnterior: JSON.stringify({
                    activo: true,
                    fixtureVersion: viejo.fixtureVersion,
                    categoriaEsperada: viejo.categoriaEsperada,
                    secundariaEsperada: viejo.secundariaEsperada,
                }),
                valorNuevo: JSON.stringify({ activo: false, fixtureVersion: versionDisable }),
                ipAddress: IP_ADDRESS,
                userAgent: USER_AGENT,
                tx,
            });

            const versionCreate = nextVersion++;
            const creado = await tx.casoEval.create({
                data: {
                    texto: viejo.texto,
                    categoriaEsperada: cambio.nuevaCategoria,
                    secundariaEsperada: viejo.secundariaEsperada,
                    ruido: viejo.ruido,
                    fuente: CasoEvalFuente.MANUAL_ADMIN,
                    activo: true,
                    fixtureVersion: versionCreate,
                    creadoPorId: admin.id,
                },
            });

            await logAudit({
                accion: "EVAL_CASE_CREATE",
                tipoRecurso: "CasoEval",
                recursoId: creado.id,
                usuarioId: admin.id,
                valorAnterior: JSON.stringify({
                    casoOrigenId: viejo.id,
                    categoriaEsperada: viejo.categoriaEsperada,
                    secundariaEsperada: viejo.secundariaEsperada,
                    ruido: viejo.ruido,
                }),
                valorNuevo: JSON.stringify({
                    categoriaEsperada: creado.categoriaEsperada,
                    secundariaEsperada: creado.secundariaEsperada,
                    ruido: creado.ruido,
                    fixtureVersion: versionCreate,
                    motivo: cambio.motivo,
                }),
                ipAddress: IP_ADDRESS,
                userAgent: USER_AGENT,
                tx,
            });

            return {
                casoId: viejo.id,
                nuevoId: creado.id,
                anterior: viejo.categoriaEsperada,
                nueva: creado.categoriaEsperada,
                versionDisable,
                versionCreate,
            };
        });

        aplicados.push(resultado);
        console.log(`Curado ${resultado.casoId} -> ${resultado.nuevoId}: ${resultado.anterior} -> ${resultado.nueva}`);
    }

    console.log("\nResumen de curación:");
    console.log(JSON.stringify(aplicados, null, 2));

    const finalMax = await prisma.casoEval.findFirst({ orderBy: { fixtureVersion: "desc" } });
    const activos = await prisma.casoEval.count({ where: { activo: true } });
    const inactivos = await prisma.casoEval.count({ where: { activo: false } });
    console.log(`\nEstado final BD: activos=${activos}, inactivos=${inactivos}, max fixtureVersion=${finalMax?.fixtureVersion}`);

    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
