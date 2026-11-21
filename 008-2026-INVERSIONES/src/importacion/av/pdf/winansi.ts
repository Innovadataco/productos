/**
 * WinAnsiEncoding (cp1252) → texto. Es la codificación de las fuentes estándar que usa jsPDF.
 * De 0x80 a 0x9F NO es latin1 (ahí van la raya, el euro, las comillas tipográficas…); los cinco
 * bytes sin definir quedan como U+FFFD y la validación de la celda los rechaza después.
 */
const DE_0X80: readonly number[] = [
  0x20ac, 0xfffd, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0xfffd, 0x017d, 0xfffd,
  0xfffd, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0xfffd, 0x017e, 0x0178,
];

export function decodificarWinAnsi(bytes: Uint8Array): string {
  let texto = "";
  for (const b of bytes) texto += String.fromCharCode(b >= 0x80 && b <= 0x9f ? DE_0X80[b - 0x80]! : b);
  return texto;
}
