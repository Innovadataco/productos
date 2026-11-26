// La elección de la tarjeta de resumen (E5, frente ia-resumenes-pantalla): un PUBLICADO se revalida con el validador
// de E2 antes de mostrarse (si no pasa, no se muestra); sin él, el resumen sin IA del paquete de hoy; sin ninguno, «no
// disponible». La vigencia compara el hash de los hechos de hoy con el del publicado. Datos inventados (2027, FICTICIA-*).
import { describe, expect, it } from "vitest";
import { elegirResumen } from "@/app/_comun/resumen-ia/elegir";
import { TEXTOS_RESUMEN_IA } from "@/app/_comun/resumen-ia/textos";
import { resumenSinIa } from "@/ia/validador/plantilla";
import { CODIGOS_VALIDADOR } from "@/ia/validador/codigos";
import { prohibidasEn } from "../operar/informe/lenguaje";
import { MODELO_FICTICIO, GENERADO_FICTICIO, paqueteFicticio, publicadoFicticio } from "./apoyo.ficticio";

const TIPOS = ["DIARIO", "REGLAS", "ESCENARIOS"] as const;

describe("elegirResumen · publicado que pasa el validador", () => {
  it.each(TIPOS)("%s: muestra el publicado revalidado, al día, con el pie de la IA local y su modelo", (tipo) => {
    const paquete = paqueteFicticio(tipo);
    const { vista, descarte } = elegirResumen({ tipo, publicado: publicadoFicticio(paquete), hoy: { paquete, motivo: null } });
    const esperado = resumenSinIa(paquete);
    if (!esperado.ok) throw new Error("la plantilla inventada debía pasar");
    expect(descarte).toBeNull();
    expect(vista).toMatchObject({ tipo, estado: "IA", vigencia: "AL_DIA", aviso: esperado.resumen.aviso });
    // El texto es el que arma el validador, no el guardado.
    expect(vista.frases).toEqual(esperado.resumen.frases.map((f) => f.texto));
    expect(vista.frases.join(" ")).not.toContain("Texto guardado ficticio");
    expect(vista.pie).toBe(`Redactado por IA local (${MODELO_FICTICIO}) · cifras calculadas por Inversiones y cotejadas`);
    expect(vista.redactadoEn).toBe("2027-03-17 18:41");
    expect(vista.cifras.map((c) => c.id)).toEqual(esperado.resumen.cifrasUsadas.map((c) => c.id));
    const primera = esperado.resumen.cifrasUsadas[0]!;
    expect(vista.cifras[0]).toMatchObject({ fuente: "fuente-ficticia", fecha: "2027-03-16", fechaPresentada: primera.fechaPresentada, calidad: TEXTOS_RESUMEN_IA.calidad[primera.calidad] });
  });

  it("la puerta nube dice «IA en la nube»", () => {
    const paquete = paqueteFicticio("DIARIO");
    const { vista } = elegirResumen({ tipo: "DIARIO", publicado: publicadoFicticio(paquete, { puerta: "nube" }), hoy: { paquete, motivo: null } });
    expect(vista.pie).toBe(`Redactado por IA en la nube (${MODELO_FICTICIO}) · cifras calculadas por Inversiones y cotejadas`);
  });

  it("un nombre de modelo raro no se repite: sale «modelo sin nombre»", () => {
    const paquete = paqueteFicticio("DIARIO");
    const { vista } = elegirResumen({ tipo: "DIARIO", publicado: publicadoFicticio(paquete, { modelo: "<b>x</b> compre ya" }), hoy: { paquete, motivo: null } });
    expect(vista.pie).toBe("Redactado por IA local (modelo sin nombre) · cifras calculadas por Inversiones y cotejadas");
  });

  it("DESACTUALIZADO si el hash de los hechos de hoy cambió", () => {
    const guardado = paqueteFicticio("REGLAS");
    const hoy = paqueteFicticio("REGLAS", "AVISO_FICTICIO_NUEVO");
    expect(hoy.hash).not.toBe(guardado.hash);
    const { vista } = elegirResumen({ tipo: "REGLAS", publicado: publicadoFicticio(guardado), hoy: { paquete: hoy, motivo: null } });
    expect(vista).toMatchObject({ estado: "IA", vigencia: "DESACTUALIZADO" });
  });

  it("SIN_COMPROBAR si hoy no se pudo armar el paquete", () => {
    const guardado = paqueteFicticio("ESCENARIOS");
    const { vista } = elegirResumen({ tipo: "ESCENARIOS", publicado: publicadoFicticio(guardado), hoy: { paquete: null, motivo: "OCUPADO" } });
    expect(vista).toMatchObject({ estado: "IA", vigencia: "SIN_COMPROBAR" });
  });
});

