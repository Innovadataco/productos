# Tasks · SPEC-813

## Fase 1 · Derivación pura (mecanismo, sin copy) — HECHA
- [x] **T1** · `clasificarAvisoReps` + `debeMostrarAvisoCaducadoReps` + `requiereRevisionAdminReps` en
  `src/lib/profesional/reps/aviso-estado-reps.ts`. Discrimina por HECHO + relojes; fail-closed; `switch`
  exhaustivo (5º `EstadoReps` rompe `tsc`).
- [x] **T2** · Candado `aviso-estado-reps.candado.test.ts`: 8 estados + control positivo por mutación +
  atado por conducta a `repsElegible` + exhaustividad. RED-first verificado (7→`CADUCADO` lo pone rojo).
- [x] **T3** · Registro en `vitest.unit.includes.ts` (carril que bloquea vía `pi-gate`).
- [x] **T4** · Estado 8: verificado IMPOSIBLE (CHECK VALIDADO) + ya lockeado por el candado D-121 de #792.

## Fase 2 · Superficies — HECHA (#792 en main `4edc94d98` + forma v4.1)
- [x] **T5** · Wiring: `PerfilProfesionalRepository.clasificarReps()` + `avisoReps` en `PanelProfesionalDto`
  (populate en `panelDelProfesional`); `avisoReps`+`zonaAdmin` en `RepsCargaItem` (`listarParaCargaReps`).
- [x] **T6** · Banner al profesional (`AvisoRepsCaducado` en `PanelProfesional.tsx`), gate `avisoReps ===
  "CADUCADO"`; copy v4.1 (ámbar, cero rubí, conserva acceso, no promete reasignación/notificación, no
  predica «habilitado»); enlace a `/dashboard/profesional/mi-perfil` + bloque REPS «qué significa y cómo
  renovar» en `MiPerfilProfesionalClient` (el enlace no es callejón).
- [x] **T7** · Alarma de admin §5-bis en `CargaVerificacionRepsClient`: dos zonas por `zonaAdmin` —
  «Revisar» (5 prominente + conteo, 8 debajo) y «Re-verificar» (7, callada). Derivación pura `zonaAdminReps`
  (lockeada en `aviso-estado-reps.candado.test.ts`).
- [x] **T8** · Candados UI: `aviso-reps-caducado.candado.test.tsx` (gate + copy 811/813 + no-promesa +
  conserva acceso + enlace) y `alarma-admin-reps.candado.test.tsx` (zonas distintas 5≠7 + conteo + «la
  acción es nuestra» para 7 + «no aparece» para 5). RED-first verificado (gate + copy + jerarquía).

## Notas Fase 2
- `aviso-estado-reps.ts` quedó CABLEADO (lo importa `perfil-profesional.ts` → panel + admin) → se quitó del
  allowlist de huérfanos en el MISMO PR (salida autoexigida).
- `modalidadesRepsNoMapeadas()` / la ingesta por modalidad (T5 de 790) sigue sin existir (Datos Abiertos da
  solo inscripción, anual, sin modalidad/vigencia; portal con login).

## Notas
- Rama adelantada sobre #792; al mergear #792 (`--squash`): ramificar limpio de `origin/main` y
  **cherry-pick** de los commits de 813 (NO rebase).
- Cruce con SPEC-814 (reubicación / T7, Dev 2): si el estado 5 (`NO_ENCONTRADA`) debiera disparar
  reubicación, es decisión del CEO — las dos specs están separadas a propósito.
