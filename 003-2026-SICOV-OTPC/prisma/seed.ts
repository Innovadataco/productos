// Seed DEMO (no dump real). Idempotente. Datos mínimos para ejercitar la P1 en modo stub.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const NIT_VIGILADO = "900853057";

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

  // Módulos del menú data-driven.
  const modulos = [
    { id: 1, nombre: "inicio", nombreMostrar: "Inicio", ruta: "/dashboard", icono: "bi-house-door", orden: 1 },
    { id: 2, nombre: "salidas", nombreMostrar: "Salidas", ruta: "/dashboard/salidas", icono: "bi-box-arrow-right", orden: 2 },
  ];
  for (const m of modulos) {
    await prisma.modulo.upsert({
      where: { id: m.id },
      update: { ...m, estado: true },
      create: { ...m, estado: true },
    });
  }

  // roles_modulos: los 3 roles ven Inicio y Salidas.
  for (const rolId of [1, 2, 3]) {
    for (const moduloId of [1, 2]) {
      const existe = await prisma.rolModulo.findFirst({ where: { rolId, moduloId } });
      if (!existe) await prisma.rolModulo.create({ data: { rolId, moduloId } });
    }
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

  console.log(`Seed OK — admin=${admin.id}, vigilado=${vigilado.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