describe("elegirResumen · publicado que NO pasa", () => {
  it("una salida que el validador rechaza no se muestra: va el resumen sin IA, y se informa el descarte con códigos", () => {
    const paquete = paqueteFicticio("DIARIO");
    const malo = publicadoFicticio(paquete, { salidaModelo: '{"frases":[{"segmentos":[{"texto":"Le recomendamos comprar."}]}]}' });
    const { vista, descarte } = elegirResumen({ tipo: "DIARIO", publicado: malo, hoy: { paquete, motivo: null } });
    expect(vista).toMatchObject({ estado: "SIN_IA", vigencia: null, pie: "Resumen sin IA", redactadoEn: null });
    expect(vista.frases.join(" ")).not.toMatch(/recomendamos/i);
    expect(descarte).not.toBeNull();
    expect(descarte!.every((c) => /^[A-Z_]+$/.test(c))).toBe(true);
  });

  it("un publicado de otro tipo no se muestra", () => {
    const paquete = paqueteFicticio("DIARIO");
    const ajeno = publicadoFicticio(paqueteFicticio("REGLAS"));
    const { vista, descarte } = elegirResumen({ tipo: "DIARIO", publicado: ajeno, hoy: { paquete, motivo: null } });
    expect(vista.estado).toBe("SIN_IA");
    expect(descarte).toEqual(["TIPO_DISTINTO"]);
  });

  it("sin publicado válido ni paquete de hoy: no disponible, con la nota de su motivo", () => {
    const paquete = paqueteFicticio("DIARIO");
    const malo = publicadoFicticio(paquete, { salidaModelo: "no es json" });
    const { vista } = elegirResumen({ tipo: "DIARIO", publicado: malo, hoy: { paquete: null, motivo: "SIN_PLAN_VIGENTE" } });
    expect(vista).toMatchObject({ estado: "NO_DISPONIBLE", frases: [], cifras: [], aviso: null, vigencia: null });
    expect(vista.nota).toBe(TEXTOS_RESUMEN_IA.notaSinDatos);
  });
});

describe("elegirResumen · sin publicado", () => {
  it.each(TIPOS)("%s: el resumen sin IA del paquete de hoy, con «Resumen sin IA»", (tipo) => {
    const paquete = paqueteFicticio(tipo);
    const { vista, descarte } = elegirResumen({ tipo, publicado: null, hoy: { paquete, motivo: null } });
    const esperado = resumenSinIa(paquete);
    if (!esperado.ok) throw new Error("la plantilla inventada debía pasar");
    expect(descarte).toBeNull();
    expect(vista).toMatchObject({ estado: "SIN_IA", pie: "Resumen sin IA", vigencia: null, redactadoEn: null });
    expect(vista.frases).toEqual(esperado.resumen.frases.map((f) => f.texto));
    expect(vista.cifras.length).toBe(esperado.resumen.cifrasUsadas.length);
  });

  it.each(["EN_VUELO", "FRECUENCIA", "OCUPADO", "FALLO"])("sin paquete por %s: la nota de «en este momento»", (motivo) => {
    const { vista } = elegirResumen({ tipo: "ESCENARIOS", publicado: null, hoy: { paquete: null, motivo } });
    expect(vista).toMatchObject({ estado: "NO_DISPONIBLE", nota: TEXTOS_RESUMEN_IA.notaMomento });
  });

  it("el título va por tipo y la vista es solo texto (cruza a un componente de cliente)", () => {
    const paquete = paqueteFicticio("REGLAS");
    const { vista } = elegirResumen({ tipo: "REGLAS", publicado: publicadoFicticio(paquete), hoy: { paquete, motivo: null } });
    expect(vista.titulo).toBe(TEXTOS_RESUMEN_IA.titulos.REGLAS);
    expect(JSON.parse(JSON.stringify(vista))).toEqual(vista);
    expect(GENERADO_FICTICIO).toBeInstanceOf(Date);
  });
});

describe("elegirResumen · revisión", () => {
  it("un paquete de hoy de otro tipo no da la vigencia: SIN_COMPROBAR", () => {
    const guardado = paqueteFicticio("DIARIO");
    const { vista } = elegirResumen({ tipo: "DIARIO", publicado: publicadoFicticio(guardado), hoy: { paquete: paqueteFicticio("REGLAS"), motivo: null } });
    expect(vista).toMatchObject({ estado: "IA", vigencia: "SIN_COMPROBAR" });
  });
});


