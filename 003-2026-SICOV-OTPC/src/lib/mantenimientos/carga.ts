import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { requiereModulo } from "@/lib/guard-modulos";
import { AppError } from "@/lib/errors";
import type { TipoOperable } from "@/lib/mantenimientos/tipos";
import { validarTiposDeDato, filaCanonica } from "@/lib/mantenimientos/validacion";
import { leerRegistrosXlsx, leerRegistrosCsv, MAX_ARCHIVO_BYTES } from "@/lib/mantenimientos/excel";
import { guardarMasivo } from "@/lib/mantenimientos/servicio";
import type { ResumenCarga } from "@/lib/mantenimientos/tipos";

/// Handler compartido de la carga masiva por archivo (US2). SOLO por archivo (la variante JSON
/// del legacy se cortó — D-022 #4), por operación dentro de su módulo (§11.5, sin cargador
/// universal). Política del manual §10.10: **TODO-O-NADA** — cualquier fila inválida rechaza el
/// lote entero con `exitosos: 0` y CERO jobs; el encolado es transaccional.

function resumen(total: number, exitosos: number, errores: string[]): ResumenCarga {
  return { total, exitosos, errores };
}

const FORMATOS = {
  xlsx: {
    extension: ".xlsx",
    mensaje: "El archivo debe estar en formato XLSX",
    contentTypes: ["spreadsheetml", "application/octet-stream"],
    leer: leerRegistrosXlsx,
  },
  csv: {
    extension: ".csv",
    mensaje: "El archivo debe estar en formato CSV",
    contentTypes: ["text/csv", "application/vnd.ms-excel", "application/octet-stream"],
    leer: leerRegistrosCsv,
  },
} as const;

export async function manejarCargaMasiva(
  req: Request,
  tipo: TipoOperable,
  formato: keyof typeof FORMATOS,
): Promise<NextResponse> {
  try {
    // Roles 1 y 3: el cliente (rol 2) no carga registros (§10.2). Guard de módulo D-017 extendido a
    // submódulo (spec 009): la carga masiva respeta el mismo permiso preventivos/correctivos.
    const u = await verifyAuth([1, 3]);
    await requiereModulo(u, "mantenimientos", tipo === 1 ? "preventivos" : "correctivos");

    const form = await req.formData().catch(() => null);
    const archivo = form?.get("archivo");
    if (!archivo || !(archivo instanceof File)) {
      return NextResponse.json(resumen(0, 0, ['Debe adjuntar el archivo en el campo "archivo"']), {
        status: 400,
      });
    }

    const def = FORMATOS[formato];
    const nombre = archivo.name?.toLowerCase() ?? "";
    const contentType = (archivo.type ?? "").toLowerCase();
    const tipoOk = contentType === "" || def.contentTypes.some((ct) => contentType.includes(ct));
    if (!nombre.endsWith(def.extension) || !tipoOk) {
      return NextResponse.json(resumen(0, 0, [def.mensaje]), { status: 400 });
    }
    if (archivo.size > MAX_ARCHIVO_BYTES) {
      return NextResponse.json(resumen(0, 0, ["El archivo supera el tamaño máximo de 5 MB"]), {
        status: 400,
      });
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    let lectura;
    try {
      lectura = await def.leer(buffer);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status === 400 && typeof e.message === "string") {
        return NextResponse.json(resumen(0, 0, [e.message]), { status: 400 });
      }
      throw err;
    }

    const { registros, errores, totalFilas } = lectura;
    if (errores.length > 0) {
      // TODO-O-NADA: campos requeridos vacíos → falla el lote entero.
      return NextResponse.json(resumen(totalFilas, 0, errores), { status: 400 });
    }
    if (registros.length === 0) {
      return NextResponse.json(
        resumen(totalFilas, 0, ["El archivo no contiene registros para procesar"]),
        { status: 400 },
      );
    }
    const erroresTipos = validarTiposDeDato(registros);
    if (erroresTipos.length > 0) {
      return NextResponse.json(resumen(totalFilas, 0, erroresTipos), { status: 400 });
    }

    const filas = registros.map(filaCanonica);
    const r = await guardarMasivo(tipo, filas, u.identificacion ?? "", u.rolId ?? 0);
    return NextResponse.json(r, { status: 202 });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    console.error("[mantenimientos] carga masiva:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      resumen(0, 0, ["No fue posible encolar el lote; no se procesó ningún registro"]),
      { status: 500 },
    );
  }
}
