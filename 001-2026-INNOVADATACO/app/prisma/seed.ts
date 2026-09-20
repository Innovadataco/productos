import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Usuarios base
  const jelkin = await prisma.user.upsert({
    where: { email: "jelkin@innovadataco.com" },
    update: {},
    create: {
      email: "jelkin@innovadataco.com",
      nombre: "Jelkin",
      rol: "ADMIN",
    },
  });

  const andrea = await prisma.user.upsert({
    where: { email: "andrea@innovadataco.com" },
    update: {},
    create: {
      email: "andrea@innovadataco.com",
      nombre: "Andrea",
      rol: "PROJECT_MANAGER",
    },
  });

  // Clientes base
  const pgn = await prisma.cliente.upsert({
    where: { nit: "899.999.001-1" },
    update: {},
    create: {
      nombre: "Procuraduría General de la Nación",
      nit: "899.999.001-1",
      tipo: "PUBLICO",
      contacto: "Director de Sistemas",
      email: "sistemas@pgn.gov.co",
    },
  });

  const otpc = await prisma.cliente.upsert({
    where: { nit: "899.999.002-2" },
    update: {},
    create: {
      nombre: "OTPC",
      nit: "899.999.002-2",
      tipo: "PUBLICO",
      contacto: "Coordinador TI",
      email: "ti@otpc.gov.co",
    },
  });

  const supertransporte = await prisma.cliente.upsert({
    where: { nit: "899.999.003-3" },
    update: {},
    create: {
      nombre: "Supertransporte",
      nit: "899.999.003-3",
      tipo: "PUBLICO",
      contacto: "Subdirección TI",
      email: "ti@supertransporte.gov.co",
    },
  });

  // Oportunidades de ejemplo
  await prisma.oportunidad.upsert({
    where: { codigo: "OPP-2026-001" },
    update: {},
    create: {
      codigo: "OPP-2026-001",
      nombre: "Portal de Transparencia PGN",
      modalidad: "CONTRATACION_DIRECTA",
      entidadContratante: "Procuraduría General de la Nación",
      estado: "PRESENTADA",
      valorEstimado: 180000000,
      fechaInicioPlaneada: new Date("2026-10-01"),
      fechaFinPlaneada: new Date("2026-12-15"),
      alcance: "Desarrollo de portal de transparencia con consulta pública y panel administrativo.",
      clienteId: pgn.id,
      responsableId: jelkin.id,
    },
  });

  await prisma.oportunidad.upsert({
    where: { codigo: "OPP-2026-002" },
    update: {},
    create: {
      codigo: "OPP-2026-002",
      nombre: "SICOV OTPC Fase 2",
      modalidad: "SUBASTA_INVERSA",
      entidadContratante: "OTPC",
      estado: "ADJUDICADA",
      valorEstimado: 95000000,
      fechaInicioPlaneada: new Date("2026-10-15"),
      fechaFinPlaneada: new Date("2027-03-30"),
      alcance: "Segunda fase del sistema de convocatorias OTPC.",
      clienteId: otpc.id,
      responsableId: andrea.id,
    },
  });

  await prisma.oportunidad.upsert({
    where: { codigo: "OPP-2026-003" },
    update: {},
    create: {
      codigo: "OPP-2026-003",
      nombre: "Sistema de Denuncias Anónimas",
      modalidad: "LICITACION",
      entidadContratante: "Supertransporte",
      estado: "IDENTIFICADA",
      valorEstimado: 210000000,
      fechaInicioPlaneada: new Date("2026-11-01"),
      fechaFinPlaneada: new Date("2027-05-30"),
      alcance: "Plataforma para recepción y gestión de denuncias anónimas.",
      clienteId: supertransporte.id,
      responsableId: jelkin.id,
    },
  });

  console.log("Seed completado.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
