// La documentación del servicio inv-008-alertas: el servicio, su credencial, cómo se enciende el intradía, la medición de memoria
// y la espera de 600 s del despliegue; la plantilla del archivo de producción, sin valores. Y el candado de lenguaje de los
// textos nuevos del servicio (log y documentación): 008 no recomienda comprar ni vender.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prohibidasEn } from "../operar/informe/lenguaje";
import { leer008, ruta008 } from "./falsos";

const doc = leer008("docs/despliegue/produccion.md");
const ejemplo = leer008("docs/despliegue/env-inversiones-production.example");
const inicio = doc.indexOf("### El servicio de las alertas");
const seccion = inicio === -1 ? "" : doc.slice(inicio, doc.indexOf("\n### ", inicio + 5) === -1 ? undefined : doc.indexOf("\n### ", inicio + 5));

describe("produccion.md · el servicio de las alertas", () => {
  it("tiene su sección", () => {
    expect(inicio).toBeGreaterThan(-1);
    expect(seccion).toContain("inv-008-alertas");
  });

  it("dice cuándo evalúa: 18:15 COT en día hábil y, con el intradía encendido, cada 5 minutos de 9:30 a 16:05", () => {
    expect(seccion).toContain("18:15");
    expect(seccion).toMatch(/cada 5 min/);
    expect(seccion).toContain("9:30");
    expect(seccion).toContain("16:05");
  });

  it("dice su credencial, que sin ella queda en espera, y su red: solo la interna, sin puertos", () => {
    expect(seccion).toContain("INV_ALERTAS_DATABASE_URL");
    expect(seccion).toContain("inv_alertas");
    expect(seccion).toMatch(/espera/);
    expect(seccion).toContain("inv-008-red-interna");
    expect(seccion).toMatch(/sin puertos/);
  });

  it("dice cómo se enciende el intradía (la misma variable que precios), la medición de memoria y la espera de 600 s", () => {
    expect(seccion).toContain("INV_INTRADIA_ENCENDIDO");
    expect(seccion).toMatch(/misma variable/);
    expect(seccion).toContain("64 MiB");
    expect(seccion).toContain("medir-memoria.sh");
    expect(seccion).toContain("600 s");
  });

  it("dice la marca del intento del cierre (volumen propio), el reintento tardío y el plazo", () => {
    expect(seccion).toContain("inv-008-alertas-estado");
    expect(seccion).toContain("intento-cierre");
    expect(seccion).toMatch(/cada 10 min/);
    expect(seccion).toContain("23:59");
    expect(seccion).toContain("120 s");
    expect(seccion).toContain("SIN_VERIFICAR");
  });

  it("dice cómo medir el pico: una sola evaluación (`ahora`) en el primer despliegue y leer memory.peak", () => {
    expect(seccion).toMatch(/servicio-alertas\.mjs ahora/);
    expect(seccion).toContain("memory.peak");
    expect(seccion).toMatch(/primer despliegue/);
  });

  it("dice el límite de 2 conexiones del rol y cómo se reparte entre el bucle y `ahora`", () => {
    expect(seccion).toMatch(/límite de 2 conexiones/);
    expect(seccion).toContain("connection_limit=1");
    expect(seccion).toMatch(/una del bucle y una de `ahora`/);
  });

  it("explica por qué evalúa en el mismo proceso y no con un hijo, y cómo mirar el log", () => {
    expect(seccion).toMatch(/mismo proceso/);
    expect(seccion).toContain("logs");
  });
});

describe("env-inversiones-production.example", () => {
  it("trae INV_ALERTAS_DATABASE_URL sin valor real (con <clave>) y el interruptor del intradía una sola vez", () => {
    expect(ejemplo).toMatch(/^# INV_ALERTAS_DATABASE_URL=postgresql:\/\/inv_alertas:<clave>@inv-008-db:5432\/inversiones\?connection_limit=2$/m);
    expect(ejemplo.match(/^#? ?INV_INTRADIA_ENCENDIDO=/gm)).toHaveLength(1);
    expect(ejemplo).toMatch(/INV_INTRADIA_ENCENDIDO[\s\S]*alertas|alertas[\s\S]*INV_INTRADIA_ENCENDIDO/);
  });
});

describe("lenguaje de los textos nuevos del servicio de las alertas", () => {
  const fuentes = readdirSync(ruta008("src/servicio-alertas")).map((f) => path.join("src/servicio-alertas", f));
  const textos = [...fuentes, "scripts/servicio-alertas.ts"].map((f) => [f, readFileSync(ruta008(f), "utf8")] as const);

  it("el detector tiene control positivo: muerde un consejo y deja pasar un texto neutro", () => {
    expect(prohibidasEn("Le recomendamos comprar ahora")).not.toEqual([]);
    expect(prohibidasEn("evaluación terminada: evaluadas 4 · nuevas 1")).toEqual([]);
  });

  it("hay textos que revisar", () => {
    expect(textos.length).toBeGreaterThanOrEqual(4);
  });

  it.each(textos)("%s no trae lenguaje de consejo o de juicio", (_f, texto) => {
    expect(prohibidasEn(texto)).toEqual([]);
  });

  it("la sección de la documentación tampoco", () => {
    expect(seccion).not.toBe("");
    expect(prohibidasEn(seccion)).toEqual([]);
  });
});

describe("convivencia-pi.md · el presupuesto con los tres servicios nuevos", () => {
  const convivencia = leer008("docs/despliegue/convivencia-pi.md");
  it("la tabla trae precios (96m), IA (128m) y alertas (64m) y el techo total", () => {
    const tabla = convivencia.slice(convivencia.indexOf("**Presupuesto de Inversiones**"), convivencia.indexOf("## 4 · Criterio de corte"));
    expect(tabla).toMatch(/\| precios[^|]*\| 96m \|/);
    expect(tabla).toMatch(/\| IA[^|]*\| 128m \|/);
    expect(tabla).toMatch(/\| alertas[^|]*\| 64m \|/);
    expect(tabla).toContain("1.376 MiB");
  });
});

describe("versión y pie de los documentos", () => {
  it("produccion.md y el ejemplo del archivo de producción traen la versión nueva con el frente alertas", () => {
    expect(doc).toMatch(/^> v2\.5 · 2026-11-26 · \d\d:\d\d \(-05\) · Inversiones · .*alertas/m);
    expect(ejemplo).toMatch(/^# v1\.5 · 2026-11-26 · \d\d:\d\d \(-05\) · Inversiones · .*INV_ALERTAS_DATABASE_URL/m);
  });
});
