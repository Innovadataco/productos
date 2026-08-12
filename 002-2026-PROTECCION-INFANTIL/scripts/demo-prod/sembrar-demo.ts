#!/usr/bin/env tsx
/* eslint-disable max-lines */
/**
 * Seed demo de PRODUCCIÓN — volumen completo para SPEC-160 (002-PI-059).
 * Uso:
 *   DEMO_PASSWORD=DemoSeguro2026! node --env-file=.env --import tsx scripts/demo-prod/sembrar-demo.ts [--force]
 */
import { spawnSync } from "node:child_process";
import { prisma } from "./lib/prisma";
import { marcarDemo } from "./lib/marcar";
import { auditarDemo } from "./lib/auditar";
import { hashDemoPassword, getDemoPassword } from "./lib/password";
import { hashIdentificacion } from "@/lib/hash-identificacion";
import { CORRIDA, NUM_COLEGIOS, CURSOS_POR_COLEGIO, ESTUDIANTES_POR_CURSO, NUM_OPERADORES, NUM_PADRES, PADRES_CON_CIRCULO, NUM_REPORTES, FRACCION_ANONIMOS } from "./lib/config";
import {
    nombreColegio,
    nombrePersona,
    edadVictima,
    emailUsuarioDemo,
    identificadoresEstudiante,
    relacionAcudiente,
    cantidadAcudientes,
    textoDemo,
    fechaReporte,
    numeroSeguimientoDemo,
    telefonoDemo,
    elegirCategoria,
    elegirEstadoHistorico,
    floatEntre,
    esVerdadero,
    enteroEntre,
} from "./lib/datos";
import type { EstadoReporte } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const FORCE = process.argv.includes("--force");

interface ColegioCreado {
    id: string;
    nombre: string;
    tenantId: string;
    adminEmail: string;
}

interface IdentificadorParaReporte {
    valor: string;
    plataformaId: string;
    identificadorEstudianteId: string;
    colegioId: string;
    cursoId: string;
    estudianteId: string;
}

interface Resumen {
    colegios: ColegioCreado[];
    cursos: number;
    profesores: number;
    estudiantes: number;
    identificadoresEstudiante: number;
    acudientes: number;
    operadores: number;
    comites: number;
    integrantesComite: number;
    padres: number;
    contactosConfianza: number;
    identificadoresContacto: number;
    reportes: number;
    reportesAnonimos: number;
    reportesAutenticados: number;
    reportesHistoricos: number;
    reportesFrescos: number;
    clasificaciones: number;
    transiciones: number;
}

async function verificarIdempotencia(): Promise<void> {
    const existente = await prisma.demoMarcado.findFirst({
        where: {
            entidad: "Reporte",
            metadata: { path: ["corrida"], equals: CORRIDA },
        },
    });
    if (!existente) return;

    if (!FORCE) {
        console.error(`[sembrar-demo] Ya existen registros DemoMarcado para la corrida ${CORRIDA}.`);
        console.error("[sembrar-demo] Use --force para purgar primero o ejecute scripts/demo-prod/purgar-demo.ts.");
        throw new Error("Corrida demo ya existe");
    }

    console.log(`[sembrar-demo] --force: purgando corrida previa ${CORRIDA}...`);
    const purgarScript = new URL("purgar-demo.ts", import.meta.url).pathname;
    const resultado = spawnSync(process.execPath, ["--import", "tsx", purgarScript], {
        stdio: "inherit",
        env: process.env,
    });
    if (resultado.status !== 0) {
        throw new Error(`[sembrar-demo] La purga previa falló con código ${resultado.status ?? "desconocido"}`);
    }
}

async function cargarBase() {
    const admin = await prisma.usuario.findFirst({ where: { rol: "ADMIN" } });
    if (!admin) throw new Error("No hay usuario ADMIN; correr seed primero");

    const pais = await prisma.pais.findFirst({ where: { codigo: "CO" } });
    const ciudad = await prisma.ciudad.findFirst({ where: { nombre: "Bogotá" } });
    const departamento = await prisma.departamento.findFirst({ where: { nombre: "Bogotá D.C." } });
    const plataforma = await prisma.plataforma.findFirst({ where: { clave: "whatsapp" } });
    if (!pais || !ciudad || !plataforma) throw new Error("Faltan datos base (país/ciudad/plataforma)");

    return { admin, pais, ciudad, departamento, plataforma };
}

