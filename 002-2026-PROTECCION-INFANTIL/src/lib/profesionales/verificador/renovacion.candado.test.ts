/**
 * SPEC-693 (I-416) · CANDADOS de la renovación de documentos versionados.
 *
 * Cuatro propiedades, cada una contra la BD real (los índices parciales y las FKs solo
 * existen tras `migrate deploy`; vive en `src/**` para que CI lo corra —
 * dev-candado-integracion-src-y-seed-no-se-trunca):
 *
 *   1. INTEGRIDAD — subir una versión nueva NO altera los bytes que respaldan la
 *      verificación vigente. Control positivo encajado: con el `upsert` de ayer habría
 *      UNA sola fila y su `sha256` cambiaría; acá exigimos DOS filas y el vigente intacto.
 *   2. HABILITACIÓN (conducta) — con un requisito en revisión el profesional sigue
 *      habilitado; con la vigencia vencida NO, aunque haya subido un documento nuevo.
 *   3. RENOVACIÓN aprobar — promueve la nueva a VIGENTE (la anterior a SUPERSEDIDA),
 *      deja constancia en `RevisionRenovacion` y NUNCA mueve `venceEn` ni el estado del
 *      perfil. Control positivo: cuando SÍ entra una verificación nueva, `venceEn` se mueve.
 *   4. RENOVACIÓN devolver — exige observación (mismo candado que `decidir`), marca la
 *      nueva DEVUELTA y deja respaldando la anterior; el estado del perfil no cambia.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { revisarRenovacion, abrirDocumentoNuevo } from "./renovacion";
import { listarRenovaciones } from "./service";
import { estaHabilitado } from "@/lib/profesionales/vigencia";
import { DocumentoProfesionalRepository } from "@/lib/dal/repositories/documento-profesional";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";

const REQUISITOS = [{ clave: "tarjeta", nombre: "Tarjeta profesional", descripcion: "" }];
const DIA = 86_400_000;

async function sembrarRequisitos() {
    await prisma.parametroSistema.create({
        data: {
            clave: "verificacion.requisitos",
            valor: JSON.stringify(REQUISITOS),
            tipo: "JSON",
            categoria: "SYSTEM",
            esPublico: false,
            descripcion: "Requisitos que revisa el Verificador (test)",
        },
    });
}

/**
 * Perfil ACTIVO con una verificación APROBADA (venceEn a `venceEnDias` de hoy), su
 * documento VIGENTE del requisito `tarjeta` y la fila de unión que fija los bytes
 * revisados. Es el estado del que parte una renovación.
 */
async function sembrarPerfilActivo(venceEnDias: number) {
    const pais = await prisma.pais.upsert({
        where: { codigo: "CO" },
        update: {},
        create: { codigo: "CO", nombre: "Colombia" },
    });
    const ciudad =
        (await prisma.ciudad.findFirst({ where: { paisId: pais.id } })) ??
        (await prisma.ciudad.create({
            data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id },
        }));
    const profesional = await crearUsuario("PROFESIONAL", `profe.${Date.now()}.${Math.random()}@ejemplo.local`);
    const admin = await crearUsuario("ADMIN", `verif.${Date.now()}.${Math.random()}@ejemplo.local`);
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: profesional.id,
            nombreVisible: "Profesional de Prueba",
            tituloProfesional: "Psicología",
            especialidades: ["infantil"],
            ciudadId: ciudad.id,
            aniosExperiencia: 5,
            presentacion: "Presentación de prueba.",
            tarifaConsultaCOP: 100000,
            duracionMinutos: 45,
            atiendeVirtual: true,
            estado: "ACTIVO",
            autorizacionArchivoId: "/archivos/autorizacion-prueba.pdf",
            autorizacionSubidaEn: new Date(),
        },
    });
    const revisadoEn = new Date(Date.now() - 30 * DIA);
    const verificacion = await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: perfil.id,
            revisadoPorId: admin.id,
            revisadoEn,
            checklist: {},
            resultado: "APROBADO",
            autorizacionArchivoId: "/archivos/autorizacion-prueba.pdf",
            venceEn: new Date(Date.now() + venceEnDias * DIA),
        },
    });
    const docVigente = await prisma.documentoProfesional.create({
        data: {
            perfilProfesionalId: perfil.id,
            requisitoClave: "tarjeta",
            archivoId: "archivo-vigente",
            extension: "pdf",
            sha256: "sha-vigente",
            estado: "VIGENTE",
        },
    });
    await prisma.verificacionDocumento.create({
        data: { verificacionId: verificacion.id, documentoProfesionalId: docVigente.id },
    });
    return { perfil, profesional, admin, verificacion, docVigente };
}

