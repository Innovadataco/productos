#!/usr/bin/env node
/**
 * Set de datos de DEMOSTRACIÓN del módulo Proyectos y del tablero de
 * Oportunidades (radicado 001-IDC-016). NO es una spec: no cambia el producto,
 * solo puebla la BD para que el CEO valide SPEC-007/008/012/014/015/016.
 *
 * REGLAS (esto va a la BD viva del CEO):
 *
 *   1. Todo lo sembrado queda MARCADO y es REVERSIBLE (D-039):
 *        · proyectos con `codigo` que empieza por  DEMO-
 *        · oportunidades con `numero` que empieza por  DEMO-
 *      Nada más lleva esa marca, así que se puede borrar sin tocar lo real.
 *
 *   2. Reversible con precisión:
 *        node scripts/seed-demo.mjs            → limpia lo DEMO- y resiembra
 *        node scripts/seed-demo.mjs --limpiar  → SOLO borra lo DEMO-
 *      El borrado es siempre por la marca; nunca un `deleteMany()` global.
 *
 *   3. Idempotente: sembrar arranca limpiando lo DEMO-, así que correrlo dos
 *      veces no duplica. Borrar un proyecto DEMO- se lleva en CASCADE sus
 *      entregables, hitos, partidas, recursos, riesgos y lecciones.
 *
 *   4. NO toca la Base Oficial (documentos/embeddings): el RAG no entra aquí.
 *
 * Los catálogos (tipos de oportunidad, estados, entidades) NO se inventan: se
 * usan los ids que ya existen en la BD (verificados contra el esquema real).
 */

import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, "../.env.local") });
loadEnv({ path: join(__dirname, "../.env") });

const prisma = new PrismaClient();
const SOLO_LIMPIAR = process.argv.includes("--limpiar");

// Fechas ancladas a "hoy" real: el set cae siempre alrededor de la fecha en que
// se ejecuta, no en un 1970 fuera de la ventana visible del Gantt.
const HOY = new Date();
HOY.setHours(0, 0, 0, 0);
const dias = (n) => {
  const d = new Date(HOY);
  d.setDate(d.getDate() + n);
  return d;
};

/** Borra SOLO lo marcado DEMO-. Devuelve los conteos borrados. */
async function limpiarDemo() {
  // Oportunidades: por su `numero` DEMO-.
  const lics = await prisma.licitacion.deleteMany({ where: { numero: { startsWith: "DEMO-" } } });
  // Proyectos: por su `codigo` DEMO-. La FK CASCADE se lleva entregables,
  // hitos, partidas, recursos, riesgos y lecciones asociados.
  const prys = await prisma.proyecto.deleteMany({ where: { codigo: { startsWith: "DEMO-" } } });
  return { licitaciones: lics.count, proyectos: prys.count };
}

/**
 * Cuatro proyectos, uno por fase PM². Cada uno con sus colecciones creadas de
 * forma anidada. Los avances mezclan 0/30/60/100 para que la cartera calcule un
 * agregado no trivial y el Gantt muestre barras a distintos rellenos.
 */
