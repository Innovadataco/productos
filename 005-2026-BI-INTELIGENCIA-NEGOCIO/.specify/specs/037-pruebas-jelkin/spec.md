# SPEC-037 · Bloque "Pruebas de Jelkin" en /operacion

> **Radicado:** BI · SPEC-037 (INSTRUCTIVO-022 · A-55 §7 · contrato candado 22 v2)
> **F3C:** 2026-08-30 · **Rama:** `work/bi-SPEC-037-pruebas-jelkin` · base `main` (SPEC-035 guard ya mergeado).

## 1. Problema
El tablero `/operacion` muestra recorridos de Calidad (`TablaRecorridos`), pero no las pruebas manuales que hace Jelkin a mano. Jelkin pidió su propia tabla, debajo de recorridos, misma línea visual.

## 2. Objetivo
Leer un array nuevo `pruebasJelkin` del MISMO `operacion.json` y pintar una tabla calcada de `TablaRecorridos` con columnas `# · Prueba · Fecha · Hallazgos · Estado`. Si el array falta o viene vacío → el bloque NO se pinta (candado 9).

## 3. Alcance
**Dentro:**
- `src/lib/bi/operacion.ts`: tipo nuevo
  ```ts
  export interface PruebaJelkin {
    id: string;
    prueba: string;
    fecha?: string | null;
    hallazgos?: string | null;
    estado?: string | null;
  }
  export interface PruebasJelkin {
    resumen?: string | null;
    filas: PruebaJelkin[];
  }
  ```
  y campo `pruebasJelkin?: PruebasJelkin | null` en `Operacion`. NO se toca `leerOperacion` ni ningún normalizador existente (se reutiliza `claseTag` y `mostrar`).
- `src/components/bi/operacion/TablaPruebasJelkin.tsx` (nuevo): calcado de `TablaRecorridos`. Columnas `# · Prueba · Fecha · Hallazgos · Estado`. `id` mono (J-NN). `fecha` verbatim (null→—). `hallazgos` verbatim. `estado` = `<span className="tag {claseTag}">` con MISMO vocabulario que calidad/resultado.
- `src/app/operacion/page.tsx`: renderiza `<TablaPruebasJelkin p={r.data.pruebasJelkin} />` DEBAJO de `<TablaRecorridos>`. El componente decide no pintarse si el array falta/vacío (no un `&&` en page — el componente retorna `null`, misma degradación que el resto).
- Fixture `tests/fixtures/operacion.sample.json`: agregar el bloque `pruebasJelkin` con J-01/J-02 (copiado del sample de gestión).
- Tests: bloque renderiza datos del fixture · array ausente → no se pinta · vacío → no se pinta · estado mapea colores (Cumple→ok, Parcial→mid, Sin probar/Bloqueado→bad, desconocido→neutro, null→—).

**Fuera (regla dura instructivo):**
- `src/lib/auth/**` · guard · login · `operacion/layout.tsx` (SPEC-036 de Dev BI-2).
- `leerOperacion` / normalizadores existentes (solo se AGREGA tipo + campo).
- Reordenar filas: orden del array = orden en pantalla.

## 4. Degradación (candado 9)
`pruebasJelkin` ausente (`undefined`/`null`) o `filas` vacío → `<TablaPruebasJelkin>` retorna `null`. Sin error, sin hueco. El resto del tablero intacto.

## 5. Estado → color (calcado de claseTag · contrato §7)
`Cumple`→verde (`ok`) · `Parcial`→ámbar (`mid`) · `Sin probar`/`Bloqueado`→rojo (`bad`) · desconocido→`neutro` texto crudo · `null`/`""`→`—`.

## 6. Evidencia §6 (candado 14 · 2 capturas con `next build && next start`)
- (a) bloque "Pruebas de Jelkin" debajo de recorridos con J-01/J-02 y colores de estado.
- (b) fixture sin `pruebasJelkin` → el bloque NO aparece, resto del tablero igual.

## 7. Criterios de aceptación
- [ ] Tipo `PruebaJelkin`/`PruebasJelkin` + campo en `Operacion`.
- [ ] `TablaPruebasJelkin` calcado, columnas exactas, retorna null si vacío/ausente.
- [ ] Page renderiza debajo de recorridos.
- [ ] Fixture con J-01/J-02.
- [ ] Tests: render · ausente · vacío · mapeo de colores.
- [ ] Gate LOCAL verde (escalonado con Dev BI-2 por RAM).
- [ ] 2 capturas §6.

## 📋 Control
| Campo | Valor |
|---|---|
| Radicado | BI · SPEC-037 |
| F3C | 2026-08-30 |
| Autor | dev-bi-1 (idc-5e) |
| Estado | 🟡 spec+plan |