/** Sube una versión nueva del requisito por el camino real del repositorio (EN_REVISION). */
function subirVersionNueva(perfilId: string, sha256: string) {
    return new DocumentoProfesionalRepository().guardar({
        perfilProfesionalId: perfilId,
        requisitoClave: "tarjeta",
        archivoId: `archivo-${sha256}`,
        extension: "pdf",
        sha256,
    });
}

describe("SPEC-693 · integridad: la versión nueva no toca los bytes vigentes", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarRequisitos();
    });
    afterAll(async () => prisma.$disconnect());

    it("subir un documento nuevo deja el VIGENTE intacto (id + sha256) y crea una fila EN_REVISION aparte", async () => {
        const { perfil, docVigente, verificacion } = await sembrarPerfilActivo(60);

        await subirVersionNueva(perfil.id, "sha-nueva");

        // Control positivo del `upsert` de ayer: habría UNA fila con el sha pisado.
        // Con versionado son DOS: el vigente intacto + la nueva en revisión.
        const filas = await prisma.documentoProfesional.findMany({
            where: { perfilProfesionalId: perfil.id, requisitoClave: "tarjeta" },
        });
        expect(filas).toHaveLength(2);

        const vigente = filas.find((d) => d.estado === "VIGENTE");
        const pendiente = filas.find((d) => d.estado === "EN_REVISION");
        expect(vigente?.id, "el vigente es la MISMA fila de antes").toBe(docVigente.id);
        expect(vigente?.sha256, "sus bytes no cambiaron").toBe("sha-vigente");
        expect(pendiente?.sha256, "la versión nueva es otra fila").toBe("sha-nueva");

        // La verificación sigue apuntando a los bytes que revisó, no a los nuevos.
        const revisados = await prisma.verificacionDocumento.findMany({
            where: { verificacionId: verificacion.id },
        });
        expect(revisados).toHaveLength(1);
        expect(revisados[0].documentoProfesionalId).toBe(docVigente.id);
    });
});

describe("SPEC-693 · conducta: la habilitación la decide la vigencia, no el documento nuevo", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarRequisitos();
    });
    afterAll(async () => prisma.$disconnect());

    async function habilitado(perfilId: string): Promise<boolean> {
        const perfil = await prisma.perfilProfesional.findUniqueOrThrow({ where: { id: perfilId } });
        const verificaciones = await prisma.verificacionProfesional.findMany({
            where: { perfilProfesionalId: perfilId },
        });
        return estaHabilitado(perfil, verificaciones, new Date());
    }

    it("ACTIVO + vigencia vigente + documento nuevo en revisión → SIGUE habilitado", async () => {
        const { perfil } = await sembrarPerfilActivo(60);
        await subirVersionNueva(perfil.id, "sha-nueva");
        expect(await habilitado(perfil.id)).toBe(true);
    });

    it("vigencia VENCIDA + documento nuevo en revisión → NO habilitado (el doc nuevo no rehabilita)", async () => {
        const { perfil } = await sembrarPerfilActivo(-1); // venció ayer
        await subirVersionNueva(perfil.id, "sha-nueva");
        expect(await habilitado(perfil.id)).toBe(false);
    });
});