describe("elegirResumen · el último análisis válido, con su fecha, aunque no sea de hoy", () => {
  it("un análisis de AYER (otro día, otros hechos) se muestra con su fecha y hora, y como DESACTUALIZADO con su aviso", () => {
    const guardado = paqueteFicticio("DIARIO");
    const hoy = paqueteFicticio("DIARIO", undefined, "2027-03-18");
    expect(hoy.hash).not.toBe(guardado.hash);
    const { vista, descarte } = elegirResumen({ tipo: "DIARIO", publicado: publicadoFicticio(guardado), hoy: { paquete: hoy, motivo: null } });
    expect(descarte).toBeNull();
    expect(vista).toMatchObject({ estado: "IA", vigencia: "DESACTUALIZADO", analisisDel: "Análisis de la IA del 17-mar-2027, 18:41" });
    expect(TEXTOS_RESUMEN_IA.vigencia.DESACTUALIZADO).toBe("DESACTUALIZADO: los datos cambiaron desde este análisis.");
    expect(vista.frases.length).toBeGreaterThan(0);
  });

  it("al día: también lleva su fecha y hora", () => {
    const paquete = paqueteFicticio("REGLAS");
    const { vista } = elegirResumen({ tipo: "REGLAS", publicado: publicadoFicticio(paquete), hoy: { paquete, motivo: null } });
    expect(vista).toMatchObject({ vigencia: "AL_DIA", analisisDel: "Análisis de la IA del 17-mar-2027, 18:41" });
  });

  it("se vuelve a validar aunque sea viejo: uno de ayer que ya no pasa no se muestra", () => {
    const guardado = paqueteFicticio("DIARIO");
    const malo = publicadoFicticio(guardado, { salidaModelo: "no es json" });
    const { vista, descarte } = elegirResumen({ tipo: "DIARIO", publicado: malo, hoy: { paquete: paqueteFicticio("DIARIO", undefined, "2027-03-18"), motivo: null } });
    expect(vista).toMatchObject({ estado: "SIN_IA", analisisDel: null });
    expect(descarte).toEqual(["SALIDA_INVALIDA"]);
  });

  it("si nunca hubo uno válido: el resumen sin IA, sin fecha de análisis, como hoy", () => {
    const paquete = paqueteFicticio("ESCENARIOS");
    const { vista } = elegirResumen({ tipo: "ESCENARIOS", publicado: null, hoy: { paquete, motivo: null } });
    expect(vista).toMatchObject({ estado: "SIN_IA", analisisDel: null, rechazo: null, vigencia: null });
  });

  it("la vista nueva trae puedeAnalizar apagado por omisión (lo enciende la lectura, solo para el dueño con el interruptor)", () => {
    const paquete = paqueteFicticio("DIARIO");
    expect(elegirResumen({ tipo: "DIARIO", publicado: null, hoy: { paquete, motivo: null } }).vista.puedeAnalizar).toBe(false);
    expect(elegirResumen({ tipo: "DIARIO", publicado: null, hoy: { paquete: null, motivo: "OCUPADO" } }).vista.puedeAnalizar).toBe(false);
  });
});

