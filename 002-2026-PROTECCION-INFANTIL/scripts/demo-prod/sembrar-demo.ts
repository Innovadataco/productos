#!/usr/bin/env tsx
/**
 * Seed demo de PRODUCCIÓN — subset de prueba para validar purga.
 * Uso:
 *   DEMO_PASSWORD=DemoSeguro2026! node --env-file=.env.test --import tsx scripts/demo-prod/sembrar-demo.ts
 */
import { prisma } from "./lib/prisma";
import { marcarDemo } from "./lib/marcar";
import { auditarDemo } from "./lib/auditar";
import { hashDemoPassword } from "./lib/password";

const CORRIDA = "demo-002-PI-059-test";
const NOW = new Date();
const SIX_MONTHS_AGO = new Date(NOW.getTime() - 180 * 24 * 60 * 60 * 1000);

async function main() {
    const passwordHash = await hashDemoPassword();

    // --- contexto base ---
    const admin = await prisma.usuario.findFirst({ where: { rol: "ADMIN" } });
    if (!admin) throw new Error("No hay usuario ADMIN; correr seed primero");

    const pais = await prisma.pais.findFirst({ where: { codigo: "CO" } });
    const ciudad = await prisma.ciudad.findFirst({ where: { nombre: "Bogotá" } });
    const departamento = await prisma.departamento.findFirst({ where: { nombre: "Bogotá D.C." } });
    const plataforma = await prisma.plataforma.findFirst({ where: { clave: "whatsapp" } });
    if (!pais || !ciudad || !plataforma) throw new Error("Faltan datos base (país/ciudad/plataforma)");

    // --- Colegio + tenant + SCHOOL_ADMIN ---
    const tenant = await prisma.tenant.create({ data: { nombre: "DEMO Tenant Test", estado: "activo" } });
    await marcarDemo("Tenant", tenant.id, { corrida: CORRIDA, script: "sembrar-demo", notas: "tenant de colegio demo" });

    const colegio = await prisma.colegio.create({
        data: {
            nombre: "DEMO Colegio Test",
            paisId: pais.id,
            departamentoId: departamento?.id ?? null,
            ciudadId: ciudad.id,
            representanteLegalNombre: "Demo Representante",
            representanteLegalIdentificacion: "123456789",
            representanteLegalEmail: "soporte+representante_test@innovadataco.com",
            representanteLegalTelefono: "3000000000",
            inicioServicio: new Date("2026-01-01"),
            finServicio: new Date("2026-12-31"),
            tipoPeriodo: "ANUAL",
            estado: "activo",
            tenantId: tenant.id,
        },
    });
    await marcarDemo("Colegio", colegio.id, { corrida: CORRIDA, script: "sembrar-demo" });

    const schoolAdmin = await prisma.usuario.create({
        data: {
            email: "soporte+colegio_test@innovadataco.com",
            nombre: "Demo Rector",
            passwordHash,
            rol: "SCHOOL_ADMIN",
            estado: "activo",
            debeCambiarPassword: false,
            tenantId: tenant.id,
            colegioId: colegio.id,
        },
    });
    await marcarDemo("Usuario", schoolAdmin.id, { corrida: CORRIDA, script: "sembrar-demo", notas: "SCHOOL_ADMIN" });
    await auditarDemo("USER_CREATE", colegio.id, admin.id, colegio.id, { demo: true });

    // --- Profesores y cursos ---
    const cursos: { id: string; nombre: string }[] = [];
    for (let c = 1; c <= 2; c++) {
        const profesor = await prisma.profesor.create({
            data: {
                colegioId: colegio.id,
                nombre: `Demo Profesor ${c}`,
                apellidos: "Test",
                email: `soporte+profesor${c}_test@innovadataco.com`,
                telefono: `300000000${c}`,
                estado: "activo",
            },
        });
        await marcarDemo("Profesor", profesor.id, { corrida: CORRIDA, script: "sembrar-demo" });

        const curso = await prisma.curso.create({
            data: {
                colegioId: colegio.id,
                nombre: `DEMO Curso ${c}`,
                grado: `${5 + c}°`,
                anioLectivo: "2026",
                estado: "activo",
                profesorTitularId: profesor.id,
            },
        });
        await marcarDemo("Curso", curso.id, { corrida: CORRIDA, script: "sembrar-demo" });
        cursos.push({ id: curso.id, nombre: curso.nombre });

        // Estudiantes
        for (let e = 1; e <= 3; e++) {
            const estudiante = await prisma.estudiante.create({
                data: {
                    cursoId: curso.id,
                    colegioId: colegio.id,
                    nombre: `Demo Estudiante ${c}-${e}`,
                    apellidos: "Test",
                    estado: "activo",
                },
            });
            await marcarDemo("Estudiante", estudiante.id, { corrida: CORRIDA, script: "sembrar-demo" });

            const acudiente = await prisma.acudienteEstudiante.create({
                data: {
                    estudianteId: estudiante.id,
                    orden: 1,
                    nombre: `Demo Acudiente ${c}-${e}`,
                    relacion: "madre",
                    telefono: `310000000${e}`,
                },
            });
            await marcarDemo("AcudienteEstudiante", acudiente.id, { corrida: CORRIDA, script: "sembrar-demo" });

            for (let i = 1; i <= 2; i++) {
                const ident = await prisma.identificadorEstudiante.create({
                    data: {
                        estudianteId: estudiante.id,
                        tipo: i === 1 ? "telefono" : "nick",
                        valor: i === 1 ? `300${c}${e}${i}000000` : `demo_nick_${c}_${e}_${i}`,
                        plataformaId: plataforma.id,
                        etiquetaRelacion: "ESTUDIANTE",
                        estado: "activo",
                    },
                });
                await marcarDemo("IdentificadorEstudiante", ident.id, { corrida: CORRIDA, script: "sembrar-demo" });
            }
        }
    }

    // --- OPERADOR ---
    const operador = await prisma.usuario.create({
        data: {
            email: "soporte+operador_test@innovadataco.com",
            nombre: "Demo Operador",
            passwordHash,
            rol: "OPERADOR",
            estado: "activo",
            debeCambiarPassword: false,
        },
    });
    await marcarDemo("Usuario", operador.id, { corrida: CORRIDA, script: "sembrar-demo", notas: "OPERADOR" });
    const perfilOperador = await prisma.perfilOperador.create({
        data: { usuarioId: operador.id, cupoMaximo: 20, esRevisorDeApelaciones: false, esComite: false, creadoPorId: admin.id },
    });
    await marcarDemo("PerfilOperador", perfilOperador.id, { corrida: CORRIDA, script: "sembrar-demo" });

    // --- PARENT ---
    const padre = await prisma.usuario.create({
        data: {
            email: "soporte+padre_test@innovadataco.com",
            nombre: "Demo Padre",
            passwordHash,
            rol: "PARENT",
            estado: "activo",
            debeCambiarPassword: false,
        },
    });
    await marcarDemo("Usuario", padre.id, { corrida: CORRIDA, script: "sembrar-demo", notas: "PARENT" });

    // Círculo de confianza del padre
    const contacto = await prisma.contactoConfianza.create({
        data: { usuarioId: padre.id, etiqueta: "Hija demo", activo: true },
    });
    await marcarDemo("ContactoConfianza", contacto.id, { corrida: CORRIDA, script: "sembrar-demo" });

    const identContacto = await prisma.identificadorContacto.create({
        data: { contactoId: contacto.id, valor: "300111000000", tipo: "telefono", plataformaId: plataforma.id, activo: true },
    });
    await marcarDemo("IdentificadorContacto", identContacto.id, { corrida: CORRIDA, script: "sembrar-demo" });

    // --- Reportes ---
    // Histórico (> 7 días): estado final CLASIFICADO, sin aviso
    const fechaHistorica = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
    const reporteHistorico = await prisma.reporte.create({
        data: {
            identificador: "300111000000",
            plataformaId: plataforma.id,
            texto: "Reporte histórico de demo, ya procesado.",
            fechaIncidente: fechaHistorica,
            ciudad: "Bogotá",
            pais: "Colombia",
            paisId: pais.id,
            ciudadId: ciudad.id,
            estado: "CLASIFICADO",
            esAnonimo: true,
            edadVictima: 12,
            numeroSeguimiento: "RPT-DEMO-HIST-001",
            creadoEn: fechaHistorica,
        },
    });
    await marcarDemo("Reporte", reporteHistorico.id, { corrida: CORRIDA, script: "sembrar-demo", notas: "histórico sin aviso" });
    const clasificacionHistorica = await prisma.clasificacionIA.create({
        data: {
            reporteId: reporteHistorico.id,
            categoria: "CONTACTO_INSISTENTE",
            confianza: 0.85,
            modeloUsado: "gemma2:27b",
            latenciaMs: 1200,
            creadoEn: fechaHistorica,
        },
    });
    await marcarDemo("ClasificacionIA", clasificacionHistorica.id, { corrida: CORRIDA, script: "sembrar-demo", notas: "histórica" });

    const transicionHistorica = await prisma.transicionReporte.create({
        data: {
            reporteId: reporteHistorico.id,
            estadoAnterior: "PENDIENTE",
            estadoNuevo: "CLASIFICADO",
            responsableTipo: "IA",
            creadoEn: fechaHistorica,
        },
    });
    await marcarDemo("TransicionReporte", transicionHistorica.id, { corrida: CORRIDA, script: "sembrar-demo", notas: "histórica" });

    // Fresco (hoy): PENDIENTE para procesar con motor real
    const reporteFresco = await prisma.reporte.create({
        data: {
            identificador: "300222000000",
            plataformaId: plataforma.id,
            texto: "Reporte fresco de demo para procesar con Ollama.",
            fechaIncidente: NOW,
            ciudad: "Bogotá",
            pais: "Colombia",
            paisId: pais.id,
            ciudadId: ciudad.id,
            estado: "PENDIENTE",
            esAnonimo: false,
            usuarioId: padre.id,
            edadVictima: 10,
            numeroSeguimiento: "RPT-DEMO-FRESH-001",
        },
    });
    await marcarDemo("Reporte", reporteFresco.id, { corrida: CORRIDA, script: "sembrar-demo", notas: "fresco para motor" });

    console.log("[sembrar-demo] Subset demo creado:");
    console.log(`  Colegio: ${colegio.id}`);
    console.log(`  SCHOOL_ADMIN: ${schoolAdmin.email}`);
    console.log(`  OPERADOR: ${operador.email}`);
    console.log(`  PARENT: ${padre.email}`);
    console.log(`  Reportes: histórico ${reporteHistorico.id}, fresco ${reporteFresco.id}`);
    console.log("\nPróximo paso: node --env-file=.env.test --import tsx scripts/demo-prod/verificar-purga.ts --antes");

    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