describe("SPEC-693 · renovar aprobando: promueve, deja constancia y NO mueve la vigencia", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarRequisitos();
    });
    afterAll(async () => prisma.$disconnect());

    it("aprobar: nueva→VIGENTE, anterior→SUPERSEDIDA, RevisionRenovacion(APROBADO), venceEn y estado intactos", async () => {
        const { perfil, admin, docVigente } = await sembrarPerfilActivo(60);
        const pendiente = await subirVersionNueva(perfil.id, "sha-nueva");

        const repoPerfil = new PerfilProfesionalRepository();
        const venceAntes = await repoPerfil.venceEnVigente(perfil.id);
        const verifsAntes = await prisma.verificacionProfesional.count();

        await revisarRenovacion(perfil.id, { id: admin.id, email: "x@x" }, {
            requisitoClave: "tarjeta",
            decision: "APROBAR",
            observacion: "",
        });

        const anterior = await prisma.documentoProfesional.findUniqueOrThrow({ where: { id: docVigente.id } });
        const nueva = await prisma.documentoProfesional.findUniqueOrThrow({ where: { id: pendiente.id } });
        expect(anterior.estado, "la anterior queda de historial, no se pierde").toBe("SUPERSEDIDA");
        expect(nueva.estado, "la nueva ahora respalda").toBe("VIGENTE");

        const revisiones = await prisma.revisionRenovacion.findMany();
        expect(revisiones).toHaveLength(1);
        expect(revisiones[0].resultado).toBe("APROBADO");
        expect(revisiones[0].revisadoPorId).toBe(admin.id);
        expect(revisiones[0].documentoProfesionalId).toBe(nueva.id);

        // Los dos invariantes del CEO, medidos:
        const venceDespues = await repoPerfil.venceEnVigente(perfil.id);
        expect(venceDespues?.getTime(), "renovar NUNCA mueve la vigencia").toBe(venceAntes?.getTime());
        expect(await prisma.verificacionProfesional.count(), "no crea una verificación nueva").toBe(verifsAntes);
        const perfilDespues = await prisma.perfilProfesional.findUniqueOrThrow({ where: { id: perfil.id } });
        expect(perfilDespues.estado, "renovar NUNCA cambia el estado del perfil").toBe("ACTIVO");
    });

    it("control positivo: cuando SÍ entra una verificación aprobada nueva, `venceEnVigente` se mueve", async () => {
        // Sin esto, «venceEn no cambió» podría ser un falso verde (que nada lo mueva nunca).
        const { perfil, admin } = await sembrarPerfilActivo(60);
        const repoPerfil = new PerfilProfesionalRepository();
        const antes = await repoPerfil.venceEnVigente(perfil.id);
        await prisma.verificacionProfesional.create({
            data: {
                perfilProfesionalId: perfil.id,
                revisadoPorId: admin.id,
                revisadoEn: new Date(),
                checklist: {},
                resultado: "APROBADO",
                autorizacionArchivoId: "/x",
                venceEn: new Date(Date.now() + 120 * DIA),
            },
        });
        const despues = await repoPerfil.venceEnVigente(perfil.id);
        expect(despues!.getTime()).toBeGreaterThan(antes!.getTime());
    });
});

