/**
 * SPEC-615 (I-374) · Candado de CLASE derivado del CATÁLOGO: ninguna FK RESTRICT/NO-ACTION hacia el
 * núcleo purgable (Expediente/Reporte/ContenidoReporte) queda sin que la purga la contemple.
 *
 * El orden de borrado de la purga total se venía manteniendo A MANO y se descubría incompleto UNA
 * constraint por incidente, siempre en producción con el borrado a medias (I-374 = la tercera:
 * InformePadre). Este candado NO mantiene otra lista a mano: lee `pg_constraint` (las FKs REALES tras
 * migrate deploy) y exige que cada FK RESTRICT hacia el núcleo esté declarada como cubierta. Si el
 * esquema gana una FK nueva hacia esas tablas y nadie la borra + la declara → ROJO en CI, no una
 * cuarta rotura silenciosa en la próxima ventana. «Que muera la clase, no el caso» (CEO).
 *
 * Integración (usa la BD): el catálogo sólo tiene las constraints tras `migrate deploy`; un unit no
 * ve un orden de FK. El ensayo sobre clon con datos reales (carril del CEO) es el complemento.
 */
import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HIJAS_RESTRICT_EXPEDIENTE } from "../../scripts/limpieza/_borrar-expediente";
import { SEED_FK_REAPUNTAR, TABLAS_AGREGADO_PURGA } from "../../scripts/limpieza/reset-piloto";
import { PRESERVADOS } from "../../scripts/limpieza/_common";

// Núcleo que la purga total borra y que el CEO nombró. SPEC-905 suma las raíces del grafo del reset
// --purga-total: Colegio/Usuario/Suscripcion (CEO) + IdentificadorReportado (agregado) + el cluster
// profesional (PerfilProfesional). Ampliá acá si sumás otra raíz.
const PADRES_PURGABLES = [
    "Expediente", "Reporte", "ContenidoReporte",
    "Colegio", "Usuario", "Suscripcion", "IdentificadorReportado", "PerfilProfesional",
] as const;

/**
 * Cobertura DECLARADA por nombre de constraint (`conname`, estable y único), y DÓNDE la borra la
 * purga. Sumar una FK RESTRICT nueva a estas tablas OBLIGA a borrarla en la purga y a declararla
 * acá; si no, la aserción de abajo se pone roja. Verificado contra pg_constraint el 2026-09-10.
 */