function definicionProyectos() {
  return [
    {
      codigo: "DEMO-P01",
      nombre: "Portal de Trámites Ciudadanos",
      cliente: "Alcaldía de Medellín",
      estado: "active",
      currentPhase: "initiation",
      entregables: [
        { nombre: "Levantamiento de requisitos", avance: 30, estado: "en curso", responsable: "Ana Ríos", fechaInicio: dias(-5), fechaCompromiso: dias(10) },
        { nombre: "Estudio de viabilidad", avance: 0, estado: "pendiente", responsable: "Carlos Peña", fechaInicio: dias(8), fechaCompromiso: dias(25) },
      ],
      hitos: [
        { nombre: "Kickoff del proyecto", fecha: dias(-3) },
        { nombre: "Aprobación de alcance", fecha: dias(20) },
      ],
      partidas: [
        { concepto: "Consultoría inicial", montoPlaneado: 18000000, montoEjecutado: 5000000 },
        { concepto: "Licencias de software", montoPlaneado: 6000000, montoEjecutado: 0 },
      ],
      recursos: [
        { nombre: "Ana Ríos", rol: "Analista líder", tipo: "humano", costo: 8000000, disponibilidad: "Tiempo completo" },
        { nombre: "Servidor de pruebas", rol: "", tipo: "material", costo: 1200000, disponibilidad: "Mensual" },
      ],
      riesgos: [
        { descripcion: "Requisitos poco claros del cliente", probabilidad: "alta", impacto: "alto", mitigacion: "Talleres de refinamiento semanales", estado: "abierto" },
        { descripcion: "Retraso en la firma del acta", probabilidad: "media", impacto: "medio", mitigacion: "Seguimiento con la secretaría", estado: "mitigado" },
      ],
      lecciones: [],
    },
    {
      codigo: "DEMO-P02",
      nombre: "Sistema de Gestión Documental",
      cliente: "Gobernación de Antioquia",
      estado: "active",
      currentPhase: "planning",
      entregables: [
        // Cadena de dependencia con CONFLICTO: "Diseño" termina (dias 22) después
        // de que empieza "Desarrollo módulo 1" (dias 15). El Gantt lo marca en rojo.
        { nombre: "Diseño de arquitectura", avance: 60, estado: "en curso", responsable: "Laura Gómez", fechaInicio: dias(-2), fechaCompromiso: dias(22) },
        { nombre: "Desarrollo módulo 1", avance: 0, estado: "pendiente", responsable: "Diego Mora", fechaInicio: dias(15), fechaCompromiso: dias(40) },
        { nombre: "Plan de pruebas", avance: 30, estado: "en curso", responsable: "Laura Gómez", fechaInicio: dias(5), fechaCompromiso: dias(30) },
      ],
      hitos: [
        { nombre: "Revisión de diseño", fecha: dias(-1) },
        { nombre: "Fin de planeación", fecha: dias(12), fechaFin: dias(18) },
      ],
      partidas: [
        { concepto: "Equipo de desarrollo", montoPlaneado: 45000000, montoEjecutado: 12000000 },
        { concepto: "Infraestructura cloud", montoPlaneado: 9000000, montoEjecutado: 9500000 },
      ],
      recursos: [
        { nombre: "Laura Gómez", rol: "Arquitecta", tipo: "humano", costo: 12000000, disponibilidad: "Tiempo completo" },
        { nombre: "Diego Mora", rol: "Desarrollador", tipo: "humano", costo: 9000000, disponibilidad: "Tiempo completo" },
      ],
      riesgos: [
        { descripcion: "Dependencia crítica entre módulos", probabilidad: "alta", impacto: "alto", mitigacion: "Desacoplar por interfaces", estado: "abierto" },
        { descripcion: "Sobrecosto en infraestructura", probabilidad: "media", impacto: "medio", mitigacion: "Revisar dimensionamiento", estado: "abierto" },
        { descripcion: "Rotación de personal", probabilidad: "baja", impacto: "alto", mitigacion: "Documentar decisiones", estado: "mitigado" },
      ],
      lecciones: [],
      // Se resuelve tras crear: "Desarrollo módulo 1" depende de "Diseño de arquitectura".
      dependencia: { de: "Desarrollo módulo 1", dependeDe: "Diseño de arquitectura" },
    },
    {
      codigo: "DEMO-P03",
      nombre: "Plataforma de Datos Abiertos",
      cliente: "MinTIC",
      estado: "active",
      currentPhase: "execution",
      entregables: [
        { nombre: "Ingesta de fuentes", avance: 100, estado: "entregado", responsable: "Sofía Ruiz", fechaInicio: dias(-30), fechaCompromiso: dias(-5) },
        { nombre: "Catálogo de datasets", avance: 60, estado: "en curso", responsable: "Sofía Ruiz", fechaInicio: dias(-10), fechaCompromiso: dias(15) },
        { nombre: "Portal público", avance: 30, estado: "en curso", responsable: "Julián Vera", fechaInicio: dias(0), fechaCompromiso: dias(35) },
        { nombre: "Documentación de API", avance: 0, estado: "pendiente", responsable: "Julián Vera", fechaInicio: dias(20), fechaCompromiso: dias(45) },
      ],
      hitos: [
        { nombre: "Primera entrega", fecha: dias(-6) },
        { nombre: "Demo al cliente", fecha: dias(16) },
        { nombre: "Ventana de estabilización", fecha: dias(30), fechaFin: dias(45) },
      ],
      partidas: [
        { concepto: "Desarrollo", montoPlaneado: 60000000, montoEjecutado: 38000000 },
        { concepto: "Datos y APIs externas", montoPlaneado: 15000000, montoEjecutado: 11000000 },
        { concepto: "Soporte", montoPlaneado: 8000000, montoEjecutado: 2000000 },
      ],
      recursos: [
        { nombre: "Sofía Ruiz", rol: "Ingeniera de datos", tipo: "humano", costo: 11000000, disponibilidad: "Tiempo completo" },
        { nombre: "Julián Vera", rol: "Full-stack", tipo: "humano", costo: 10000000, disponibilidad: "Tiempo completo" },
        { nombre: "Clúster de procesamiento", rol: "", tipo: "material", costo: 4000000, disponibilidad: "Mensual" },
      ],
      riesgos: [
        { descripcion: "Calidad dispar de las fuentes", probabilidad: "alta", impacto: "medio", mitigacion: "Validación automática de esquemas", estado: "abierto" },
        { descripcion: "Cambios en la API de un tercero", probabilidad: "media", impacto: "alto", mitigacion: "Capa de adaptación", estado: "abierto" },
        { descripcion: "Pico de carga en el lanzamiento", probabilidad: "baja", impacto: "medio", mitigacion: "Prueba de carga previa", estado: "cerrado" },
      ],
      lecciones: [],
    },
    {
      codigo: "DEMO-P04",
      nombre: "Modernización de Redes",
      cliente: "EPM",
      estado: "active",
      currentPhase: "closing",
      entregables: [
        { nombre: "Migración de nodos", avance: 100, estado: "entregado", responsable: "Marcela Díaz", fechaInicio: dias(-60), fechaCompromiso: dias(-20) },
        { nombre: "Pruebas de aceptación", avance: 100, estado: "entregado", responsable: "Marcela Díaz", fechaInicio: dias(-25), fechaCompromiso: dias(-5) },
        { nombre: "Acta de cierre", avance: 60, estado: "en curso", responsable: "Andrés Lopera", fechaInicio: dias(-4), fechaCompromiso: dias(6) },
      ],
      hitos: [
        { nombre: "Corte de servicio programado", fecha: dias(-22) },
        { nombre: "Cierre formal", fecha: dias(7) },
      ],
      partidas: [
        { concepto: "Obra e instalación", montoPlaneado: 80000000, montoEjecutado: 79000000 },
        { concepto: "Contingencia", montoPlaneado: 10000000, montoEjecutado: 3000000 },
      ],
      recursos: [
        { nombre: "Marcela Díaz", rol: "Ingeniera de redes", tipo: "humano", costo: 13000000, disponibilidad: "Tiempo completo" },
        { nombre: "Equipos de conmutación", rol: "", tipo: "material", costo: 25000000, disponibilidad: "Adquirido" },
      ],
      riesgos: [
        { descripcion: "Ventana de mantenimiento insuficiente", probabilidad: "media", impacto: "alto", mitigacion: "Plan de reversión ensayado", estado: "cerrado" },
        { descripcion: "Incompatibilidad de equipos legados", probabilidad: "baja", impacto: "medio", mitigacion: "Inventario previo", estado: "mitigado" },
      ],
      lecciones: [
        { descripcion: "Las ventanas de corte deben negociarse con 3 semanas de antelación", categoria: "Planeación", impacto: "alto" },
        { descripcion: "El plan de reversión ensayado evitó un incidente en producción", categoria: "Calidad", impacto: "alto" },
      ],
    },
  ];
}

