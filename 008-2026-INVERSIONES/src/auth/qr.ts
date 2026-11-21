import "server-only";
/**
 * QR del `otpauth://` del enrolamiento, generado en el servidor con qrcode-generator (MIT, sin
 * dependencias, versión exacta en package.json). Devuelve la matriz como un trazo SVG de rectángulos (un
 * tramo por cada racha de módulos oscuros de una fila), para dibujarlo en JSX como un solo <path>: sin
 * dangerouslySetInnerHTML ni imágenes externas. Corrección de errores M (la de las apps comunes).
 */
import qrcode from "qrcode-generator";

export interface Qr {
  /** Módulos por lado (sin el margen). */
  readonly lado: number;
  /** Atributo `d` del <path>, en unidades de módulo. */
  readonly trazo: string;
}

function rachasDeFila(qr: ReturnType<typeof qrcode>, fila: number, lado: number): string {
  let trazo = "";
  let inicio = -1;
  for (let col = 0; col <= lado; col += 1) {
    const oscuro = col < lado && qr.isDark(fila, col);
    if (oscuro && inicio === -1) inicio = col;
    if (!oscuro && inicio !== -1) {
      const largo = col - inicio;
      trazo += `M${inicio} ${fila}h${largo}v1h-${largo}z`;
      inicio = -1;
    }
  }
  return trazo;
}

export function qrDeTexto(texto: string): Qr {
  const qr = qrcode(0, "M");
  qr.addData(texto, "Byte");
  qr.make();
  const lado = qr.getModuleCount();
  let trazo = "";
  for (let fila = 0; fila < lado; fila += 1) trazo += rachasDeFila(qr, fila, lado);
  return { lado, trazo };
}
