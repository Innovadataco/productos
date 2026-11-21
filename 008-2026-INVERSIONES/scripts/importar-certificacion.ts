/**
 * Carga local de la certificación PDF de Acciones & Valores y su conciliación por fecha de corte (hito 1).
 *   npx tsx scripts/importar-certificacion.ts --email <correo-del-dueño> --fecha-corte AAAA-MM-DD [--fondo <codigoFic>] <certificacion.pdf>
 * - La fecha de corte es OBLIGATORIA: el texto del PDF no la trae y nunca se infiere. Debe ser día hábil de la BVC,
 *   no posterior a la fecha de generación del PDF y de hasta 7 días antes. Si no es hábil (por ejemplo, la de un PDF
 *   generado en fin de semana o festivo), se rechaza, nunca se ajusta sola, y se indica el último día hábil anterior
 *   según calendario_bvc con el comando para correrlo de nuevo.
 * - `--fondo <codigoFic>` (el código de la SFC del fondo ya registrado con actualizar-fondo) solo hace falta la
 *   primera vez, para vincular el NIT del fondo que trae la certificación.
 * - El correo debe ser el de un DUENO ya registrado (este comando no crea usuarios).
 * - Al cargar, concilia y deja la conciliación guardada.
 * - Orden recomendado: importar la certificación y DESPUÉS traer los cierres de ese día con
 *   `npm run precios:actualizar -- --desde <corte>` (este comando no llama a la red; lo imprime como siguiente paso),
 *   y volver a conciliar con `npx tsx scripts/conciliar-certificacion.ts --fecha-corte <corte>`. En producción (sin
 *   red, NODE_ENV=production) el siguiente paso que imprime es la vía B: `cargar-prod.sh importar-precios` y después
 *   `cargar-prod.sh conciliar-certificacion` (docs/despliegue/produccion.md §11).
 * Usa DATABASE_URL (la base de 008) y las claves de cifrado del entorno. Imprime solo conteos, códigos y la fecha de
 * corte que usted dio; nunca montos, especies, cuentas ni el correo. El archivo original no se guarda.
 */
import { PrismaClient } from "@prisma/client";
import { ErrorArgumentosAv, leerArgumentosImportar, type ArgumentosImportarCertificacion } from "../src/importacion/av/argumentos";
import { MAX_BYTES } from "../src/importacion/av/importar";
import { cargarYConciliar } from "../src/importacion/av/salida";
import { leerArchivoAcotado } from "../src/lib/archivo-acotado";

const USO = "Uso: npx tsx scripts/importar-certificacion.ts --email <correo-del-dueño> --fecha-corte AAAA-MM-DD [--fondo <codigoFic>] <certificacion.pdf>";

function argumentos(): ArgumentosImportarCertificacion {
  try {
    return leerArgumentosImportar(process.argv.slice(2));
  } catch (e) {
    console.error(`❌ ${e instanceof ErrorArgumentosAv ? e.codigo : "ARGUMENTOS_INVALIDOS"}\n${USO}`);
    process.exit(2);
  }
}

function salir(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

/** El PDF de un archivo REGULAR, sin leer más del tope (un FIFO, un dispositivo o una carpeta no pasan ni cuelgan). */
function leerPdf(ruta: string): Uint8Array {
  const r = leerArchivoAcotado(ruta, MAX_BYTES);
  if (r.ok) return r.bytes;
  if (r.codigo === "ARCHIVO_DEMASIADO_GRANDE") return salir("❌ PDF_DEMASIADO_GRANDE · el archivo pasa de 15 MB y no se importa.");
  return salir("❌ ARCHIVO_ILEGIBLE · no se pudo leer el PDF indicado.");
}

async function main(): Promise<void> {
  const a = argumentos();
  const contenido = leerPdf(a.archivo);
  const db = new PrismaClient();
  try {
    const usuario = await db.usuario.findUnique({ where: { email: a.email }, select: { id: true } });
    if (!usuario) return salir("❌ USUARIO_NO_REGISTRADO · ese correo no está registrado (este comando no crea usuarios).");
    // La imagen del migrador trae NODE_ENV=production: allí no hay red y el siguiente paso es la vía B (cargar-prod.sh).
    const r = await cargarYConciliar(db, { contenido, usuarioId: usuario.id, fechaCorte: a.fechaCorte, fondoCodigo: a.fondo }, undefined, { produccion: process.env.NODE_ENV === "production" });
    for (const linea of r.lineas) console.log(linea);
    process.exitCode = r.codigo;
  } finally {
    await db.$disconnect();
  }
}

main().catch((e: unknown) => {
  const codigo = e instanceof Error && "codigo" in e ? ` (${String((e as { codigo: unknown }).codigo)})` : "";
  console.error(`❌ La importación falló: ${e instanceof Error ? e.name : "error"}${codigo}`);
  process.exit(1);
});