const COBERTURA_FK: Record<string, string> = {
    // → Expediente · borrar-padre / borrar-colegio vía borrarSubarbolExpediente
    EventoExpediente_expedienteId_fkey: "borrarSubarbolExpediente",
    InformePadre_expedienteId_fkey: "borrarSubarbolExpediente", // la que faltaba (I-374)
    aclaracion_expediente_expedienteId_fkey: "borrarSubarbolExpediente",
    informes_consolidados_expedienteId_fkey: "borrarSubarbolExpediente",
    patrones_expediente_expedienteId_fkey: "borrarSubarbolExpediente",
    // → Reporte
    AlertaColegio_reporteId_fkey: "reset-piloto pre-borrado global",
    eventos_match_reporteNuevoId_fkey: "borrar-reporte",
    // → ContenidoReporte
    EventoExpediente_contenidoId_fkey: "borrarSubarbolExpediente (borra EventoExpediente antes)",
    Reporte_contenidoId_fkey: "borrar-reporte (Reporte antes que su ContenidoReporte)",

    // ───────── SPEC-905 · grafo FK del reset --purga-total ─────────
    // → Colegio · borrar-colegio (subárbol del tenant) + pre-borrado global (cross-tenant)
    AlertaColegio_colegioId_fkey: "reset-piloto pre-borrado global + borrar-colegio",
    Alumno_colegioId_fkey: "borrar-colegio (estudiante.deleteMany · modelo Estudiante→tabla Alumno)",
    Curso_colegioId_fkey: "borrar-colegio",
    CursoMateria_colegioId_fkey: "borrar-colegio",
    IdentificadorAcudiente_colegioId_fkey: "reset-piloto pre-borrado global + borrar-colegio",
    IdentificadorAlumno_colegioId_fkey: "borrar-colegio (identificadorEstudiante→tabla IdentificadorAlumno) + pre-borrado global",
    IdentificadorIntegranteComite_colegioId_fkey: "reset-piloto pre-borrado global (identificadorIntegranteComite) + cascade de IntegranteComite",
    IdentificadorProfesor_colegioId_fkey: "reset-piloto pre-borrado global + borrar-colegio",
    Materia_colegioId_fkey: "borrar-colegio",
    NotaSeguimiento_colegioId_fkey: "reset-piloto pre-borrado global (notaSeguimiento)",
    NotificacionInApp_colegioId_fkey: "borrar-colegio (notificacionInApp) + barridoPurgaTotal",
    OnboardingColegio_colegioId_fkey: "borrar-colegio",
    PreferenciaAlertaColegio_colegioId_fkey: "borrar-colegio",
    Profesor_colegioId_fkey: "borrar-colegio",
    RegistroAvisoColegio_colegioId_fkey: "borrar-colegio",
    SeguimientoCaso_colegioId_fkey: "reset-piloto pre-borrado global + borrar-colegio",
    patrones_institucionales_colegioId_fkey: "borrar-colegio (patronInstitucional)",
    // → Usuario · wipe final + rastro (borrar-padre/profesional) + barrido + cascade + re-apunte de seed
    AccesoDocumentoApelacion_usuarioId_fkey: "cascade de Apelacion→DocumentoApelacion (al borrar la apelación)",
    AlertaSuscripcion_usuarioId_fkey: "borrarRastroUsuario + barridoPurgaTotal",
    Apelacion_usuarioId_fkey: "borrarRastroUsuario + barridoPurgaTotal (apelacion.deleteMany)",
    BonoPromocional_creadoPorAdminId_fkey: "barridoPurgaTotal (bonoPromocional)",
    CodigoAccesoContenido_solicitadoPorId_fkey: "borrarRastroUsuario + barridoPurgaTotal",
    CorreccionAdmin_adminId_fkey: "cascade de Reporte→ClasificacionIA→CorreccionAdmin (borrar-reporte)",
    Expediente_padreUsuarioId_fkey: "borrar-padre/borrar-colegio (borrarSubarbolExpediente)",
    GuiaAccionCategoria_creadaPorAdminId_fkey: "SEED · re-apunte a soporte@ (SEED_FK_REAPUNTAR)",
    InformeCaso_firmadoPorId_fkey: "reset-piloto pre-borrado global (informeCaso) + borrar-colegio",
    InformePadre_generadoPorId_fkey: "borrarSubarbolExpediente (al borrar el expediente)",
    IntegranteComite_creadoPorId_fkey: "borrar-colegio + barridoPurgaTotal (integranteComite)",
    NotaSeguimiento_autorId_fkey: "reset-piloto pre-borrado global (notaSeguimiento)",
    NotificacionInApp_usuarioId_fkey: "borrarRastroUsuario + barridoPurgaTotal",
    PerfilOperador_creadoPorId_fkey: "barridoPurgaTotal (perfilOperador)",
    PerfilProfesional_usuarioId_fkey: "borrar-profesional + barridoPurgaTotal",
    Plan_creadoPorAdminId_fkey: "SEED · re-apunte a soporte@ (SEED_FK_REAPUNTAR)",
    RevisionRenovacion_revisadoPorId_fkey: "cascade de PerfilProfesional→DocumentoProfesional (borrar-profesional)",
    SolicitudCita_padreUsuarioId_fkey: "borrarRastroUsuario + barridoPurgaTotal",
    VerificacionProfesional_revisadoPorId_fkey: "borrar-profesional (por perfilProfesionalId) + barridoPurgaTotal",
    block_list_creadoPorId_fkey: "barridoPurgaTotal (blockList)",
    contactos_emergencia_padreUsuarioId_fkey: "borrarRastroUsuario + barridoPurgaTotal",
    digest_semanal_destinatarioId_fkey: "borrarRastroUsuario + barridoPurgaTotal",
    regla_recomendacion_historial_cambiadoPorAdminId_fkey: "barridoPurgaTotal (reglaRecomendacionHistorial)",
    reglas_recomendacion_creadaPorAdminId_fkey: "SEED · re-apunte a soporte@ (SEED_FK_REAPUNTAR)",
    simulacion_abuso_runs_creadoPorId_fkey: "barridoPurgaTotal (simulacionAbusoRun)",
    simulacion_runs_creadoPorId_fkey: "borrar-simulacion + barridoPurgaTotal (simulacionRun)",
    // → Suscripcion · borrarFacturacionDeSuscripciones + barridoPurgaTotal
    BonoAplicado_suscripcionId_fkey: "borrarFacturacionDeSuscripciones + barridoPurgaTotal",
    CodigoReferidoUso_codigoReferidoUsuarioId_fkey: "borrarFacturacionDeSuscripciones + barridoPurgaTotal",
    CodigoReferidoUso_suscripcionReferidaId_fkey: "borrarFacturacionDeSuscripciones + barridoPurgaTotal",
    Pago_suscripcionId_fkey: "borrarFacturacionDeSuscripciones + barridoPurgaTotal",
    // → IdentificadorReportado (agregado) · barridoPurgaTotal (EventoMatch antes)
    eventos_match_identificadorId_fkey: "barridoPurgaTotal (eventoMatch antes de identificadorReportado) + borrar-reporte",
    // → PerfilProfesional · borrar-profesional + barridoPurgaTotal
    FranjaDisponible_profesionalId_fkey: "borrar-profesional + barridoPurgaTotal",
    SolicitudCita_profesionalId_fkey: "borrar-profesional + barridoPurgaTotal",
    VerificacionProfesional_perfilProfesionalId_fkey: "borrar-profesional + barridoPurgaTotal",
};

