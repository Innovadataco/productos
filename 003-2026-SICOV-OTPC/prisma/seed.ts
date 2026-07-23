// Seed DEMO (no dump real). Idempotente. Datos mínimos para ejercitar la P1 en modo stub.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const NIT_VIGILADO = "900853057";

/// Upsert de módulo POR NOMBRE (los ids son serial; nunca se hardcodean — I1/ZEUS-006).
async function upsertModuloPorNombre(m: {
  nombre: string;
  nombreMostrar: string;
  ruta: string;
  icono: string;
  orden: number;
}) {
  const existe = await prisma.modulo.findFirst({ where: { nombre: m.nombre } });
  if (existe) return prisma.modulo.update({ where: { id: existe.id }, data: { ...m, estado: true } });
  return prisma.modulo.create({ data: { ...m, estado: true } });
}

/// Upsert de submódulo POR NOMBRE bajo su módulo padre (idempotente).
async function upsertSubmoduloPorNombre(
  moduloId: number,
  s: { nombre: string; nombreMostrar: string; ruta?: string },
) {
  const existe = await prisma.submodulo.findFirst({ where: { nombre: s.nombre, moduloId } });
  if (existe) return prisma.submodulo.update({ where: { id: existe.id }, data: { ...s, moduloId, estado: true } });
  return prisma.submodulo.create({ data: { ...s, moduloId, estado: true } });
}

