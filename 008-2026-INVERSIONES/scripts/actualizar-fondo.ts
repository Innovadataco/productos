/**
 * Valor de unidad diario de los fondos (FIC) desde la SFC (datos.gov.co, qhpu-8ixx).
 *   npx tsx scripts/actualizar-fondo.ts [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD]   (por defecto, los últimos 10 días)
 *   npx tsx scripts/actualizar-fondo.ts --registrar --codigo <codigo_negocio> [--participacion <tipo_participacion>] --nombre "<nombre>"
 * Imprime solo conteos, códigos, el id interno del fondo y la fecha de su último dato; nunca el
 * código de negocio, el nombre ni valores. Consulta un servicio externo: solo desde la máquina del dueño o el servidor.
 * Salida: 0 bien · 1 error inesperado o registro rechazado · 2 argumentos inválidos · 3 fondo con
 * fallo, dato atrasado o ningún fondo registrado.
 */
import { PrismaClient } from "@prisma/client";
import { actualizarFondo, DIAS_ATRASO_AVISO, type ResultadoFondo } from "../src/fondo/actualizar";
import { interpretarArgumentos } from "../src/fondo/argumentos";
import { ErrorRegistroFondo, registrarFondo, type DatosRegistroFondo } from "../src/fondo/registrar";
import { isoDia } from "../src/fondo/sfc";
import { detalleDeError } from "../src/precios/actualizar";

async function registrar(db: PrismaClient, datos: DatosRegistroFondo, hoy: Date): Promise<void> {
  try {
    const r = await registrarFondo(db, datos, hoy);
    console.log(`✅ Fondo ${r.instrumentoId} · ${r.fondoCreado ? "creado" : "ya existía"} · clase: ${r.clase.replace("_", " ")}`);
  } catch (e) {
    console.error(`❌ No se registró el fondo: ${e instanceof ErrorRegistroFondo ? e.codigo : `ERROR_BASE · ${detalleDeError(e)}`}`);
    process.exitCode = 1;
  }
}

function informar(r: ResultadoFondo): void {
  if (r.fondos === 0) {
    console.log("⚠️  SIN_FONDOS: no hay fondos (FIC) activos registrados. Regístrelo con --registrar.");
    process.exitCode = 3;
    return;
  }
  console.log(`✅ ${r.fondos} fondo(s) · valores nuevos: ${r.valoresNuevos} · revisados: ${r.valoresRevisados}`);
  for (const u of r.ultimos) {
    console.log(`   · fondo ${u.instrumentoId} · último dato: ${u.ultimaFecha ? isoDia(u.ultimaFecha) : "sin datos"}${u.atrasado ? ` · ATRASADO (más de ${DIAS_ATRASO_AVISO} días)` : ""}`);
  }
  for (const f of r.fallidos) {
    console.log(`⚠️  fondo ${f.instrumentoId} · ${f.codigo}${f.detalle ? ` · ${f.detalle}` : ""} · guardados: ${f.guardados} · con error: ${f.conError} · descartados: ${f.descartados}`);
  }
  if (r.fallidos.length > 0 || r.ultimos.some((u) => u.atrasado)) process.exitCode = 3;
}

async function main(): Promise<void> {
  const a = interpretarArgumentos(process.argv.slice(2), new Date());
  if (!a.ok) {
    console.error(`❌ Argumentos inválidos: ${a.errores.map((e) => `${e.campo} · ${e.codigo}`).join(", ")}`);
    console.error("   Uso: [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD] | --registrar --codigo <n> [--participacion <n>] --nombre <texto>");
    process.exit(2);
  }
  const db = new PrismaClient();
  try {
    if (a.modo === "registrar") {
      await registrar(db, a.datos, a.hoy);
      return;
    }
    // obtenerValores pide con redirect: "error" (no sigue redirecciones) y con tope de bytes en el cuerpo.
    informar(await actualizarFondo(db, { desde: a.desde, hasta: a.hasta, buscar: fetch }));
  } catch (e) {
    console.error(`❌ No se actualizó el fondo: ${detalleDeError(e)}`);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(`❌ Error inesperado: ${detalleDeError(e)}`);
  process.exitCode = 1;
});