async function main() {
    await verificarIdempotencia();
    const { admin, pais, ciudad, departamento, plataforma } = await cargarBase();
    const passwordHash = await hashDemoPassword();
    const password = getDemoPassword();

    const resumen: Resumen = {
        colegios: [],
        cursos: 0,
        profesores: 0,
        estudiantes: 0,
        identificadoresEstudiante: 0,
        acudientes: 0,
        operadores: 0,
        comites: 0,
        integrantesComite: 0,
        padres: 0,
        contactosConfianza: 0,
        identificadoresContacto: 0,
        reportes: 0,
        reportesAnonimos: 0,
        reportesAutenticados: 0,
        reportesHistoricos: 0,
        reportesFrescos: 0,
        clasificaciones: 0,
        transiciones: 0,
    };

    await auditarDemo("EXPERIMENT_START", undefined, admin.id, undefined, { corrida: CORRIDA, fase: "inicio" });

    // ------------------------------------------------------------------
    // Fase 1: tenants + colegios + SCHOOL_ADMIN
    // ------------------------------------------------------------------
    console.log("[sembrar-demo] Fase 1: creando tenants, colegios y SCHOOL_ADMIN...");
    const identificadoresReporte: IdentificadorParaReporte[] = [];

    for (let i = 0; i < NUM_COLEGIOS; i++) {
        const idx = i + 1;
        const nombreTenant = `Tenant DEMO ${String(idx).padStart(2, "0")}`;
        const tenant = await prisma.tenant.create({ data: { nombre: nombreTenant, estado: "activo" } });
        await marcarDemo("Tenant", tenant.id, { corrida: CORRIDA, script: "sembrar-demo" });

        const nombreColegioValue = nombreColegio(i);
        const colegioData: {
            nombre: string;
            paisId: string;
            ciudadId: string;
            representanteLegalNombre: string;
            representanteLegalIdentificacion: string;
            representanteLegalEmail: string;
            representanteLegalTelefono: string;
            inicioServicio: Date;
            finServicio: Date;
            tipoPeriodo: "ANUAL";
            estado: string;
            tenantId: string;
            departamentoId?: string;
        } = {
            nombre: nombreColegioValue,
            paisId: pais.id,
            ciudadId: ciudad.id,
            representanteLegalNombre: "Representante Legal Demo",
            representanteLegalIdentificacion: `DEMO-NIT-${String(idx).padStart(3, "0")}`,
            representanteLegalEmail: `soporte+representante${String(idx).padStart(2, "0")}@innovadataco.com`,
            representanteLegalTelefono: `300DEMOREP${String(idx).padStart(2, "0")}`,
            inicioServicio: new Date("2026-01-01"),
            finServicio: new Date("2026-12-31"),
            tipoPeriodo: "ANUAL",
            estado: "activo",
            tenantId: tenant.id,
        };
        if (departamento) colegioData.departamentoId = departamento.id;
        const colegio = await prisma.colegio.create({ data: colegioData });
        await marcarDemo("Colegio", colegio.id, { corrida: CORRIDA, script: "sembrar-demo" });

        const adminEmail = emailUsuarioDemo("SCHOOL_ADMIN", idx);
        const schoolAdmin = await prisma.usuario.create({
            data: {
                email: adminEmail,
                nombre: `Admin Colegio ${String(idx).padStart(2, "0")}`,
                passwordHash,
                rol: "SCHOOL_ADMIN",
                estado: "activo",
                debeCambiarPassword: false,
                tenantId: tenant.id,
                colegioId: colegio.id,
            },
        });
        await marcarDemo("Usuario", schoolAdmin.id, { corrida: CORRIDA, script: "sembrar-demo", notas: "SCHOOL_ADMIN" });
        await auditarDemo("USER_CREATE", colegio.id, admin.id, colegio.id, { demo: true, email: schoolAdmin.email });

        resumen.colegios.push({ id: colegio.id, nombre: colegio.nombre, tenantId: tenant.id, adminEmail });

        // --------------------------------------------------------------
        // Fase 2: profesores y cursos
        // --------------------------------------------------------------
        const profesoresCreados: { id: string }[] = [];
        for (let p = 0; p < CURSOS_POR_COLEGIO; p++) {
            const profesorIdx = i * CURSOS_POR_COLEGIO + p + 1;
            const { nombre, apellidos } = nombrePersona(1000 + profesorIdx);
            const profesor = await prisma.profesor.create({
                data: {
                    colegioId: colegio.id,
                    nombre,
                    apellidos,
                    email: `soporte+profesor${String(profesorIdx).padStart(3, "0")}@innovadataco.com`,
                    telefono: `300DEMOPRO${String(profesorIdx).padStart(3, "0")}`,
                    estado: "activo",
                },
            });
            await marcarDemo("Profesor", profesor.id, { corrida: CORRIDA, script: "sembrar-demo" });
            profesoresCreados.push({ id: profesor.id });
            resumen.profesores++;
        }

        for (let c = 0; c < CURSOS_POR_COLEGIO; c++) {
            const cursoIdx = i * CURSOS_POR_COLEGIO + c + 1;
            const profesorTitular = profesoresCreados[c];
            if (!profesorTitular) throw new Error("Profesor titular no encontrado");
            const curso = await prisma.curso.create({
                data: {
                    colegioId: colegio.id,
                    nombre: `Curso DEMO ${String(cursoIdx).padStart(3, "0")}`,
                    grado: `${(cursoIdx % 11) + 1}°`,
                    anioLectivo: "2026",
                    estado: "activo",
                    profesorTitularId: profesorTitular.id,
                },
            });
            await marcarDemo("Curso", curso.id, { corrida: CORRIDA, script: "sembrar-demo" });
            resumen.cursos++;

            // ----------------------------------------------------------
            // Fase 3: estudiantes, identificadores y acudientes
            // ----------------------------------------------------------
            for (let e = 0; e < ESTUDIANTES_POR_CURSO; e++) {
                const estudianteIdxGlobal = i * CURSOS_POR_COLEGIO * ESTUDIANTES_POR_CURSO + c * ESTUDIANTES_POR_CURSO + e;
                const estudianteIdx = estudianteIdxGlobal + 1;
                const { nombre, apellidos } = nombrePersona(estudianteIdxGlobal);
                const estudiante = await prisma.estudiante.create({
                    data: {
                        cursoId: curso.id,
                        colegioId: colegio.id,
                        nombre,
                        apellidos,
                        estado: "activo",
                    },
                });
                await marcarDemo("Estudiante", estudiante.id, { corrida: CORRIDA, script: "sembrar-demo" });
                resumen.estudiantes++;

                const idents = identificadoresEstudiante(estudianteIdxGlobal);
                for (let ii = 0; ii < idents.length; ii++) {
                    const idData = idents[ii];
                    if (!idData) continue;
                    const ident = await prisma.identificadorEstudiante.create({
                        data: {
                            estudianteId: estudiante.id,
                            tipo: idData.tipo,
                            valor: idData.valor,
                            plataformaId: plataforma.id,
                            etiquetaRelacion: "ESTUDIANTE",
                            estado: "activo",
                        },
                    });
                    await marcarDemo("IdentificadorEstudiante", ident.id, { corrida: CORRIDA, script: "sembrar-demo" });
                    resumen.identificadoresEstudiante++;

                    identificadoresReporte.push({
                        valor: idData.valor,
                        plataformaId: plataforma.id,
                        identificadorEstudianteId: ident.id,
                        colegioId: colegio.id,
                        cursoId: curso.id,
                        estudianteId: estudiante.id,
                    });
                }

                const numAcudientes = cantidadAcudientes();
                for (let a = 0; a < numAcudientes; a++) {
                    const acudienteIdx = estudianteIdxGlobal * 2 + a + 5000;
                    const { nombre: nomAcud, apellidos: apeAcud } = nombrePersona(acudienteIdx);
                    const acudiente = await prisma.acudienteEstudiante.create({
                        data: {
                            estudianteId: estudiante.id,
                            orden: a + 1,
                            nombre: nomAcud,
                            relacion: relacionAcudiente(),
                            telefono: `300DEMOACU${String(acudienteIdx).padStart(6, "0")}`,
                            email: `soporte+acudiente${String(acudienteIdx).padStart(5, "0")}@innovadataco.com`,
                        },
                    });
                    await marcarDemo("AcudienteEstudiante", acudiente.id, { corrida: CORRIDA, script: "sembrar-demo" });
                    resumen.acudientes++;
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // Fase 4: OPERADORES globales + COMITE_VALIDACION
    // ------------------------------------------------------------------
    console.log("[sembrar-demo] Fase 4: creando OPERADORES y COMITE_VALIDACION...");
    const operadoresIds: string[] = [];
    for (let o = 0; o < NUM_OPERADORES; o++) {
        const idx = o + 1;
        const { nombre, apellidos } = nombrePersona(90000 + idx);
        const email = emailUsuarioDemo("OPERADOR", idx);
        const operador = await prisma.usuario.create({
            data: {
                email,
                nombre: `${nombre} ${apellidos}`,
                passwordHash,
                rol: "OPERADOR",
                estado: "activo",
                debeCambiarPassword: false,
            },
        });
        await marcarDemo("Usuario", operador.id, { corrida: CORRIDA, script: "sembrar-demo", notas: "OPERADOR" });
        const perfil = await prisma.perfilOperador.create({
            data: {
                usuarioId: operador.id,
                cupoMaximo: 20,
                esRevisorDeApelaciones: false,
                esComite: false,
                creadoPorId: admin.id,
            },
        });
        await marcarDemo("PerfilOperador", perfil.id, { corrida: CORRIDA, script: "sembrar-demo" });
        operadoresIds.push(operador.id);
        resumen.operadores++;
    }

    const comiteEmail = emailUsuarioDemo("COMITE_VALIDACION", 1);
    const { nombre: nomComite, apellidos: apeComite } = nombrePersona(95001);
    const comite = await prisma.usuario.create({
        data: {
            email: comiteEmail,
            nombre: `${nomComite} ${apeComite}`,
            passwordHash,
            rol: "COMITE_VALIDACION",
            estado: "activo",
            debeCambiarPassword: false,
        },
    });
    await marcarDemo("Usuario", comite.id, { corrida: CORRIDA, script: "sembrar-demo", notas: "COMITE_VALIDACION" });
    resumen.comites++;

    const demoDoc = `DEMOCOMITE${String(1).padStart(5, "0")}`;
    const integrante = await prisma.integranteComite.create({
        data: {
            comiteId: comite.id,
            nombres: nomComite,
            apellidos: apeComite,
            tipoIdentificacion: "CEDULA_CIUDADANIA",
            numeroIdentificacion: demoDoc,
            hashIdentificacion: hashIdentificacion(demoDoc),
            email: comiteEmail,
            estado: "ACTIVO",
            creadoPorId: admin.id,
            modificadoPorId: admin.id,
        },
    });
    await marcarDemo("IntegranteComite", integrante.id, { corrida: CORRIDA, script: "sembrar-demo" });
    resumen.integrantesComite++;

    // ------------------------------------------------------------------
    // Fase 5: PARENTs y círculos de confianza
    // ------------------------------------------------------------------
    console.log("[sembrar-demo] Fase 5: creando PARENTs y círculos de confianza...");
    const padres: { id: string; email: string; idx: number }[] = [];
    for (let p = 0; p < NUM_PADRES; p++) {
        const idx = p + 1;
        const { nombre, apellidos } = nombrePersona(80000 + idx);
        const email = emailUsuarioDemo("PARENT", idx);
        const padre = await prisma.usuario.create({
            data: {
                email,
                nombre: `${nombre} ${apellidos}`,
                passwordHash,
                rol: "PARENT",
                estado: "activo",
                debeCambiarPassword: false,
            },
        });
        await marcarDemo("Usuario", padre.id, { corrida: CORRIDA, script: "sembrar-demo", notas: "PARENT" });
        padres.push({ id: padre.id, email, idx });
        resumen.padres++;
    }

    for (let c = 0; c < PADRES_CON_CIRCULO; c++) {
        const padre = padres[c];
        if (!padre) continue;
        const contacto = await prisma.contactoConfianza.create({
            data: {
                usuarioId: padre.id,
                etiqueta: `Contacto demo ${String(padre.idx).padStart(2, "0")}`,
                activo: true,
            },
        });
        await marcarDemo("ContactoConfianza", contacto.id, { corrida: CORRIDA, script: "sembrar-demo" });
        resumen.contactosConfianza++;

        // Algunos identificadores coinciden con identificadores de estudiantes para ejercer flujo de círculo.
        let valorContacto: string;
        if (c % 3 === 0 && identificadoresReporte.length > 0) {
            const identEstudiante = identificadoresReporte[c % identificadoresReporte.length];
            valorContacto = identEstudiante?.valor ?? telefonoDemo(700000 + c);
        } else {
            valorContacto = telefonoDemo(700000 + c);
        }
        const identContacto = await prisma.identificadorContacto.create({
            data: {
                contactoId: contacto.id,
                valor: valorContacto,
                tipo: c % 2 === 0 ? "telefono" : "nick",
                plataformaId: plataforma.id,
                activo: true,
            },
        });
        await marcarDemo("IdentificadorContacto", identContacto.id, { corrida: CORRIDA, script: "sembrar-demo" });
        resumen.identificadoresContacto++;
    }

    // ------------------------------------------------------------------
    // Fase 6: reportes
    // ------------------------------------------------------------------
    console.log("[sembrar-demo] Fase 6: generando reportes demo...");
    if (identificadoresReporte.length === 0) throw new Error("No hay identificadores de estudiantes para reportar");

    for (let r = 0; r < NUM_REPORTES; r++) {
        const identParaReporte = identificadoresReporte[r % identificadoresReporte.length];
        if (!identParaReporte) continue;

        const esAnonimo = esVerdadero(FRACCION_ANONIMOS);
        const esFresco = esVerdadero(0.2); // 20% frescos (≤ 7 días), 80% históricos
        const fecha = fechaReporte(esFresco);
        const categoria = elegirCategoria();
        const estado: EstadoReporte = esFresco ? "PENDIENTE" : elegirEstadoHistorico();

        let usuarioId: string | undefined;
        if (!esAnonimo) {
            const padre = padres[r % padres.length];
            usuarioId = padre?.id;
        }

        const reporteData: {
            identificador: string;
            plataformaId: string;
            texto: string;
            fechaIncidente: Date;
            ciudad: string;
            pais: string;
            paisId: string;
            ciudadId: string;
            estado: EstadoReporte;
            esAnonimo: boolean;
            edadVictima: number;
            numeroSeguimiento: string;
            creadoEn: Date;
            usuarioId?: string;
        } = {
            identificador: identParaReporte.valor,
            plataformaId: identParaReporte.plataformaId,
            texto: textoDemo(categoria),
            fechaIncidente: fecha,
            ciudad: "Bogotá",
            pais: "Colombia",
            paisId: pais.id,
            ciudadId: ciudad.id,
            estado,
            esAnonimo,
            edadVictima: edadVictima(),
            numeroSeguimiento: numeroSeguimientoDemo(r),
            creadoEn: fecha,
        };
        if (usuarioId) reporteData.usuarioId = usuarioId;

        const reporte = await prisma.reporte.create({ data: reporteData });
        await marcarDemo("Reporte", reporte.id, {
            corrida: CORRIDA,
            script: "sembrar-demo",
            notas: esFresco ? "fresco para motor" : "histórico sin aviso",
        });
        resumen.reportes++;
        if (esAnonimo) resumen.reportesAnonimos++;
        else resumen.reportesAutenticados++;
        if (esFresco) resumen.reportesFrescos++;
        else resumen.reportesHistoricos++;

        if (!esFresco) {
            const confianza = floatEntre(0.6, 0.95); // variabilidad ligera
            const latenciaMs = enteroEntre(800, 2300);
            const clasificacion = await prisma.clasificacionIA.create({
                data: {
                    reporteId: reporte.id,
                    categoria,
                    confianza,
                    modeloUsado: "ornith:9b",
                    latenciaMs,
                    creadoEn: fecha,
                },
            });
            await marcarDemo("ClasificacionIA", clasificacion.id, { corrida: CORRIDA, script: "sembrar-demo", notas: "histórica" });
            resumen.clasificaciones++;

            const transicion = await prisma.transicionReporte.create({
                data: {
                    reporteId: reporte.id,
                    estadoAnterior: "PENDIENTE",
                    estadoNuevo: estado,
                    responsableTipo: "IA",
                    creadoEn: fecha,
                },
            });
            await marcarDemo("TransicionReporte", transicion.id, { corrida: CORRIDA, script: "sembrar-demo", notas: "histórica" });
            resumen.transiciones++;
        }
    }

    // ------------------------------------------------------------------
    // Fase 7: audit final + credenciales + resumen
    // ------------------------------------------------------------------
    await auditarDemo("EXPERIMENT_COMPLETE", undefined, admin.id, undefined, { corrida: CORRIDA, fase: "fin" });

    const runDir = process.env.RUN_DIR || (fs.existsSync("/app/run") ? "/app/run" : path.resolve(import.meta.dirname ?? "."));
    const credencialesPath = path.resolve(runDir, ".demo-credenciales.json");
    const credenciales = {
        corrida: CORRIDA,
        password,
        usuarios: [
            ...resumen.colegios.map((c) => ({ email: c.adminEmail, rol: "SCHOOL_ADMIN" as const, password })),
            ...Array.from({ length: NUM_OPERADORES }, (_, i) => ({
                email: emailUsuarioDemo("OPERADOR", i + 1),
                rol: "OPERADOR" as const,
                password,
            })),
            { email: comiteEmail, rol: "COMITE_VALIDACION" as const, password },
            ...padres.map((p) => ({ email: p.email, rol: "PARENT" as const, password })),
        ],
        colegios: resumen.colegios.map((c) => ({ nombre: c.nombre, adminEmail: c.adminEmail })),
    };
    fs.writeFileSync(credencialesPath, JSON.stringify(credenciales, null, 2));

    console.log("\n[sembrar-demo] Resumen de corrida " + CORRIDA);
    console.log(`  Colegios:           ${resumen.colegios.length}`);
    console.log(`  Cursos:             ${resumen.cursos}`);
    console.log(`  Profesores:         ${resumen.profesores}`);
    console.log(`  Estudiantes:        ${resumen.estudiantes}`);
    console.log(`  Ident. estudiante:  ${resumen.identificadoresEstudiante}`);
    console.log(`  Acudientes:         ${resumen.acudientes}`);
    console.log(`  Operadores:         ${resumen.operadores}`);
    console.log(`  Comités:            ${resumen.comites}`);
    console.log(`  Integrantes comité: ${resumen.integrantesComite}`);
    console.log(`  Padres:             ${resumen.padres}`);
    console.log(`  Contactos confianza:${resumen.contactosConfianza}`);
    console.log(`  Ident. contacto:    ${resumen.identificadoresContacto}`);
    console.log(`  Reportes:           ${resumen.reportes} (anónimos ${resumen.reportesAnonimos}, autenticados ${resumen.reportesAutenticados})`);
    console.log(`    Históricos:       ${resumen.reportesHistoricos}`);
    console.log(`    Frescos (motor):  ${resumen.reportesFrescos}`);
    console.log(`  Clasificaciones IA: ${resumen.clasificaciones}`);
    console.log(`  Transiciones:       ${resumen.transiciones}`);
    console.log(`\nCredenciales escritas en: ${credencialesPath}`);
    console.log("Próximo paso: node --env-file=.env --import tsx scripts/demo-prod/procesar-reportes-demo.ts");

    await prisma.$disconnect();
}

main().catch(async (e: unknown) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