describe("SPEC-615 · cobertura FK de la purga (derivada del catálogo)", () => {
    it("toda FK RESTRICT/NO-ACTION hacia el núcleo purgable está declarada como cubierta", async () => {
        const inList = PADRES_PURGABLES.map((p) => `'${p}'`).join(",");
        const filas = await prisma.$queryRawUnsafe<Array<{ conname: string; parent: string; child: string; deltype: string }>>(
            `SELECT con.conname, parent.relname AS parent, child.relname AS child, con.confdeltype AS deltype
               FROM pg_constraint con
               JOIN pg_class child ON child.oid = con.conrelid
               JOIN pg_class parent ON parent.oid = con.confrelid
              WHERE con.contype='f' AND con.confdeltype IN ('r','a')
                AND parent.relname IN (${inList})`,
        );

        // Sanity: el catálogo tiene FKs hacia el núcleo (si da 0, la consulta o la BD están mal).
        expect(filas.length, "el catálogo debería tener FKs RESTRICT hacia el núcleo purgable").toBeGreaterThan(0);

        // (1) FK nueva sin cobertura declarada → la cuarta rotura, cazada en CI y no en prod.
        const sinCubrir = filas.filter((f) => !(f.conname in COBERTURA_FK));
        expect(
            sinCubrir.map((f) => `${f.child}→${f.parent} (${f.conname})`),
            "FK RESTRICT hacia el núcleo SIN cobertura: bórrala en la purga (si es hija de Expediente, en borrarSubarbolExpediente) y declárala en COBERTURA_FK",
        ).toEqual([]);

        // (2) Entrada declarada que ya no existe en el catálogo → mantener el mapa honesto.
        const actuales = new Set(filas.map((f) => f.conname));
        const obsoletas = Object.keys(COBERTURA_FK).filter((c) => !actuales.has(c));
        expect(obsoletas, "entradas de COBERTURA_FK que ya no existen en el catálogo (quitalas)").toEqual([]);
    });

    it("HIJAS_RESTRICT_EXPEDIENTE = EXACTAMENTE las hijas RESTRICT de Expediente en el catálogo (origen único, derivado)", async () => {
        // Cierra la segunda mitad del hueco: no basta con que la cobertura DETECTE una FK nueva (arriba);
        // `HIJAS_RESTRICT_EXPEDIENTE` —la constante que el helper borra y que el ensayo de subárbol itera—
        // tiene que SER exactamente las hijas RESTRICT de Expediente según pg_constraint. Se deriva el
        // nombre de tabla de cada modelo por el DMMF de Prisma (respeta `@@map`), sin lista a mano.
        const filas = await prisma.$queryRawUnsafe<Array<{ child: string }>>(
            `SELECT child.relname AS child
               FROM pg_constraint con
               JOIN pg_class child ON child.oid = con.conrelid
               JOIN pg_class parent ON parent.oid = con.confrelid
              WHERE con.contype='f' AND con.confdeltype IN ('r','a') AND parent.relname = 'Expediente'`,
        );
        const catalogo = [...new Set(filas.map((f) => f.child))].sort();
        const tablaDe = (modelo: string) =>
            Prisma.dmmf.datamodel.models.find((m) => m.name === modelo)?.dbName ?? modelo;
        const constante = [...new Set(HIJAS_RESTRICT_EXPEDIENTE.map(tablaDe))].sort();

        expect(catalogo.length, "el catálogo debe tener hijas RESTRICT de Expediente (si da 0, algo está mal)").toBeGreaterThan(0);
        expect(
            constante,
            "HIJAS_RESTRICT_EXPEDIENTE debe ser EXACTAMENTE las hijas RESTRICT de Expediente en pg_constraint: " +
                "si el catálogo gana/pierde una, actualizá la constante Y su deleteMany en _borrar-expediente.ts",
        ).toEqual(catalogo);
    });
});

