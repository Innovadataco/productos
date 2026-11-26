// Una tarjeta de resumen ya armada e INVENTADA, para las pruebas de las páginas que la muestran (sin base ni export).
import type { VistaResumenIa } from "@/app/_comun/resumen-ia/tipos";

export const vistaResumenFicticia = (tipo: VistaResumenIa["tipo"]): VistaResumenIa => ({
  tipo, titulo: `Resumen ficticio ${tipo}`, estado: "SIN_IA", frases: ["Frase ficticia del resumen."], aviso: "Aviso ficticio.", cifras: [],
  pie: "Resumen sin IA", vigencia: null, redactadoEn: null, nota: null, analisisDel: null, rechazo: null, sinIa: null, fallo: null, puedeAnalizar: false,
});
