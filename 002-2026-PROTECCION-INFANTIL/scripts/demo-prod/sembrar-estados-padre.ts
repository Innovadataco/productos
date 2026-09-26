/**
 * SPEC-722 · Siembra los estados del padre en las cuentas de PRUEBA (`+e2epadre`) para
 * DESBLOQUEAR a Calidad (3 pantallas del padre que hoy no se pueden caminar por falta de
 * datos). Lo corre el CEO en prod: **dry-run puro → `--confirm`**, idempotente, y ABORTA
 * ante un flag desconocido (`parseArgs`).
 *
 * SOLO cuentas cuyo email contiene `+e2epadre` — por CONSTRUCCIÓN: la consulta targeta ese
 * patrón (`padresE2E`), no puede alcanzar otras filas; no hay un `if` que se pueda saltar.
 * Todo lo que se crea va marcado en `demo_marcado` (corrida `e2epadre-722`, purgable por
 * `purgar-demo --corrida e2epadre-722`) → ninguna métrica ni el tablero lo cuenta como real.
 *
 * Deja, por cada `+e2epadre` (idempotente: la 2ª corrida no duplica):
 *  1. Un HIJO con una cuenta ACTIVA con PLATAFORMA + un reporte de OTRO reportante sobre esa
 *     (valor, plataforma) en estado visible/clasificado → cruza (I-429) y enciende el ámbar
 *     y la línea de SPEC-716A.
 *  2. El CÍRCULO con 2 personas reportadas (SPEC-718 «Necesita tu atención», una línea c/u).
 *  3. Una CITA CONFIRMADA (SPEC-715: compartir, agendar, pedir otra).
 *  4. El padre marcado sembrado/demo (`marcarDemo("Usuario", …)`) → el directorio le muestra
 *     los profesionales demo con franjas y puede PEDIR cita (SPEC-655/I-387).
 *  5. Una SUSCRIPCIÓN ACTIVA (plan PADRE) → `/camino/plan` no dispara y «Mis citas» + la cita
 *     (SPEC-730/731) quedan alcanzables. Sin esto el padre queda atrapado en el paso del plan.
 *
 * Nunca escribe la base a mano nadie: todo por acá. Nunca una contraseña en un mensaje/doc:
 * los demo actores llevan un hash sin sentido (no hacen login real).
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/demo-prod/sembrar-estados-padre.ts            (DRY-RUN)
 *   node --env-file=.env --import tsx scripts/demo-prod/sembrar-estados-padre.ts --confirm  (APLICA)
 */
import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";
import { marcarDemo } from "./lib/marcar";
import { parseArgs } from "../limpieza/_common";
import { crearReporteConTexto } from "@/lib/dal/services/crear-reporte-con-texto";
import { generarNumeroSeguimiento } from "@/lib/reporte-utils";
import { generarCodigoReferido } from "@/lib/utils/referido-codigo";
import { verificacionDemo, ESTADO_PERFIL_DEMO } from "./lib/profesional-demo";
import { nombrePersona, telefonoDemo, nickDemo, textoDemo } from "./lib/datos";

const CORRIDA = "e2epadre-722";
const MARCA = { corrida: CORRIDA, script: "sembrar-estados-padre" } as const;
/**
 * La marca de la CUENTA +e2epadre como «visor demo» (SPEC-655) vive en una corrida SEPARADA y
 * PERSISTENTE. `purgar-demo --corrida e2epadre-722` limpia el ESTADO sembrado (hijo, reportes,
 * círculo, cita, profesional y reportante demo) pero NO borra la cuenta fija de Calidad ni su
 * marca de visor — si compartieran corrida, la purga del estado se llevaría la cuenta y rompería
 * el re-run (`padresE2E` encontraría menos cuentas). Un reset TOTAL purga además esta corrida.
 * `esUsuarioSembrado` (SPEC-655) mira cualquier marca Usuario, sin importar la corrida.
 */
const CORRIDA_CUENTAS = "e2epadre-cuentas";
const MARCA_CUENTA = { corrida: CORRIDA_CUENTAS, script: "sembrar-estados-padre", notas: "padre-e2e-visor-demo" } as const;
/** Nombre DETERMINISTA del hijo sembrado → idempotencia por padre (¿ya tiene ese hijo?). */
const HIJO_NOMBRE = "Zaira (prueba SPEC-722)";
const EMAIL_OTRO = "soporte+e2e-otro-reportante@innovadataco.com";
const EMAIL_PROF = "soporte+e2e-cita-prof@innovadataco.com";

