# SPEC-827 · El OBJETO de la petición de habeas data, por tipo

**Feature Branch**: `work/pi-SPEC-827-objeto-peticion-habeas-data`
**Created**: 2026-10-01
**Status**: IMPLEMENTADO
**Base**: `main` (`66cef7f58`)
**Origen**: RADICADO-SPEC-827. SPEC-819 construyó el SELECTOR de habeas data (el TIPO + el SUJETO), pero dos de
los tres tipos quedaban sin OBJETO: una `RECTIFICACION`/`SUPRESION` sin objeto no es accionable y el término de
ley (15 días hábiles) corre igual. 827 agrega el paso del objeto.

## Alcance
El paso siguiente al selector (eje C), para `RECTIFICACION` y `SUPRESION` (`CONSULTA` no lleva objeto):
- **El objeto es `ClaseDatoTitular[]`** (enum CERRADO, nunca texto libre) — las clases sobre las que recae.
- **El derecho es general:** `RECTIFICACION` toma el MISMO enum completo que `SUPRESION` (no se acota). El enum:
  `PERFIL · HIJOS · IDENTIFICADORES_CIRCULO · RELATO_CITA · CONTENIDO_REPORTE · OTRO`.
- **Campo NUEVO `clasesSolicitadas`**, DISTINTO de `clasesDatoAfectadas` (la RESOLUCIÓN del operador): «sobre qué
  pidió él» vs «sobre qué recayó lo que hicimos». La fila legal prueba la diferencia; reusar uno la borraría.

## Mecanismo
- **Schema:** `clasesSolicitadas ClaseDatoTitular[] @default([])` en `SolicitudHabeasData`.
- **Migración (D-121, revisión de Datos):** array de enum — DEFAULT con cast explícito + CHECK `objeto_por_tipo`
  NOT VALID (`CONSULTA` → vacío; `RECTIFICACION`/`SUPRESION` → ≥1). Aditiva, no destructiva.
- **Service + ruta:** `superRefine` + code-gate que cortan con error LIMPIO antes del CHECK crudo. La ruta acepta
  el enum COMPLETO (el canal de soporte registra lo que la UI ofrezca).
- **UI (`PuertaSoporte.tsx`):** eje C multi-select con las SEIS clases (copy de Diseño, FORMA-SPEC827 `b87771e`,
  voz tú). `RELATO_CITA` muestra los límites de corregir el relato (`COPY_CORRECCION_RELATO`, §2 refrescado de
  FORMA-SPEC780 `e4b31da`) al elegirlo en una `RECTIFICACION`. La §3 [ABOGADO·tensión] NO se cablea (control
  legal sin cerrar).

## Candados
- **Objeto por tipo, en DOS capas** (`objeto-peticion-por-tipo.candado.test.ts`): CONDUCTA (service, error limpio)
  + INSERCIÓN (CHECK contra escrituras crudas). RED-first: sin el code-gate caen los de conducta, el CHECK sigue
  bloqueando.
- **UI (`PuertaSoporte-habeas-pregunta.candado.test.tsx`):** `CONSULTA` no muestra el objeto; `RECTIFICACION`/
  `SUPRESION` ofrecen las 6 clases y exigen ≥1 para enviar; multi-select nombra todas; los límites del relato solo
  en `RECTIFICACION`; sin plazo ni jerga. RED-first: sin el gate del objeto caen los de rechazo.
- **Copy (`copy-correccion-relato.candado.test.ts`):** los dos límites + el REFRESH v1.2 (habla por efecto, no
  enumera un solo disparador).

## FUERA de alcance
El flujo de RESPUESTA del operador · la bandeja (824) · la pantalla del padre que ve el estado (823) · `CONSULTA`
· la línea §3 [ABOGADO] (espera al abogado).

## Impacto en arquitectura:
- **Esquema / datos:** campo NUEVO `clasesSolicitadas` + CHECK `objeto_por_tipo` NOT VALID (D-121; Datos revisa la
  migración de array-de-enum). Aditiva; cero destructivo; sin radio de catálogo.
- **Proxy / navegación:** SIN cambios (no toca proxy, páginas nuevas ni menú; es un paso dentro de la puerta de
  soporte ya existente).
- **Tests:** +candado de objeto-por-tipo (2 capas) + candado de UI del eje C; `copy-correccion-relato` sale del
  allowlist de huérfanos (cableado) — salida autoexigida de `arch:check (i)`.