async function main() {
  // Roles con ids canónicos 1/2/3 (el rol 9 no existe en el sistema real).
  const roles = [
    { id: 1, nombre: "administrador", root: true },
    { id: 2, nombre: "cliente", root: false },
    { id: 3, nombre: "operador", root: false },
  ];
  for (const r of roles) {
    await prisma.rol.upsert({
      where: { id: r.id },
      update: { nombre: r.nombre, estado: true, root: r.root },
      create: { id: r.id, nombre: r.nombre, estado: true, root: r.root },
    });
  }

  // Módulos del menú data-driven — catálogo COMPLETO D-018: los 5 asignables del legacy
  // (Usuarios, Novedades, Mantenimientos, Autorizaciones, Alistamientos) MÁS Salidas y Llegadas.
  const modulos = [
    { id: 1, nombre: "inicio", nombreMostrar: "Inicio", ruta: "/dashboard", icono: "bi-house-door", orden: 1 },
    { id: 2, nombre: "salidas", nombreMostrar: "Salidas", ruta: "/dashboard/salidas", icono: "bi-box-arrow-right", orden: 2 },
    { id: 3, nombre: "llegadas", nombreMostrar: "Llegadas", ruta: "/dashboard/llegadas", icono: "bi-box-arrow-in-down", orden: 3 },
    { id: 4, nombre: "mantenimientos", nombreMostrar: "Mantenimientos", ruta: "/dashboard/mantenimientos", icono: "bi-tools", orden: 4 },
    { id: 5, nombre: "alistamientos", nombreMostrar: "Alistamientos", ruta: "/dashboard/alistamientos", icono: "bi-clipboard-check", orden: 5 },
    { id: 6, nombre: "autorizaciones", nombreMostrar: "Autorizaciones", ruta: "/dashboard/autorizaciones", icono: "bi-person-check", orden: 6 },
    { id: 7, nombre: "novedades", nombreMostrar: "Novedades", ruta: "/dashboard/novedades", icono: "bi-exclamation-triangle", orden: 7 },
    { id: 8, nombre: "usuarios", nombreMostrar: "Usuarios", ruta: "/dashboard/usuarios", icono: "bi-people", orden: 8 },
  ];
  for (const m of modulos) {
    await prisma.modulo.upsert({
      where: { id: m.id },
      update: { ...m, estado: true },
      create: { ...m, estado: true },
    });
  }

  // Los módulos base se insertan con id EXPLÍCITO (1-8), lo que NO avanza la secuencia serial;
  // realineamos antes de crear `configuracion` sin id para evitar colisión de PK.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('sicov.tbl_modulos','mod_id'), COALESCE((SELECT MAX(mod_id) FROM sicov.tbl_modulos), 1))`,
  );

  // Módulo Configuración (spec 009) + submódulos — SEMBRADOS Y RESUELTOS POR NOMBRE (I1/ZEUS-006):
  // los ids son serial; nunca se hardcodean. `configuracion` es solo de rol 1.
  await upsertModuloPorNombre({
    nombre: "configuracion",
    nombreMostrar: "Configuración",
    ruta: "/dashboard/configuracion",
    icono: "bi-gear",
    orden: 9,
  });

  // Submódulos por nombre bajo su módulo padre. `configuracion` (empresas/apis 013) y
  // `mantenimientos` (preventivos/correctivos, guard D-017 extendido). El resto es CATÁLOGO
  // asignable SIN pantalla (006/007/008): solo nombres, cero lógica.
  const submodulosPorModulo: { modulo: string; submodulos: { nombre: string; nombreMostrar: string; ruta?: string }[] }[] = [
    { modulo: "configuracion", submodulos: [
      { nombre: "empresas", nombreMostrar: "Empresas", ruta: "/dashboard/configuracion/empresas" },
      { nombre: "apis", nombreMostrar: "APIs", ruta: "/dashboard/configuracion/apis" },
    ] },
    { modulo: "mantenimientos", submodulos: [
      { nombre: "preventivos", nombreMostrar: "Preventivos" },
      { nombre: "correctivos", nombreMostrar: "Correctivos" },
    ] },
    { modulo: "alistamientos", submodulos: [{ nombre: "alistamiento-diario", nombreMostrar: "Alistamiento diario" }] },
    { modulo: "autorizaciones", submodulos: [{ nombre: "autorizaciones-nna", nombreMostrar: "Autorizaciones NNA" }] },
    { modulo: "novedades", submodulos: [{ nombre: "novedades-registro", nombreMostrar: "Novedades" }] },
  ];
  for (const grupo of submodulosPorModulo) {
    const mod = await prisma.modulo.findFirst({ where: { nombre: grupo.modulo } });
    if (!mod) continue;
    for (const s of grupo.submodulos) await upsertSubmoduloPorNombre(mod.id, s);
  }

  // roles_modulos (I-13 + D-017/D-018, HANDOFF §10.1/§10.8): el rol 1 (administrador de
  // plataforma) ve Inicio + Configuración + Usuarios (spec 009, resueltos por NOMBRE). Roles 2 y 3
  // reciben los módulos operativos ya construidos; el resto del catálogo se asigna cuando llegue su
  // spec. El bloqueo real es el guard server-side (D-017).
  const modConfig = await prisma.modulo.findFirst({ where: { nombre: "configuracion" } });
  const modUsuarios = await prisma.modulo.findFirst({ where: { nombre: "usuarios" } });
  const rol1 = [1, modUsuarios?.id, modConfig?.id].filter((x): x is number => typeof x === "number");
  const modulosPorRol: Record<number, number[]> = { 1: rol1, 2: [1, 2, 3, 4], 3: [1, 2, 3, 4] };
  for (const [rol, moduloIds] of Object.entries(modulosPorRol)) {
    const rolId = Number(rol);
    // Sincroniza: retira asignaciones semilla que ya no correspondan (p. ej. salidas para rol 1).
    await prisma.rolModulo.deleteMany({ where: { rolId, moduloId: { notIn: moduloIds } } });
    for (const moduloId of moduloIds) {
      const existe = await prisma.rolModulo.findFirst({ where: { rolId, moduloId } });
      if (!existe) await prisma.rolModulo.create({ data: { rolId, moduloId } });
    }
  }

  // Tipos de mantenimiento (catálogo real; 005 opera 1 y 2).
  const tiposMantenimiento = [
    { id: 1, nombre: "Preventivo" },
    { id: 2, nombre: "Correctivo" },
    { id: 3, nombre: "Alistamiento" },
    { id: 4, nombre: "Autorización" },
  ];
  for (const t of tiposMantenimiento) {
    await prisma.tipoMantenimiento.upsert({
      where: { id: t.id },
      update: { nombre: t.nombre, estado: true },
      create: { id: t.id, nombre: t.nombre, estado: true },
    });
  }

  // Usuarios demo (claves cumplen la política).
  const admin = await prisma.usuario.upsert({
    where: { usuario: "admin" },
    update: {},
    create: {
      nombre: "Administrador Demo",
      usuario: "admin",
      identificacion: "800000001",
      clave: await bcrypt.hash("Admin123!", 12),
      claveTemporal: false,
      correo: "admin@sicov.local",
      rolId: 1,
      estado: true,
    },
  });

  const vigilado = await prisma.usuario.upsert({
    where: { usuario: "vigilado" },
    update: { tokenAutorizado: "TOKEN-VIGILADO-DEMO", identificacion: NIT_VIGILADO },
    create: {
      nombre: "Empresa Vigilada Demo",
      usuario: "vigilado",
      identificacion: NIT_VIGILADO,
      clave: await bcrypt.hash("Vigilado123!", 12),
      claveTemporal: false,
      correo: "vigilado@sicov.local",
      tokenAutorizado: "TOKEN-VIGILADO-DEMO",
      rolId: 2,
      estado: true,
    },
  });

  // Subusuario rol 3: hereda token+NIT del administrador (usn_administrador = identificación del vigilado).
  await prisma.usuario.upsert({
    where: { usuario: "operador" },
    update: { administradorId: Number(NIT_VIGILADO) },
    create: {
      nombre: "Operador Demo",
      usuario: "operador",
      identificacion: "1010101010",
      clave: await bcrypt.hash("Operador123!", 12),
      claveTemporal: false,
      correo: "operador@sicov.local",
      rolId: 3,
      administradorId: Number(NIT_VIGILADO),
      estado: true,
    },
  });

  // Proveedor vigilado con contrato vigente.
  const hoy = new Date();
  const inicio = new Date(hoy.getTime() - 30 * 86_400_000);
  const fin = new Date(hoy.getTime() + 365 * 86_400_000);
  const provExiste = await prisma.proveedorVigilado.findFirst({ where: { documento: NIT_VIGILADO } });
  if (!provExiste) {
    await prisma.proveedorVigilado.create({
      data: {
        empresa: "Transportes Demo S.A.S.",
        vigilado: NIT_VIGILADO,
        documento: NIT_VIGILADO,
        token: "11111111-1111-1111-1111-111111111111",
        estado: true,
        fechaInicial: inicio,
        fechaFinal: fin,
        ruta: "Bogotá - Medellín",
      },
    });
  }

  // Despachos demo (varios estados) si no hay ninguno.
  const totalDesp = await prisma.despachoSolicitud.count();
  if (totalDesp === 0) {
    const payloadBase = {
      obj_despacho: { nitEmpresaTransporte: NIT_VIGILADO, fechaSalida: "2026-07-21", horaSalida: "08:00" },
      obj_vehiculo: { placa: "ABC123" },
      obj_conductores: { principal: { numeroIdentificacion: "123456" } },
      obj_rutas: { idRutaAutorizada: "1" },
    };
    await prisma.despachoSolicitud.createMany({
      data: [
        { payload: payloadBase, nitVigilado: NIT_VIGILADO, usuarioId: NIT_VIGILADO, rolId: 2, estado: "pendiente", procesado: false },
        { payload: { ...payloadBase, obj_vehiculo: { placa: "XYZ789" } }, nitVigilado: NIT_VIGILADO, usuarioId: NIT_VIGILADO, rolId: 2, estado: "procesado", procesado: true, idDespachoExterno: 5001 },
        { payload: { ...payloadBase, obj_vehiculo: { placa: "FALLA01" } }, nitVigilado: NIT_VIGILADO, usuarioId: NIT_VIGILADO, rolId: 2, estado: "fallido", procesado: false, reintentos: 3, errorExterno: "Fallo simulado" },
      ],
    });
  }

  // Llegadas demo (varios estados) si no hay ninguna.
  const totalLleg = await prisma.llegadaSolicitud.count();
  if (totalLleg === 0) {
    const baseLleg = {
      idTipollegada: "2",
      nitEmpresaTransporte: NIT_VIGILADO,
      terminalLlegada: "Terminal Medellín",
      numeroPasajero: "0",
      horaLlegada: "12:00",
      fechaLlegada: "2026-07-21",
      sede: "0",
    };
    await prisma.llegadaSolicitud.createMany({
      data: [
        { payload: { ...baseLleg, placa: "ABC123" }, nitVigilado: NIT_VIGILADO, usuarioId: NIT_VIGILADO, rolId: 2, tipoLlegada: 2, placa: "ABC123", estado: "pendiente", procesado: false },
        { payload: { ...baseLleg, placa: "XYZ789" }, nitVigilado: NIT_VIGILADO, usuarioId: NIT_VIGILADO, rolId: 2, tipoLlegada: 2, placa: "XYZ789", estado: "procesado", procesado: true, idLlegadaExterno: 7001 },
      ],
    });
  }

  // Mantenimientos demo (base procesado con detalle + 1 job fallido para corregir-y-reenviar).
  const totalMant = await prisma.mantenimiento.count();
  if (totalMant === 0) {
    const basePrev = await prisma.mantenimiento.create({
      data: {
        placa: "ABC123",
        tipoId: 1,
        usuarioId: BigInt(NIT_VIGILADO),
        fechaDiligenciamiento: new Date(),
        estado: true,
        procesado: true,
        mantenimientoIdExterno: 9001,
      },
    });
    await prisma.preventivo.create({
      data: {
        placa: "ABC123",
        fecha: new Date("2026-07-20"),
        hora: "08:30",
        nit: BigInt("900555444"),
        razonSocial: "Taller Demo S.A.S.",
        tipoIdentificacion: 1,
        numeroIdentificacion: "1010",
        nombresResponsable: "Ingeniero Demo",
        mantenimientoId: basePrev.id,
        mantenimientoIdExterno: 9001,
        detalleActividades: "Cambio de aceite y filtros",
        procesado: true,
      },
    });
    const baseFallido = await prisma.mantenimiento.create({
      data: {
        placa: "FAL999",
        tipoId: 2,
        usuarioId: BigInt(NIT_VIGILADO),
        fechaDiligenciamiento: new Date(),
        estado: true,
        procesado: false,
      },
    });
    await prisma.mantenimientoJob.create({
      data: {
        tipo: "base",
        mantenimientoLocalId: baseFallido.id,
        vigiladoId: NIT_VIGILADO,
        usuarioDocumento: NIT_VIGILADO,
        rolId: 2,
        estado: "fallido",
        reintentos: 3,
        ultimoError: "Fallo simulado por el stub",
        payload: { vigiladoId: NIT_VIGILADO, placa: "FAL999", tipoId: 2 },
      },
    });
  }

  console.log(`Seed OK — admin=${admin.id}, vigilado=${vigilado.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