describe("SPEC-693 · renovar devolviendo: exige observación, deja respaldando la anterior", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarRequisitos();
    });
    afterAll(async () => prisma.$disconnect());

    it("devolver SIN observación → 400 y nada cambia (mismo candado que `decidir`)", async () => {
        const { perfil, admin, docVigente } = await sembrarPerfilActivo(60);
        const pendiente = await subirVersionNueva(perfil.id, "sha-nueva");

        await expect(
            revisarRenovacion(perfil.id, { id: admin.id, email: "x@x" }, {
                requisitoClave: "tarjeta",
                decision: "DEVOLVER",
                observacion: "   ",
            }),
        ).rejects.toMatchObject({ statusCode: 400 });

        expect((await prisma.documentoProfesional.findUniqueOrThrow({ where: { id: pendiente.id } })).estado).toBe(
            "EN_REVISION",
        );
        expect((await prisma.documentoProfesional.findUniqueOrThrow({ where: { id: docVigente.id } })).estado).toBe(
            "VIGENTE",
        );
        expect(await prisma.revisionRenovacion.count()).toBe(0);
    });

    it("devolver CON observación → nueva DEVUELTA, anterior sigue VIGENTE, RevisionRenovacion(DEVUELTA), perfil intacto", async () => {
        const { perfil, admin, docVigente } = await sembrarPerfilActivo(60);
        const pendiente = await subirVersionNueva(perfil.id, "sha-nueva");

        await revisarRenovacion(perfil.id, { id: admin.id, email: "x@x" }, {
            requisitoClave: "tarjeta",
            decision: "DEVOLVER",
            observacion: "La foto está borrosa, subila de nuevo.",
        });

        expect((await prisma.documentoProfesional.findUniqueOrThrow({ where: { id: pendiente.id } })).estado).toBe(
            "DEVUELTA",
        );
        expect((await prisma.documentoProfesional.findUniqueOrThrow({ where: { id: docVigente.id } })).estado).toBe(
            "VIGENTE",
        );
        const revisiones = await prisma.revisionRenovacion.findMany();
        expect(revisiones).toHaveLength(1);
        expect(revisiones[0].resultado).toBe("DEVUELTA");
        expect(revisiones[0].observacion).toContain("borrosa");
        expect((await prisma.perfilProfesional.findUniqueOrThrow({ where: { id: perfil.id } })).estado).toBe("ACTIVO");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Feeds de las pantallas contra la BD real: la cola «Documentos nuevos» y la
// comparación. Si el dato no fluye, la pantalla queda con un cajón sin lector.
// ─────────────────────────────────────────────────────────────────────────────
describe("SPEC-693 · la cola «Documentos nuevos» solo lista ACTIVOS con versión pendiente", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarRequisitos();
    });
    afterAll(async () => prisma.$disconnect());

    it("un ACTIVO con documento nuevo aparece, con el requisito y venceEn; sin pendiente no aparece", async () => {
        const conNuevo = await sembrarPerfilActivo(60);
        await subirVersionNueva(conNuevo.perfil.id, "sha-nueva");
        const sinNuevo = await sembrarPerfilActivo(60); // solo vigente, sin pendiente

        const filas = await listarRenovaciones();
        const fila = filas.find((f) => f.profesionalId === conNuevo.perfil.id);
        expect(fila, "el ACTIVO con documento nuevo debe aparecer").toBeTruthy();
        expect(fila!.tituloProfesional).toBe("Psicología");
        expect(fila!.venceEn).not.toBeNull();
        expect(fila!.requisitos.map((r) => r.clave)).toContain("tarjeta");
        expect(fila!.requisitos[0].nombre).toBe("Tarjeta profesional"); // del parámetro
        expect(fila!.requisitos[0].vigente, "trae el vigente para comparar").not.toBeNull();

        expect(filas.find((f) => f.profesionalId === sinNuevo.perfil.id), "sin pendiente NO se lista").toBeUndefined();
    });
});

describe("SPEC-693 · abrirDocumentoNuevo alimenta la pantalla de comparar", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarRequisitos();
    });
    afterAll(async () => prisma.$disconnect());

    it("devuelve vigente + nuevo + venceEn; y lanza si ya no hay pendiente", async () => {
        const { perfil } = await sembrarPerfilActivo(60);
        await subirVersionNueva(perfil.id, "sha-nueva");

        const comp = await abrirDocumentoNuevo(perfil.id, "tarjeta");
        expect(comp.requisitoNombre).toBe("Tarjeta profesional");
        expect(comp.venceEn).not.toBeNull();
        expect(comp.vigente.subidoEn).toBeTruthy();
        expect(comp.nuevo.subidoEn).toBeTruthy();

        // Sin versión pendiente (otro requisito), la pantalla no abre: lanza para que diga «volver».
        await expect(abrirDocumentoNuevo(perfil.id, "tarjeta_inexistente")).rejects.toBeTruthy();
    });
});
