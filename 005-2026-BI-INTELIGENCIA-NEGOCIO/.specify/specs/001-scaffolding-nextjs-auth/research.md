# SPEC-001 · research.md

> Lecciones aprendidas y correcciones honestas del scaffolding BI. Escrita en SPEC-005 (post-mortem).

---

## Lección 1 · Font: Instrument Sans → Inter + DM_Mono

El INSTRUCTIVO-001 indicaba usar "Instrument Sans" (el sistema de diseño nuevo de IDC). Al verificar en fuente PI (`src/app/layout.tsx`) se confirmó que PI usa `Inter` + `DM_Mono`. Fábrica verificó y confirmó en la cadena de REVISO.

**Aprendizaje:** candado 15 evitó un drift de fuente. Si se hubiera asumido sin verificar, el sistema de diseño BI divergía de PI desde el día 1.

**Decisión:** D-01-BI · Inter + DM_Mono confirmado.

---

## Lección 2 · ThemeProvider necesita `toggleTheme` + `mounted`

El ThemeProvider de PI tiene una interfaz simplificada. Al copiar `ThemeToggle.tsx` de PI al repo BI, el componente necesitaba `theme` + `toggleTheme` + `mounted`. El ThemeProvider de BI fue expandido para exponerlos.

**Decisión:** D-03-BI.

---

## Lección 3 · `@vitest-environment node` en jwt.test.ts

`jose` 6 usa `TextEncoder` nativo de Node. En `jsdom` (environment por defecto de Vitest) `TextEncoder` es un polyfill que devuelve `Uint8Array` incompatible con `jose`. Al añadir `// @vitest-environment node` al inicio del archivo, los 3 tests de JWT pasan sin problemas.

**Decisión:** D-04-BI.

---

## Corrección honesta · I-02 · Spec Kit oficial no aplicado (Fábrica)

**ID:** I-02 · Severidad: 🔴 Alta
**Detectado:** Jelkin al comparar `.specify/` de PI vs BI · Fábrica confirmó en fuente.
**Qué pasó:** SPEC-001 y la spec+plan de SPEC-002 se escribieron en formato monolítico (`SPEC-001-name.md`) en lugar de la estructura Spec Kit oficial (`specs/NNN-name/spec.md + plan.md + tasks.md + research.md`). La infraestructura del Spec Kit (scripts · templates · workflows · feature.json · init-options.json) nunca fue inicializada.
**Por qué:** Fábrica anterior no verificó la estructura real del Spec Kit de PI antes de dar REVISO de SPEC-001.
**Resultado:** Orden Jelkin Opción A · corte limpio de sesiones · SPEC-005 regulariza todo.
**Cierre:** resuelto en SPEC-005 (este commit). Fábrica BI-2 confirma en CUMPLE.

---

## Corrección honesta · I-03 · CEO cerró sin acuse formal (CEO IDC)

**ID:** I-03 · Severidad: 🟠 Media
**Detectado:** bi-dev-2 auditoría cruzada.
**Qué pasó:** Sesión CEO anterior cerró después de emitir R-008/R-009 sin acusar formalmente los reportes de Fábrica. `ESTADO.md` quedó desactualizado.
**Impacto:** Jelkin no pudo confirmar si el CEO había procesado los reportes antes del cierre de sesión.
**Aprendizaje:** Candado 18 (propuesto): CEO verifica reportes pendientes antes de cerrar sesión.
**Cierre:** CEO BI sesión nueva acusó retroactivamente en madrugada 2026-08-28.

---

## Corrección honesta · I-05 · Compuerta §4 sin rastro documental (documental)

**ID:** I-05 · Severidad: 🟢 Baja · documental
**Detectado:** bi-dev-2 auditoría cruzada.
**Qué pasó:** No hay registro explícito de que Fábrica emitiera REVISO para SPEC-001 antes de que BI-DEV-1 implementara.
**Reconstrucción retroactiva:** SPEC-001 arrancó con INSTRUCTIVO-001 que incluía la cadena de comandos (spec+plan → PARA → REVISO → implementar). Fábrica emitió el INSTRUCTIVO como REVISO implícito. La señal `bi-desarrollo: BI-SPEC-001 · spec+plan LISTO` fue recibida por Fábrica que luego dio CUMPLE en R-006/R-007. La compuerta §4 se respetó en espíritu aunque no quedó documentada explícitamente como señal separada.
**Cierre:** documentado retroactivamente aquí. No genera riesgo técnico.

---

## Corrección honesta · I-07 · Paso 15 inconsistente (bi-dev-2)

**ID:** I-07 · Severidad: 🟢 Baja · higiene documental
**Detectado:** bi-dev-2 auditoría cruzada.
**Qué pasó:** El `tasks.md` original tenía el Paso 15 ("Push único a origin feature/bi-scaffolding") marcado `[ ]` (sin completar), pero el código SÍ estaba commiteado y pusheado en `23c5100e`.
**Por qué:** El archivo `tasks.md` fue commiteado antes de hacer el push, por lo que la casilla nunca se marcó.
**Cierre:** corregido en `tasks.md` de esta carpeta (todos los pasos marcados `[x]`).

---

## Estado final SPEC-001

Código en `23c5100e` · CI verde · 6 tests · 4 ratchets · verificación en vivo completada.
Ningún cambio de código en SPEC-005 · solo reorganización documental.
