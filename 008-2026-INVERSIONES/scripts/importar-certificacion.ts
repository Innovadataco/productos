/**
 * Carga local de la certificación PDF de Acciones & Valores y su conciliación por fecha de corte (hito 1).
 *   npx tsx scripts/importar-certificacion.ts --email <correo-del-dueño> --fecha-corte AAAA-MM-DD [--fondo <codigoFic>] <certificacion.pdf>
 * - La fecha de corte es OBLIGATORIA: el texto del PDF no la trae y nunca se infiere. Debe ser día hábil de la BVC,
 *   no posterior a la fecha de generación del PDF y de hasta 7 días antes.
 * - `--fondo <codigoFic>` (el código de la SFC del fondo ya registrado con actualizar-fondo) solo hace falta la
 *   primera vez, para vincular el NIT del fondo que trae la certificación.
 * - El correo debe ser el de un DUENO ya registrado (este comando no crea usuarios).
 * - Al cargar, concilia y deja la conciliación guardada.
 * - Orden recomendado: importar la certificación y DESPUÉS traer los cierres de ese día con
 *   `npm run precios:actualizar -- --desde <corte>` (este comando no llama a la red; lo imprime como siguiente paso),
 *   y volver a conciliar con `npx tsx scripts/conciliar-certificacion.ts --fecha-corte <corte>`.
 * Usa DATABASE_URL (la base de 008) y las claves de cifrado del entorno. Imprime solo conteos, códigos y la fecha de
 * corte que usted dio; nunca montos, especies, cuentas ni el correo. El archivo original no se guarda.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, statSync } from "node:fs";
import { conciliarCertificacion } from "../src/conciliacion/conciliar";
import { ErrorArgumentosAv, leerArgumentosImportar, type ArgumentosImportarCertificacion } from "../src/importacion/av/argumentos";
import { importarCertificacion, MAX_BYTES, type ResultadoImportacionAv } from "../src/importacion/av/importar";

const USO = "Uso: npx tsx scripts/importar-certificacion.ts --email <correo-del-dueño> --fecha-corte AAAA-MM-DD [--fondo <codigoFic>] <certificacion.pdf>";
const dia = (d: Date) => d.toISOString().slice(0, 10);

function argumentos(): ArgumentosImportarCertificacion {
  try {
    return leerArgumentosImportar(process.argv.slice(2));
  } catch (e) {
    console.error(`❌ ${e instanceof ErrorArgumentosAv ? e.codigo : "ARGUMENTOS_INVALIDOS"}\n${USO}`);
    process.exit(2);
  }
}

function leerPdf(ruta: string): Uint8Array {
  try {
    if (statSync(ruta).size > MAX_BYTES) {
      console.error("❌ PDF_DEMASIADO_GRANDE · el archivo pasa de 15 MB y no se importa.");
      process.exit(1);
    }
    return new Uint8Array(readFileSync(ruta));
  } catch {
    console.error("❌ ARCHIVO_ILEGIBLE · no se pudo leer el PDF indicado.");
    process.exit(1);
  }
}

function informar(r: ResultadoImportacionAv): void {
  if (r.estado === "RECHAZADO") {
    console.log(`❌ RECHAZADO (nada se guardó) · ${r.errores.length} error(es):`);
    for (const e of r.errores) console.log(`   página ${e.pagina} · fila ${e.fila}${e.columna ? ` · ${e.columna}` : ""} · ${e.codigo}`);
    return;
  }
  const detalle = r.repetida ? "la misma certificación ya estaba cargada: 0 filas nuevas" : `${r.filasNuevas} filas nuevas, ${r.instrumentosCreados} especies nuevas${r.fondoVinculado ? ", fondo vinculado por su NIT" : ""}`;
  console.log(`✅ CARGADO · ${r.filasTotal} filas: ${detalle}`);
}

async function main(): Promise<void> {
  const a = argumentos();
  const contenido = leerPdf(a.archivo);
  const db = new PrismaClient();
  try {
    const usuario = await db.usuario.findUnique({ where: { email: a.email }, select: { id: true } });
    if (!usuario) {
      console.error("❌ USUARIO_NO_REGISTRADO · ese correo no está registrado (este comando no crea usuarios).");
      process.exit(1);
    }
    const r = await importarCertificacion(db, { contenido, usuarioId: usuario.id, fechaCorte: a.fechaCorte, fondoCodigo: a.fondo });
    informar(r);
    if (r.estado === "RECHAZADO") process.exit(1);
    const c = await conciliarCertificacion(db, { fechaCorte: a.fechaCorte });
    console.log(`🧮 Conciliación al ${c.fechaCorte}: ${c.resultado} · ${c.cuentas.CUADRA} cuadran, ${c.cuentas.NO_CUADRA} no cuadran, ${c.cuentas.PENDIENTE_LIQUIDACION} pendientes de liquidación${c.motivos.length ? ` · motivos: ${c.motivos.join(", ")}` : ""}`);
    console.log(`➡️  Siguiente paso: corra \`npm run precios:actualizar -- --desde ${dia(a.fechaCorte)}\` para verificar los cierres de ese día, y después \`npx tsx scripts/conciliar-certificacion.ts --fecha-corte ${dia(a.fechaCorte)}\`.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e: unknown) => {
  const codigo = e instanceof Error && "codigo" in e ? ` (${String((e as { codigo: unknown }).codigo)})` : "";
  console.error(`❌ La importación falló: ${e instanceof Error ? e.name : "error"}${codigo}`);
  process.exit(1);
});
