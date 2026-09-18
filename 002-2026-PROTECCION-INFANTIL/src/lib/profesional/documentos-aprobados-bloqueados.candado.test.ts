/**
 * SPEC-707 · Candado de CONDUCTA (lo probó Jelkin, 17-09): con la solicitud DEVUELTA,
 * el profesional NO puede reemplazar un documento ya APROBADO — solo vuelve a subir el
 * DEVUELTO — y ve el MOTIVO del devuelto. El bloqueo va en el SERVIDOR.
 *
 * (a) reemplazar un aprobado (CUMPLE) con el perfil devuelto/en revisión → 409. El
 *     devuelto (NO_CUMPLE) sí se vuelve a subir. Control positivo por el otro lado: un
 *     ACTIVO SÍ sube versión nueva de un aprobado (renovación SPEC-693, no se toca).
 * (b) tras devolver con observación, `estadoDeDocumentos` trae esa observación EN el
 *     requisito devuelto (texto real) y marca el aprobado como bloqueado.
 *
 * Usa `decidir` real (crea la VerificacionProfesional MAS_INFORMACION y transiciona el
 * perfil): es conducta, no un checklist a mano.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { guardarDocumentoDeRequisito, estadoDeDocumentos } from "./documentos.service";
import { decidir } from "@/lib/profesionales/verificador/service";

vi.mock("@/lib/queue", () => ({ sendNotificacionEnvio: vi.fn(async () => undefined) }));

const PDF = Buffer.concat([Buffer.from("%PDF-"), Buffer.from("\n1 0 obj\n<<>>\nendobj\n")]);
const REQUISITOS = [
    { clave: "tarjeta", nombre: "Tarjeta profesional", descripcion: "imagen o PDF" },
    { clave: "antecedentes", nombre: "Certificado de antecedentes", descripcion: "imagen o PDF" },
];
const MOTIVO = "El certificado está vencido. Suba uno con fecha de este mes.";

async function sembrarRequisitos() {
    await prisma.parametroSistema.upsert({
        where: { clave: "verificacion.requisitos" },
        update: { valor: JSON.stringify(REQUISITOS) },
        create: {
            clave: "verificacion.requisitos", valor: JSON.stringify(REQUISITOS),
            tipo: "JSON", categoria: "SYSTEM", esPublico: false, descripcion: "Requisitos (test)",
        },
    });
}

/** SPEC-418: `decidir` encola el aviso DENTRO de la transacción y es fail-loud sin regla activa. */
async function sembrarReglasVerificacion() {
    for (const evento of ["profesional.verificacion.aprobada", "profesional.verificacion.devuelta"]) {
        const plantillaClave = `${evento}.email`;
        await prisma.notificacionPlantilla.upsert({
            where: { clave: plantillaClave },
            update: {},
            create: { clave: plantillaClave, canal: "EMAIL", asunto: "x", cuerpoMarkdown: "{{nombreProfesional}}", activa: true },
        });
        await prisma.notificacionRegla.upsert({
            where: { evento_canal_plantillaClave_rol: { evento, canal: "EMAIL", plantillaClave, rol: "PROFESIONAL" } },
            update: {},
            create: { evento, rol: "PROFESIONAL", canal: "EMAIL", offset: "+0m", plantillaClave, obligatoria: true, activa: true },
        });
    }
}

async function sembrarProfesionalConDocs(sufijo: string) {
    const pais = await prisma.pais.upsert({ where: { codigo: "CO" }, update: {}, create: { codigo: "CO", nombre: "Colombia" } });
    const ciudad =
        (await prisma.ciudad.findFirst({ where: { paisId: pais.id } })) ??
        (await prisma.ciudad.create({ data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id } }));
    const usuario = await crearUsuario("PROFESIONAL", `psi.${sufijo}.${Date.now()}.${Math.random()}@ejemplo.local`);
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id, nombreVisible: `Prof ${sufijo}`, tituloProfesional: "Psicología",
            especialidades: ["infantil"], ciudadId: ciudad.id, aniosExperiencia: 5, presentacion: "P.",
            tarifaConsultaCOP: 180000, duracionMinutos: 45, atiendeVirtual: true, estado: "EN_REVISION",
            autorizacionArchivoId: "archivo-de-prueba", autorizacionSubidaEn: new Date(),
        },
    });
    // SPEC-686: `decidir` exige la aceptación previa de la autorización.
    await prisma.aceptacionAutorizacionProfesional.create({
        data: { usuarioId: usuario.id, version: "v0.1", documentoHash: "h", ip: "1.1.1.1", aceptadoEn: new Date(Date.now() - 3_600_000) },
    });
    const admin = await crearUsuario("ADMIN", `verif.${sufijo}.${Date.now()}.${Math.random()}@ejemplo.local`);
    await guardarDocumentoDeRequisito(perfil.id, "tarjeta", PDF);
    await guardarDocumentoDeRequisito(perfil.id, "antecedentes", PDF);
    return { usuario, perfil, verificador: { id: admin.id, email: admin.email } };
}

