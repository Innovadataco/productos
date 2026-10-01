# SPEC-804 · Un candado escribía dentro de `src/` y chocaba con los que lo caminan

**Feature Branch**: `work/pi-SPEC-804-temporal-fuera-de-src`
**Created**: 2026-09-30
**Status**: DESARROLLO
**Base**: `main`

## Contexto

`tokens-ratchet-sin-serializar.candado.test.ts` plantaba un directorio temporal DENTRO de `src/`
(`src/__spec466_tmp__`). Varios candados **caminan `src/`** (walkers de imports, de árbol de render,
de superficie de rutas) en paralelo en el mismo job. Resultado: `ENOENT: scandir 'src/__spec466_tmp__'`
— TOCTOU: un walker lista el directorio y, antes de leerlo, el otro test lo borró. **No es flaky: es
una carrera**, con la víctima ROTANDO entre corridas (Dev-3 la vio en `fecha-hecho-aproximada`,
Dev-2 en `url-privacy` y `fecha-hecho-aproximada`). Envenena la señal de la cola entera y entrena al
equipo a re-correr rojos. Reportada por Dev-3 al cerrar #767.

## Decisión · mover el temporal, NO endurecer los walkers

- **Endurecer cada walker contra ENOENT son N arreglos** y el walker N+1 de mañana vuelve a chocar.
- **Mover el temporal fuera de `src/` es UNO** y vuelve la colisión **imposible** (imposibilidad
  estructural): si nadie escribe dentro de `src/`, ningún walker de `src/` puede tropezar.
- El fixture del caso rojo del guard de tokens ahora vive en el **tmpdir del sistema**. Para que el
  guard lo mida ahí (sin escanear el `src/` real), `tokens-check.ts` acepta `TOKENS_CHECK_SRC` y
  `TOKENS_CHECK_PISO` por entorno, **con default = valores reales** (sin env, CI corre idéntico; el
  `--tension` sigue usando la constante literal `PISO`). El test prueba el MISMO contrato
  (`total > piso ⇒ rojo`) contra un árbol temremoto, más un control positivo (mismo árbol, piso
  holgado → verde).
- **NO se revierte** el endurecimiento ENOENT que hizo Dev-2 en su scanner: tolerar ENOENT al caminar
  un árbol es higiene de cualquier walker, correcto por su cuenta.
- **NO se serializan** los tests (bajar el paralelismo para tapar una carrera es el peor cambio).

## Candado

`ningun-test-escribe-en-src.candado.test.ts`: **barrido** de TODOS los tests (no una lista). Falla si
alguno construye un `path.join/resolve` cuya base es la raíz del repo (`RAIZ`/`__dirname`/
`process.cwd()`) con un segmento `"src"` Y además escribe (fs). Un fixture en el tmpdir del sistema no
matchea (su base no es la raíz del repo). Control positivo: el detector caza el patrón prohibido y no
el del tmpdir; leer un archivo de `src/` (sin escribir) no es la clase.

## Impacto en arquitectura:

- **Esquema / proxy / navegación / datos:** SIN cambios. No se tocó `schema.prisma` ni
  `docs/architecture/00|01|06` (ventana cerrada hasta #786).
- **Scripts/tests:** `tokens-check.ts` gana overrides por entorno (default real); el test de tokens
  mueve su fixture al tmpdir; nuevo candado de barrido registrado en `vitest.unit.includes.ts` (corre
  en `test:unit`, que `pi-gate` exige → CORRE en CI y BLOQUEA).