/**
 * Seis oportunidades de tipos distintos y repartidas en varias columnas de
 * estado, para que el tablero Kanban tenga tarjetas en más de una columna.
 * Catálogos reales: tipos 1/2/3, estados 1..5 (verificados contra la BD).
 */
function definicionOportunidades() {
  return [
    { numero: "DEMO-O01", titulo: "Suministro de equipos de cómputo", tipoId: 1, estadoId: 1, entidadId: 3, ciudadEjecucion: "Bogotá", fechaApertura: dias(-10) },
    { numero: "DEMO-O02", titulo: "Consultoría en transformación digital", tipoId: 2, estadoId: 2, entidadId: 5, ciudadEjecucion: "Medellín", fechaApertura: dias(-4) },
    { numero: "DEMO-O03", titulo: "Mantenimiento de infraestructura vial", tipoId: 1, estadoId: 1, entidadId: 8, ciudadEjecucion: "Cali", fechaApertura: dias(-2) },
    { numero: "DEMO-O04", titulo: "Servicios de conectividad rural", tipoId: 3, estadoId: 4, entidadId: 3, ciudadEjecucion: "Pasto", fechaApertura: dias(-25) },
    { numero: "DEMO-O05", titulo: "Estudio de impacto ambiental", tipoId: 2, estadoId: 3, entidadId: 6, ciudadEjecucion: "Barranquilla", fechaApertura: dias(-40) },
    { numero: "DEMO-O06", titulo: "Adquisición de software de gestión", tipoId: 1, estadoId: 2, entidadId: 5, ciudadEjecucion: "Bogotá", fechaApertura: dias(-1) },
  ];
}