interface Base {
    paisId: string;
    ciudadId: string;
    plataformaId: string;
    adminId: string;
    planId: string;
    passwordHash: string;
}

async function resolverBase(): Promise<Base> {
    const pais = await prisma.pais.findFirst({ where: { codigo: "CO" }, select: { id: true } });
    const ciudad = await prisma.ciudad.findFirst({ where: { nombre: "Bogotá" }, select: { id: true } });
    const plataforma = await prisma.plataforma.findFirst({ where: { clave: "whatsapp" }, select: { id: true } });
    const admin = await prisma.usuario.findFirst({ where: { rol: "ADMIN" }, select: { id: true } });
    // Plan PADRE activo para colgar la suscripción (dato de referencia, sembrado por prisma/seed.ts).
    const plan = await prisma.plan.findFirst({ where: { tipoTitular: "PADRE", activo: true }, select: { id: true }, orderBy: { anio: "desc" } });
    if (!pais || !ciudad || !plataforma || !admin || !plan) {
        throw new Error(
            "[sembrar-estados-padre] Faltan datos base (país CO / ciudad Bogotá / plataforma whatsapp / admin ADMIN / plan PADRE activo). Corré el seed primero.",
        );
    }
    const passwordHash = await bcrypt.hash("PruebaDemo2026!", 10);
    return { paisId: pais.id, ciudadId: ciudad.id, plataformaId: plataforma.id, adminId: admin.id, planId: plan.id, passwordHash };
}

/** SOLO cuentas `+e2epadre` (por construcción: el patrón está en el WHERE). */
async function padresE2E() {
    return prisma.usuario.findMany({
        where: { email: { contains: "+e2epadre" }, rol: "PARENT", estado: "activo" },
        select: { id: true, email: true },
        orderBy: { email: "asc" },
    });
}

/** Idempotencia por padre: ¿ya tiene el hijo determinista de esta siembra? */
async function yaSembrado(padreId: string): Promise<boolean> {
    const hijo = await prisma.hijo.findFirst({ where: { usuarioId: padreId, nombre: HIJO_NOMBRE }, select: { id: true } });
    return hijo !== null;
}

/** Reportante «otro» demo compartido (para el cruce I-429: un reporte de OTRO usuarioId). */
async function asegurarOtroReportante(base: Base): Promise<string> {
    const existente = await prisma.usuario.findUnique({ where: { email: EMAIL_OTRO }, select: { id: true } });
    if (existente) return existente.id;
    const { nombre, apellidos } = nombrePersona(722001);
    const u = await prisma.usuario.create({
        data: { email: EMAIL_OTRO, nombre: `${nombre} ${apellidos}`, passwordHash: base.passwordHash, rol: "PARENT", estado: "activo", debeCambiarPassword: false },
    });
    await marcarDemo("Usuario", u.id, { ...MARCA, notas: "otro-reportante" });
    return u.id;
}

/**
 * Profesional demo compartido con franjas LIBRES, para colgar las citas CONFIRMADAS (una
 * franja por cita). Idempotente: reusa el perfil por email; garantiza `cuantas` franjas libres.
 */
