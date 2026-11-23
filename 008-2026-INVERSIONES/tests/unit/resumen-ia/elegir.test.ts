// La elección de la tarjeta de resumen (E5, frente ia-resumenes-pantalla): un PUBLICADO se revalida con el validador
// de E2 antes de mostrarse (si no pasa, no se muestra); sin él, el resumen sin IA del paquete de hoy; sin ninguno, «no
// disponible». La vigencia compara el hash de los hechos de hoy con el del publicado. Datos inventados (2027, FICTICIA-*).
import { describe, expect, it } from "vitest";
import { elegirResumen } from "@/app/_comun/resumen-ia/elegir";
import { TEXTOS_RESUMEN_IA } from "@/app/_comun/resumen-ia/textos";
import { resumenSinIa } from "@/ia/validador/plantilla";
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
    expect(vista.pie).toBe(`Redactado por IA local (${MODELO_FICTICIO}) · cifras calculadas por 008 y cotejadas`);
    expect(vista.redactadoEn).toBe("2027-03-17 18:41");
    expect(vista.cifras.map((c) => c.id)).toEqual(esperado.resumen.cifrasUsadas.map((c) => c.id));
    const primera = esperado.resumen.cifrasUsadas[0]!;
    expect(vista.cifras[0]).toMatchObject({ fuente: "fuente-ficticia", fecha: "2027-03-16", fechaPresentada: primera.fechaPresentada, calidad: TEXTOS_RESUMEN_IA.calidad[primera.calidad] });
  });

  it("la puerta nube dice «IA en la nube»", () => {
    const paquete = paqueteFicticio("DIARIO");
    const { vista } = elegirResumen({ tipo: "DIARIO", publicado: publicadoFicticio(paquete, { puerta: "nube" }), hoy: { paquete, motivo: null } });
    expect(vista.pie).toBe(`Redactado por IA en la nube (${MODELO_FICTICIO}) · cifras calculadas por 008 y cotejadas`);
  });

  it("un nombre de modelo raro no se repite: sale «modelo sin nombre»", () => {
    const paquete = paqueteFicticio("DIARIO");
    const { vista } = elegirResumen({ tipo: "DIARIO", publicado: publicadoFicticio(paquete, { modelo: "<b>x</b> compre ya" }), hoy: { paquete, motivo: null } });
    expect(vista.pie).toBe("Redactado por IA local (modelo sin nombre) · cifras calculadas por 008 y cotejadas");
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