/**
 * SPEC-905 · el hallazgo clave del grafo, como candado DERIVADO del catálogo: las tablas SEED
 * (preservadas, NUNCA se borran) que referencian al admin creador con FK RESTRICT + NOT NULL
 * DEBEN estar en `SEED_FK_REAPUNTAR` (el reset las re-apunta a soporte@ antes del wipe). Si mañana
 * una tabla seed gana un `creadoPorAdminId` y nadie la re-apunta, el wipe de usuarios de --purga-total
 * tumbaría la FK en prod poblada — esto se pone rojo en CI primero. «Que muera la clase» (CEO).
 */
describe("SPEC-905 · cobertura del grafo del reset (derivada del catálogo)", () => {
    it("SEED_FK_REAPUNTAR = EXACTAMENTE las FK RESTRICT/NO-ACTION de tablas SEED → Usuario", async () => {
        const seedList = PRESERVADOS.tablas.map((t) => `'${t}'`).join(",");
        const filas = await prisma.$queryRawUnsafe<Array<{ child: string; col: string }>>(
            `SELECT child.relname AS child, a.attname AS col
               FROM pg_constraint con
               JOIN pg_class child ON child.oid = con.conrelid
               JOIN pg_class parent ON parent.oid = con.confrelid
               JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
              WHERE con.contype='f' AND con.confdeltype IN ('r','a')
                AND parent.relname = 'Usuario' AND child.relname IN (${seedList})`,
        );
        const delCatalogo = filas.map((f) => `${f.child}.${f.col}`).sort();
        const deLaConstante = SEED_FK_REAPUNTAR.map((s) => `${s.tabla}.${s.campo}`).sort();

        // Sanity: hay al menos una (Plan/GuiaAccionCategoria/reglas_recomendacion la tienen hoy).
        expect(delCatalogo.length, "el catálogo debería tener FK seed→Usuario RESTRICT").toBeGreaterThan(0);
        expect(
            deLaConstante,
            "SEED_FK_REAPUNTAR debe ser EXACTAMENTE las FK RESTRICT seed→Usuario del catálogo: si una tabla " +
                "SEED gana un creadoPorAdminId nuevo, agregala a SEED_FK_REAPUNTAR (el reset la re-apunta a soporte@) " +
                "o el wipe de --purga-total tumbará la FK contra prod poblada",
        ).toEqual(delCatalogo);
    });

    it("TABLAS_AGREGADO_PURGA son tablas reales (la aserción de 0-filas vive en afirmarPurgaTotalCompleta + el ensayo)", async () => {
        // TABLAS_AGREGADO_PURGA nombra MODELOS Prisma; se resuelven a su tabla real por el DMMF
        // (respeta @@map: EventoMatch→eventos_match, DemoMarcado→demo_marcado), como el test de HIJAS.
        const tablaDe = (modelo: string) =>
            Prisma.dmmf.datamodel.models.find((m) => m.name === modelo)?.dbName ?? modelo;
        const esperadas = TABLAS_AGREGADO_PURGA.map(tablaDe).sort();
        const nombres = esperadas.map((t) => `'${t}'`).join(",");
        const filas = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
            `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN (${nombres})`,
        );
        expect(
            filas.map((f) => f.tablename).sort(),
            "cada tabla de agregado declarada debe existir en el catálogo (o afirmarPurgaTotalCompleta contaría una tabla fantasma)",
        ).toEqual(esperadas);
    });
});