async function asegurarProfConFranjas(base: Base, cuantas: number): Promise<{ perfilId: string; franjasLibres: string[] }> {
    let usuario = await prisma.usuario.findUnique({ where: { email: EMAIL_PROF }, select: { id: true } });
    if (!usuario) {
        const { nombre, apellidos } = nombrePersona(722900);
        usuario = await prisma.usuario.create({
            data: { email: EMAIL_PROF, nombre: `${nombre} ${apellidos}`, passwordHash: base.passwordHash, rol: "PROFESIONAL", estado: "activo", debeCambiarPassword: false },
        });
        await marcarDemo("Usuario", usuario.id, { ...MARCA, notas: "cita-prof" });
    }
    let perfil = await prisma.perfilProfesional.findUnique({ where: { usuarioId: usuario.id }, select: { id: true, duracionMinutos: true } });
    if (!perfil) {
        const { nombre, apellidos } = nombrePersona(722900);
        const revisadoEn = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const created = await prisma.perfilProfesional.create({
            data: {
                usuarioId: usuario.id,
                nombreVisible: `Dra. ${nombre} ${apellidos}`,
                tituloProfesional: "Psicóloga clínica",
                especialidades: ["Ansiedad infantil"],
                ciudadId: base.ciudadId,
                atiendeVirtual: true,
                atiendePresencial: false,
                aniosExperiencia: 8,
                presentacion: "Perfil DEMO SPEC-722 para las citas de prueba del padre e2e.",
                tarifaConsultaCOP: 120000,
                duracionMinutos: 50,
                emiteFactura: true,
                estado: ESTADO_PERFIL_DEMO,
                autorizacionArchivoId: "demo-autorizacion-e2e-cita",
                autorizacionSubidaEn: new Date(revisadoEn.getTime() - 24 * 60 * 60 * 1000),
            },
            select: { id: true, duracionMinutos: true },
        });
        await marcarDemo("PerfilProfesional", created.id, MARCA);
        const verif = verificacionDemo(revisadoEn);
        const v = await prisma.verificacionProfesional.create({
            data: {
                perfilProfesionalId: created.id,
                revisadoPorId: base.adminId,
                revisadoEn: verif.revisadoEn,
                checklist: { antecedentes: true, tarjetaProfesional: true, autorizacionFirmada: true },
                resultado: verif.resultado,
                autorizacionArchivoId: "demo-autorizacion-e2e-cita",
                venceEn: verif.venceEn,
            },
            select: { id: true },
        });
        await marcarDemo("VerificacionProfesional", v.id, MARCA);
        perfil = created;
    }
    // Garantizar `cuantas` franjas LIBRES (tomada:false) sin reserva. Idempotente: cuenta
    // las libres existentes de este perfil demo y crea solo las que falten.
    const libres = await prisma.franjaDisponible.findMany({
        where: { profesionalId: perfil.id, tomada: false },
        select: { id: true },
        orderBy: { inicio: "asc" },
    });
    const franjasLibres = libres.map((f) => f.id);
    for (let f = franjasLibres.length; f < cuantas; f++) {
        const inicio = new Date();
        inicio.setDate(inicio.getDate() + f + 1);
        inicio.setHours(9 + (f % 6), 0, 0, 0);
        const fin = new Date(inicio.getTime() + perfil.duracionMinutos * 60 * 1000);
        const franja = await prisma.franjaDisponible.create({
            data: { profesionalId: perfil.id, inicio, fin, modalidad: "VIRTUAL", tomada: false },
            select: { id: true },
        });
        await marcarDemo("FranjaDisponible", franja.id, MARCA);
        franjasLibres.push(franja.id);
    }
    return { perfilId: perfil.id, franjasLibres };
}

/**
 * Un reporte demo de OTRO reportante sobre (identificador, plataforma), visible/clasificado.
 * Corre DENTRO de la transacción del padre (`tx`): si algo falla después, el reporte y su marca
 * hacen rollback con todo lo demás. `numeroSeguimiento` sale del generador canónico
 * (`generarNumeroSeguimiento`, CSPRNG, formato RPT-XXXXXX): ÚNICO por reporte — nunca un valor
 * fijo/derivado del índice, que colisiona entre cuentas y entre corridas (el bug del 25-09).
 */
async function crearReporteDeOtro(
    tx: Prisma.TransactionClient,
    base: Base,
    otroReportanteId: string,
    identificador: string,
    diasAtras: number,
): Promise<void> {
    const cuando = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000);
    const reporte = await crearReporteConTexto(tx, {
        texto: textoDemo("CONTACTO_INSISTENTE"),
        reporte: {
            identificador,
            plataformaId: base.plataformaId,
            fechaIncidente: cuando,
            ciudad: "Bogotá",
            pais: "Colombia",
            paisId: base.paisId,
            ciudadId: base.ciudadId,
            estado: "CLASIFICADO",
            esAnonimo: false,
            edadVictima: 13,
            numeroSeguimiento: generarNumeroSeguimiento(),
            creadoEn: cuando,
            usuarioId: otroReportanteId,
        },
    });
    await marcarDemo("Reporte", reporte.id, MARCA, tx);
    const clasif = await tx.clasificacionIA.create({
        data: { reporteId: reporte.id, categoria: "CONTACTO_INSISTENTE", confianza: 0.82, modeloUsado: "ornith:9b", latenciaMs: 1200 },
        select: { id: true },
    });
    await marcarDemo("ClasificacionIA", clasif.id, MARCA, tx);
}

interface ResumenPadre {
    email: string;
    hijos: number;
    reportesVisibles: number;
    contactos: number;
    citasConfirmadas: number;
    marcadoSembrado: boolean;
    suscripcionActiva: boolean;
}