async function sembrar() {
  const resumen = {
    proyectos: 0, entregables: 0, hitos: 0, partidas: 0, recursos: 0, riesgos: 0, lecciones: 0, oportunidades: 0,
  };

  for (const p of definicionProyectos()) {
    const creado = await prisma.proyecto.create({
      data: {
        codigo: p.codigo,
        nombre: p.nombre,
        cliente: p.cliente,
        estado: p.estado,
        currentPhase: p.currentPhase,
        entregables: { create: p.entregables },
        hitos: { create: p.hitos },
        partidas: { create: p.partidas },
        recursos: { create: p.recursos },
        riesgos: { create: p.riesgos },
        lecciones: { create: p.lecciones },
      },
      include: { entregables: true },
    });

    resumen.proyectos += 1;
    resumen.entregables += p.entregables.length;
    resumen.hitos += p.hitos.length;
    resumen.partidas += p.partidas.length;
    resumen.recursos += p.recursos.length;
    resumen.riesgos += p.riesgos.length;
    resumen.lecciones += p.lecciones.length;

    // Dependencia del Gantt: se resuelve ahora que los entregables tienen id.
    if (p.dependencia) {
      const dependiente = creado.entregables.find((e) => e.nombre === p.dependencia.de);
      const predecesor = creado.entregables.find((e) => e.nombre === p.dependencia.dependeDe);
      if (dependiente && predecesor) {
        await prisma.entregable.update({
          where: { id: dependiente.id },
          data: { dependeDe: `entregable:${predecesor.id}` },
        });
      }
    }
  }

  for (const o of definicionOportunidades()) {
    await prisma.licitacion.create({ data: o });
    resumen.oportunidades += 1;
  }

  return resumen;
}

async function main() {
  console.log(`[seed-demo] Base: ${process.env.DATABASE_URL?.split("@")[1] ?? "?"}`);

  const borrado = await limpiarDemo();
  console.log(`[seed-demo] Limpieza de lo DEMO-: ${borrado.proyectos} proyecto(s), ${borrado.licitaciones} oportunidad(es).`);

  if (SOLO_LIMPIAR) {
    console.log("[seed-demo] --limpiar: no se siembra nada. Base devuelta a su estado sin DEMO-.");
    return;
  }

  const r = await sembrar();
  console.log("[seed-demo] Sembrado:");
  console.log(`  proyectos      ${r.proyectos}`);
  console.log(`  entregables    ${r.entregables}`);
  console.log(`  hitos          ${r.hitos}`);
  console.log(`  partidas       ${r.partidas}`);
  console.log(`  recursos       ${r.recursos}`);
  console.log(`  riesgos        ${r.riesgos}`);
  console.log(`  lecciones      ${r.lecciones}`);
  console.log(`  oportunidades  ${r.oportunidades}`);
  console.log("[seed-demo] Listo. Para revertir: node scripts/seed-demo.mjs --limpiar");
}

main()
  .catch((err) => {
    console.error("[seed-demo] Error:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
