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
import { actualizarFondo, type ResultadoFondo } from "../src/fondo/actualizar";
import { interpretarArgumentos } from "../src/fondo/argumentos";
import { ErrorRegistroFondo, registrarFondo, type DatosRegistroFondo } from "../src/fondo/registrar";
import { reporteFondo } from "../src/fondo/reporte";
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

/** El reporte vive en src/fondo/reporte.ts: es el mismo que imprime importar-valores-fondo después de su línea. */
function informar(r: ResultadoFondo): void {
  const reporte = reporteFondo(r);
  for (const linea of reporte.lineas) console.log(linea);
  if (reporte.codigoSalida !== 0) process.exitCode = reporte.codigoSalida;
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
