# Plan · SPEC-787 · Bandeja del verificador «Reportes que no coinciden»

## Enfoque

Cablear el hueco-funcional `estado-efectivo-incidente.ts` construyendo la bandeja que lo consume, en capas, de datos hacia la pantalla, con la simetría y la fuente única clavadas por candado.

## Capas

1. **Fuente única de clase.** Extraer `claseDeContradiccion(pregunta, padreValor, profesionalValor)` a `plazo-incidente.ts` y hacer que el cruce (SPEC-753) la reuse (conducta preservada). Así la bandeja deriva el reloj legal/interno con la MISMA regla que el cruce sembró.
2. **DAL** (`incidente-contradiccion.ts`): `listarAbiertos()` (where resueltoEn:null, `orderBy venceEn asc`, trae las dos encuestas), `findPorId`, `resolver`. Recibe `tx?` o cae al singleton (Q-3).
3. **Service + DTO** (`bandeja-incidentes.service.ts`): `aIncidenteDto` deriva `estado` + `incumplida = esIncumplimiento(estado)` (FUENTE ÚNICA) + `relojLegal`. `listarBandejaIncidentes(now)` arma el resumen contando la MISMA `incumplida`. `resolverIncidenteContradiccion`. Cablea `estado-efectivo-incidente.ts`.
4. **Endpoints**: GET `incidentes-contradiccion` (lista) y POST `[id]/resolver`, con `verifyAuth` + `assertModulo(admin_verificacion_profesionales)`.
5. **Copy** (`copy-incidente-verificador.ts`): rótulo que no adjudica, estado ámbar/neutro (nunca rubí), «a favor del padre» solo con reloj legal.
6. **UI**: `IncidenteContradiccionCard` (columnas simétricas, mismo className), `ReportesNoCoincidenClient` (resumen + lista + resolver→refetch), página server con gate.
7. **Salida autoexigida**: quitar `estado-efectivo-incidente.ts` de la allowlist de huérfanos en el MISMO commit.

## Candados

- `bandeja-incidentes.service.candado.test.ts` (integración): orden por venceEn (creado-después-vence-antes va primero); `esIncumplimiento` fuente única (resumen === detalle === recompute); control positivo (mover `now` sube conteo Y bandera juntos); cero contenido de sesión (presentación no viaja); simetría de shape.
- `IncidenteContradiccionCard.candado.test.tsx` (render): columnas mismo tono; **invertir quién dijo qué NO cambia el tono** (control positivo); nunca adjudica ni usa rubí; «a favor del padre» solo con reloj legal.

## Gates

`npx tsc --noEmit` · `npm run lint` · candados verdes (RED-first verificado) · `npm run arch:check` (VERDE con la allowlist encogida) · preflight `test:unit` completo. Sin cambio de esquema/enum → historial:check no aplica.
