/**
 * Diagnóstico de los rechazos de la IA, de SOLO LECTURA: lee filas RECHAZADO de `resumen_ia` en una transacción
 * READ ONLY, re-corre el validador actual sobre la salida guardada y por cada hallazgo imprime el código, el patrón,
 * el número de frase, la parte (CODIGO o MODELO) y la frase con las citas como «{Hnn}» y los dígitos como «#».
 * También imprime la versión del validador de la fila y la actual. No escribe en la base ni en disco, no llama a
 * ningún modelo y nunca imprime una cifra del modelo, del paquete ni la URL de la base.
 *   npm run ia:diagnosticar -- [--id <id>] [--tipo DIARIO|REGLAS|ESCENARIOS] [--ultimos N]   (N de 1 a 50, por defecto 5)
 * Con --id lee esa fila sea cual sea su estado. Rol: el del migrador (inv_ia no lee la salida guardada).
 * Salida: 0 imprimió · 3 sin filas · 2 uso · 1 error.
 */
import { PrismaClient, type TipoResumenIa } from "@prisma/client";
import { TIPOS_RESUMEN } from "../src/ia/contrato";
import { enFotoDeSoloLectura } from "../src/ia/evaluacion/exportar/foto";
import { leerPaquete } from "../src/ia/paquete";
import { informeDeFila } from "../src/ia/validador/diagnostico";

const USO = "USO · diagnosticar-rechazo-ia [--id <id>] [--tipo DIARIO|REGLAS|ESCENARIOS] [--ultimos N (1 a 50)]";
const POR_DEFECTO = 5;
const MAXIMO = 50;

interface Opciones {
  readonly id: string | null;
  readonly tipo: TipoResumenIa | null;
  readonly ultimos: number;
}

/** Las opciones, o null si el uso es inválido (cualquier argumento desconocido, repetido o sin valor). */
function leerOpciones(argv: readonly string[]): Opciones | null {
  let id: string | null = null;
  let tipo: TipoResumenIa | null = null;
  let ultimos = POR_DEFECTO;
  const vistas = new Set<string>();
  for (let i = 0; i < argv.length; i += 2) {
    const nombre = argv[i] as string;
    const valor = argv[i + 1];
    if (valor === undefined || vistas.has(nombre)) return null;
    vistas.add(nombre);
    if (nombre === "--id" && valor !== "") id = valor;
    else if (nombre === "--tipo" && (TIPOS_RESUMEN as readonly string[]).includes(valor)) tipo = valor as TipoResumenIa;
    else if (nombre === "--ultimos" && /^[0-9]{1,2}$/u.test(valor) && Number(valor) >= 1 && Number(valor) <= MAXIMO) ultimos = Number(valor);
    else return null;
  }
  return { id, tipo, ultimos };
}

async function main(): Promise<number> {
  const opciones = leerOpciones(process.argv.slice(2));
  if (opciones === null) {
    console.error(`❌ ${USO}`);
    return 2;
  }
  const db = new PrismaClient();
  try {
    const filas = await enFotoDeSoloLectura(db, (c) =>
      c.resumenIa.findMany({
        where: opciones.id === null ? { estado: "RECHAZADO", ...(opciones.tipo === null ? {} : { tipo: opciones.tipo }) } : { id: opciones.id },
        orderBy: { generadoEn: "desc" },
        take: opciones.ultimos,
        select: { id: true, tipo: true, validadorVersion: true, motivos: true, salidaModelo: true, hechos: true },
      }),
    );
    if (filas.length === 0) {
      console.error("SIN_FILAS · no hay filas con ese criterio.");
      return 3;
    }
    for (const fila of filas) {
      for (const linea of informeDeFila(fila, fila.salidaModelo, leerPaquete(fila.hechos))) console.log(linea);
    }
    return 0;
  } finally {
    await db.$disconnect();
  }
}

main()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((e: unknown) => {
    console.error(`❌ El diagnóstico falló: ${e instanceof Error ? e.name : "error"}`);
    process.exitCode = 1;
  });