describe("elegirResumen · el último fue RECHAZADO por el validador", () => {
  const rechazado = (motivos: readonly string[], extra: object = {}) => ({ fechaNegocio: "2027-03-17", motivos, generadoEn: new Date("2027-03-18T00:05:00.000Z"), ...extra });
  const PALABRAS_DE_CODIGO = /\b[A-Z]{3,}(?:_[A-Z]+)+\b|\b(?:LONGITUD|FORMATO|IDIOMA|TRATO|PREDICCION|RECOMENDACION)\b/;

  it("más nuevo que el último válido: se muestra el motivo en palabras simples, sin códigos, y sigue el último válido", () => {
    const paquete = paqueteFicticio("DIARIO");
    const { vista } = elegirResumen({ tipo: "DIARIO", publicado: publicadoFicticio(paquete), rechazado: rechazado(["HECHO_NO_CITADO", "CIFRA_SUELTA"]), hoy: { paquete, motivo: null } });
    expect(vista.estado).toBe("IA");
    expect(vista.rechazo).toBe("El último análisis (17-mar-2027, 19:05) no pasó la revisión automática y no se muestra: no citó todas las cifras que debía; traía una cifra que no estaba entre las calculadas.");
    expect(vista.rechazo).not.toMatch(PALABRAS_DE_CODIGO);
  });

  it("sin ningún válido: el resumen sin IA y el motivo del rechazo", () => {
    const paquete = paqueteFicticio("DIARIO");
    const { vista } = elegirResumen({ tipo: "DIARIO", publicado: null, rechazado: rechazado(["HECHO_NO_CITADO"]), hoy: { paquete, motivo: null } });
    expect(vista).toMatchObject({ estado: "SIN_IA", analisisDel: null });
    expect(vista.rechazo).toContain("no citó todas las cifras que debía");
  });

  it("también con la tarjeta «no disponible»", () => {
    const { vista } = elegirResumen({ tipo: "DIARIO", publicado: null, rechazado: rechazado(["FORMATO"]), hoy: { paquete: null, motivo: "OCUPADO" } });
    expect(vista).toMatchObject({ estado: "NO_DISPONIBLE" });
    expect(vista.rechazo).toContain("formato");
  });

  it("uno más VIEJO que el último válido no se muestra: lo último es lo válido", () => {
    const paquete = paqueteFicticio("DIARIO");
    const viejo = rechazado(["HECHO_NO_CITADO"], { generadoEn: new Date("2027-03-17T12:00:00.000Z") });
    expect(elegirResumen({ tipo: "DIARIO", publicado: publicadoFicticio(paquete), rechazado: viejo, hoy: { paquete, motivo: null } }).vista.rechazo).toBeNull();
  });

  it("cada código del validador tiene su frase simple (sin el código, sin mayúsculas de código) y un código nuevo sale con la frase general", () => {
    for (const codigo of CODIGOS_VALIDADOR) {
      const frase = TEXTOS_RESUMEN_IA.motivosRechazo[codigo];
      expect(frase, codigo).toMatch(/^[a-záéíóúñ]/);
      expect(frase, codigo).not.toContain(codigo);
      expect(frase, codigo).not.toMatch(PALABRAS_DE_CODIGO);
    }
    const paquete = paqueteFicticio("DIARIO");
    const { vista } = elegirResumen({ tipo: "DIARIO", publicado: null, rechazado: rechazado(["CODIGO_NUEVO_DEL_FUTURO"]), hoy: { paquete, motivo: null } });
    expect(vista.rechazo).toContain(TEXTOS_RESUMEN_IA.rechazoGeneral);
    expect(vista.rechazo).not.toContain("CODIGO_NUEVO");
  });

  it("sin motivos que mostrar (lista vacía): la frase general, nunca una frase vacía", () => {
    const paquete = paqueteFicticio("DIARIO");
    expect(elegirResumen({ tipo: "DIARIO", publicado: null, rechazado: rechazado([]), hoy: { paquete, motivo: null } }).vista.rechazo).toContain(TEXTOS_RESUMEN_IA.rechazoGeneral);
  });

  it("los textos nuevos no traen lenguaje de consejo (candado de lenguaje, con control positivo) ni «008»", () => {
    const nuevos = JSON.stringify([Object.values(TEXTOS_RESUMEN_IA.motivosRechazo), TEXTOS_RESUMEN_IA.rechazoGeneral, Object.values(TEXTOS_RESUMEN_IA.vigencia), TEXTOS_RESUMEN_IA.analisisDel]);
    expect(prohibidasEn(nuevos)).toEqual([]);
    expect(prohibidasEn("Le recomendamos vender ya")).not.toEqual([]);
    expect(JSON.stringify(TEXTOS_RESUMEN_IA)).not.toMatch(/\b008\b/);
  });
});

describe("elegirResumen · el motivo «IA apagada»", () => {
  it("la vista nueva no trae motivo por omisión", () => {
    const paquete = paqueteFicticio("DIARIO");
    expect(elegirResumen({ tipo: "DIARIO", publicado: null, hoy: { paquete, motivo: null } }).vista.sinIa).toBeNull();
  });

  it("apagada y sin publicado: la tarjeta sin IA trae «IA apagada»", () => {
    const paquete = paqueteFicticio("DIARIO");
    const { vista } = elegirResumen({ tipo: "DIARIO", publicado: null, iaApagada: true, hoy: { paquete, motivo: null } });
    expect(vista).toMatchObject({ estado: "SIN_IA", sinIa: TEXTOS_RESUMEN_IA.iaApagada });
  });

  it("apagada y sin paquete de hoy: la tarjeta no disponible también", () => {
    const { vista } = elegirResumen({ tipo: "REGLAS", publicado: null, iaApagada: true, hoy: { paquete: null, motivo: "OCUPADO" } });
    expect(vista).toMatchObject({ estado: "NO_DISPONIBLE", sinIa: TEXTOS_RESUMEN_IA.iaApagada });
  });

  it("apagada pero con un análisis válido que se muestra: sin motivo", () => {
    const paquete = paqueteFicticio("DIARIO");
    expect(elegirResumen({ tipo: "DIARIO", publicado: publicadoFicticio(paquete), iaApagada: true, hoy: { paquete, motivo: null } }).vista.sinIa).toBeNull();
  });

  it("encendida: sin motivo", () => {
    const paquete = paqueteFicticio("DIARIO");
    expect(elegirResumen({ tipo: "DIARIO", publicado: null, iaApagada: false, hoy: { paquete, motivo: null } }).vista.sinIa).toBeNull();
  });
});