describe("SPEC-707 · docs aprobados se bloquean con la solicitud devuelta; el devuelto muestra su motivo", () => {
    beforeEach(async () => {
        await resetDatabase();
        process.env.AUTORIZACIONES_PROFESIONALES_STORAGE_DIR = path.join(
            process.cwd(), "storage", `test-707-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        );
        await sembrarRequisitos();
        await sembrarReglasVerificacion();
    });
    afterAll(async () => prisma.$disconnect());

    it("(a) con la solicitud DEVUELTA: reemplazar el aprobado → 409; el devuelto SÍ se vuelve a subir", async () => {
        const { perfil, verificador } = await sembrarProfesionalConDocs("dev");
        // Devolución real: tarjeta CUMPLE (aprobado), antecedentes NO_CUMPLE con motivo → MAS_INFORMACION.
        await decidir(perfil.id, verificador, {
            checklist: {
                tarjeta: { estado: "CUMPLE", observacion: "" },
                antecedentes: { estado: "NO_CUMPLE", observacion: MOTIVO },
            },
        });

        // El APROBADO no se puede reemplazar (bloqueo del servidor).
        await expect(guardarDocumentoDeRequisito(perfil.id, "tarjeta", PDF)).rejects.toMatchObject({ statusCode: 409 });
        // El DEVUELTO sí se vuelve a subir.
        await expect(guardarDocumentoDeRequisito(perfil.id, "antecedentes", PDF)).resolves.toBeDefined();
    });

    it("(a·en revisión) reenviada la solicitud (EN_REVISION), el aprobado SIGUE bloqueado — radicado: «devuelta o en revisión»", async () => {
        const { perfil, verificador } = await sembrarProfesionalConDocs("rev");
        // Devolución real: tarjeta CUMPLE (aprobado), antecedentes NO_CUMPLE → MAS_INFORMACION → BORRADOR.
        await decidir(perfil.id, verificador, {
            checklist: {
                tarjeta: { estado: "CUMPLE", observacion: "" },
                antecedentes: { estado: "NO_CUMPLE", observacion: MOTIVO },
            },
        });
        // El profesional corrige el devuelto y REENVÍA. La transición es la misma que hace
        // `reenviarParaVerificacion` (vista-profesional.ts:125 · `cambiarEstadoPerfil(EN_REVISION)`);
        // la última verificación sigue siendo la MAS_INFORMACION que marcó `tarjeta` CUMPLE. No se
        // usa `reenviarParaVerificacion` para no acoplar este candado a la config de aceptación (SPEC-686).
        await guardarDocumentoDeRequisito(perfil.id, "antecedentes", PDF);
        await prisma.perfilProfesional.update({ where: { id: perfil.id }, data: { estado: "EN_REVISION" } });

        // El aprobado NO se puede reemplazar mientras la solicitud está EN REVISIÓN (no solo devuelta).
        await expect(guardarDocumentoDeRequisito(perfil.id, "tarjeta", PDF)).rejects.toMatchObject({ statusCode: 409 });
    });

    it("(a·control positivo) un ACTIVO SÍ sube versión nueva de un aprobado (renovación SPEC-693)", async () => {
        const { perfil, verificador } = await sembrarProfesionalConDocs("act");
        // Aprobación total → APROBADO → perfil ACTIVO.
        await decidir(perfil.id, verificador, {
            checklist: {
                tarjeta: { estado: "CUMPLE", observacion: "" },
                antecedentes: { estado: "CUMPLE", observacion: "" },
            },
        });
        const activo = await prisma.perfilProfesional.findUniqueOrThrow({ where: { id: perfil.id } });
        expect(activo.estado).toBe("ACTIVO");
        // El bloqueo NO aplica al ACTIVO: puede renovar el aprobado.
        await expect(guardarDocumentoDeRequisito(perfil.id, "tarjeta", PDF)).resolves.toBeDefined();
    });

    it("(b) tras la devolución, estadoDeDocumentos trae el MOTIVO real del devuelto y bloquea el aprobado", async () => {
        const { perfil, verificador } = await sembrarProfesionalConDocs("obs");
        await decidir(perfil.id, verificador, {
            checklist: {
                tarjeta: { estado: "CUMPLE", observacion: "" },
                antecedentes: { estado: "NO_CUMPLE", observacion: MOTIVO },
            },
        });

        const docs = await estadoDeDocumentos(perfil.id);
        const tarjeta = docs.find((d) => d.clave === "tarjeta")!;
        const antecedentes = docs.find((d) => d.clave === "antecedentes")!;

        expect(antecedentes.observacion, "el profesional ve el motivo real del documento devuelto").toBe(MOTIVO);
        expect(antecedentes.bloqueado, "el devuelto se puede volver a subir").toBe(false);
        expect(tarjeta.bloqueado, "el aprobado queda bloqueado").toBe(true);
        expect(tarjeta.observacion, "el aprobado no lleva motivo de devolución").toBeNull();
        // La FORMA (Diseño FORMA-SPEC707): la insignia sale de la misma lectura, no de un flag suelto.
        expect(antecedentes.revision, "el devuelto lleva la insignia «Devuelto»").toBe("devuelto");
        expect(tarjeta.revision, "el aprobado lleva la insignia «Aprobado»").toBe("aprobado");
    });
});
