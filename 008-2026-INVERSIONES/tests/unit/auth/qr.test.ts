// QR del enrolamiento: se genera en el servidor (qrcode-generator, sin dependencias) y se dibuja como un
// solo <path> SVG en JSX, sin dangerouslySetInnerHTML. Aquí: el tamaño es el de un QR válido, el trazo solo
// lleva comandos de rectángulos y aparecen los tres patrones de posición de las esquinas.
import { describe, expect, it } from "vitest";
import { qrDeTexto } from "@/auth/qr";

/** Un otpauth de ejemplo con el secreto del apéndice de RFC 6238 (público). */
const URI = "otpauth://totp/Inversiones:dueno%40ejemplo.invalid?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Inversiones&algorithm=SHA1&digits=6&period=30";

describe("qrDeTexto", () => {
  it("da un QR de lado válido (21 + 4k módulos)", () => {
    const { lado } = qrDeTexto(URI);
    expect(lado).toBeGreaterThanOrEqual(21);
    expect((lado - 21) % 4).toBe(0);
  });

  it("el trazo es solo de rectángulos de una fila", () => {
    const { trazo } = qrDeTexto(URI);
    expect(trazo).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/);
  });

  it("trae los tres patrones de posición (7 módulos oscuros en la primera fila de cada uno)", () => {
    const { lado, trazo } = qrDeTexto(URI);
    expect(trazo).toContain("M0 0h7v1h-7z");
    expect(trazo).toContain(`M${lado - 7} 0h7v1h-7z`);
    expect(trazo).toContain(`M0 ${lado - 1}h7v1h-7z`);
  });

  it("es determinista y cambia con el texto", () => {
    expect(qrDeTexto(URI)).toEqual(qrDeTexto(URI));
    expect(qrDeTexto(URI).trazo).not.toBe(qrDeTexto(`${URI}x`).trazo);
  });
});