async function sembrarPadre(base: Base, padre: { id: string; email: string }, otroReportanteId: string, franjaCitaId: string): Promise<ResumenPadre> {
    const r: ResumenPadre = { email: padre.email, hijos: 0, reportesVisibles: 0, contactos: 0, citasConfirmadas: 0, marcadoSembrado: false, suscripcionActiva: false };

    // TODO el padre en UNA transacción: si algo falla, hace ROLLBACK COMPLETO (filas + marcas).
    // Así una falla parcial NO deja «marcado-pero-incompleto» (el bug del 25-09): yaSembrado(hijo)
    // vuelve a ser un señalador fiable de «sembrado entero» y el re-run puede sanar. maxWait/timeout
    // holgados por el cifrado del texto (crearReporteConTexto sella ContenidoReporte por reporte).
    await prisma.$transaction(
        async (tx) => {
            // Estado 4: el padre marcado sembrado → ve profesionales demo con franjas (SPEC-655).
            // Marca en la corrida PERSISTENTE de cuentas (no la del estado): la purga del estado
            // NO se lleva la cuenta fija de Calidad.
            await marcarDemo("Usuario", padre.id, MARCA_CUENTA, tx);
            r.marcadoSembrado = true;

            // Estado 1: hijo + cuenta ACTIVA con plataforma + reporte de OTRO sobre esa cuenta.
            const valorHijo = nickDemo(722100);
            const hijo = await tx.hijo.create({ data: { usuarioId: padre.id, nombre: HIJO_NOMBRE, apellidos: "Demo" }, select: { id: true } });
            await marcarDemo("Hijo", hijo.id, MARCA, tx);
            r.hijos++;
            const identHijo = await tx.identificadorHijo.create({
                data: { hijoId: hijo.id, valor: valorHijo, tipo: "nick", plataformaId: base.plataformaId, activo: true },
                select: { id: true },
            });
            await marcarDemo("IdentificadorHijo", identHijo.id, MARCA, tx);
            await crearReporteDeOtro(tx, base, otroReportanteId, valorHijo, 100);
            r.reportesVisibles++;

            // Estado 2: círculo con 2 personas reportadas (cada contacto con su identificador + reporte).
            for (let c = 0; c < 2; c++) {
                const contacto = await tx.contactoConfianza.create({
                    data: { usuarioId: padre.id, etiqueta: `Contacto prueba SPEC-722 #${c + 1}`, activo: true },
                    select: { id: true },
                });
                await marcarDemo("ContactoConfianza", contacto.id, MARCA, tx);
                r.contactos++;
                const valorContacto = telefonoDemo(722200 + c);
                const identC = await tx.identificadorContacto.create({
                    data: { contactoId: contacto.id, valor: valorContacto, tipo: "telefono", plataformaId: base.plataformaId, activo: true },
                    select: { id: true },
                });
                await marcarDemo("IdentificadorContacto", identC.id, MARCA, tx);
                await crearReporteDeOtro(tx, base, otroReportanteId, valorContacto, 200 + c);
            }

            // Estado 3: una cita CONFIRMADA (ocupa una franja libre del prof demo). El update
            // devuelve la fila → sin un findUnique extra; si la franja no existe, tira y hace rollback.
            const franja = await tx.franjaDisponible.update({
                where: { id: franjaCitaId },
                data: { tomada: true },
                select: { profesionalId: true },
            });
            const ahora = new Date();
            const cita = await tx.solicitudCita.create({
                data: {
                    padreUsuarioId: padre.id,
                    profesionalId: franja.profesionalId,
                    franjaId: franjaCitaId,
                    presentacion: "Solicitud de prueba SPEC-722 para caminar Mis-citas y la presentación de la cita.",
                    urgencia: "SIN_APURO",
                    estado: "CONFIRMADA",
                    venceEn: new Date(ahora.getTime() + 48 * 60 * 60 * 1000),
                    pagoAprobadoEn: ahora,
                    montoConsulta: 120000,
                    montoServicio: 18000,
                    montoTotal: 138000,
                    porcentajeServicio: 15,
                },
                select: { id: true },
            });
            await marcarDemo("SolicitudCita", cita.id, MARCA, tx);
            r.citasConfirmadas++;

            // Estado 5: suscripción ACTIVA. Sin esto el padre cae a /camino/plan y NO alcanza
            // «Mis citas» ni la cita (SPEC-730/731). El camino (derivarPasoPendiente, paso 4) exige
            // suscripcion.count > 0, y la vigencia (obtenerSuscripcionActivaPorUsuarioId) exige estado
            // ∈ {ACTIVA, EN_GRACIA} → ACTIVA satisface ambos. Cuelga de un plan PADRE de referencia
            // (no se marca demo: la purga del estado no toca el catálogo de planes).
            const suscripcion = await tx.suscripcion.create({
                data: {
                    tipoTitular: "PADRE",
                    usuarioId: padre.id,
                    estado: "ACTIVA",
                    planActualId: base.planId,
                    fechaInicio: ahora,
                    fechaFin: new Date(ahora.getTime() + 365 * 24 * 60 * 60 * 1000),
                    codigoReferidoPropio: generarCodigoReferido("PADRE"),
                    esFreemium: false,
                    monedaLocal: "COP",
                    paisCliente: "CO",
                },
                select: { id: true },
            });
            await marcarDemo("Suscripcion", suscripcion.id, MARCA, tx);
            r.suscripcionActiva = true;
        },
        { maxWait: 15000, timeout: 30000 },
    );

    return r;
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["confirm"]);
    const confirm = args.confirm === true;
    console.log(`[sembrar-estados-padre] modo: ${confirm ? "APLICAR (--confirm)" : "DRY-RUN (sin --confirm, no se escribe nada)"}`);

    const padres = await padresE2E();
    console.log(`[sembrar-estados-padre] cuentas +e2epadre encontradas: ${padres.length} — ${padres.map((p) => p.email).join(", ") || "(ninguna)"}`);
    if (padres.length === 0) {
        console.log("[sembrar-estados-padre] No hay cuentas +e2epadre; nada que sembrar. Fin.");
        return;
    }

    const pendientes: { id: string; email: string }[] = [];
    for (const p of padres) {
        if (await yaSembrado(p.id)) {
            console.log(`[sembrar-estados-padre] ${p.email}: ya sembrado (idempotente) — se omite.`);
        } else {
            pendientes.push(p);
        }
    }
    console.log(`[sembrar-estados-padre] a sembrar: ${pendientes.length} de ${padres.length}.`);

    if (!confirm) {
        for (const p of pendientes) {
            console.log(`[sembrar-estados-padre] DRY-RUN: sembraría ${p.email} → 1 hijo con reporte de otro, círculo con 2 reportados, 1 cita CONFIRMADA, y lo marcaría sembrado (ve demo).`);
        }
        console.log("[sembrar-estados-padre] DRY-RUN: no se escribió nada. Corré con --confirm para sembrar.");
        return;
    }

    if (pendientes.length === 0) {
        console.log("[sembrar-estados-padre] Nada pendiente; todo ya sembrado. Fin.");
        return;
    }

    const base = await resolverBase();
    const otroReportanteId = await asegurarOtroReportante(base);
    const { franjasLibres } = await asegurarProfConFranjas(base, pendientes.length);

    // Por padre y aislado: cada cuenta es atómica (rollback completo si falla), y la falla de una
    // NO frena a las demás ni las envenena. Reporto las fallidas y salgo con código ≠ 0 para que el
    // corredor sepa que quedó trabajo (reintentable en el próximo --confirm; las OK no se re-siembran).
    let fallidas = 0;
    for (let i = 0; i < pendientes.length; i++) {
        const padre = pendientes[i]!;
        const franjaCitaId = franjasLibres[i];
        if (!franjaCitaId) throw new Error("[sembrar-estados-padre] No hay franja libre para la cita — aborta.");
        try {
            const r = await sembrarPadre(base, padre, otroReportanteId, franjaCitaId);
            console.log(
                `[sembrar-estados-padre] APLICADO ${r.email}: hijo=${r.hijos} reporteVisible=${r.reportesVisibles} círculo=${r.contactos} citaCONFIRMADA=${r.citasConfirmadas} suscripción=${r.suscripcionActiva} sembrado=${r.marcadoSembrado}`,
            );
        } catch (err) {
            fallidas++;
            console.error(
                `[sembrar-estados-padre] FALLÓ ${padre.email} — rollback COMPLETO (nada marcado; reintentable en el próximo --confirm):`,
                err instanceof Error ? err.message : err,
            );
        }
    }
    if (fallidas > 0) {
        console.error(
            `[sembrar-estados-padre] ${fallidas} de ${pendientes.length} cuenta(s) fallaron y quedaron SIN sembrar. Reintentá con --confirm (las completas no se re-siembran).`,
        );
        process.exitCode = 1;
        return;
    }
    console.log(`[sembrar-estados-padre] Listo: ${pendientes.length} cuenta(s) sembrada(s). Todo marcado corrida="${CORRIDA}" (purgable).`);
}

if (process.argv[1]?.endsWith("sembrar-estados-padre.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[sembrar-estados-padre] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}

export { padresE2E, yaSembrado, sembrarPadre, resolverBase, asegurarOtroReportante, asegurarProfConFranjas, CORRIDA, CORRIDA_CUENTAS, HIJO_NOMBRE };
