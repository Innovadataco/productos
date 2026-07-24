# Quickstart — Spec 089: presentación al usuario

## A. Estados (US1)

- Seguimiento de un reporte propio: solo "En proceso" / "Procesado" (nunca "Verificado").

## B. Clasificador (US2)

- Un texto que el modelo votará OTRO (p. ej. "me dijo cosas raras") → queda `REVISION_MANUAL` aunque sea unánime con confianza 1.0 (verificar en la bandeja del operador).
- Ranking por gravedad: `npx vitest run src/lib/ai/classifier-votos.test.ts`.

## C. Predicado único (US3) — la prueba del conteo

1. Crear para un mismo identificador: 2 reportes que clasifiquen SPAM + 1 OTRO + 1 con riesgo real (EXTORSION).
2. `GET /api/consulta?identificador=...` → `totalReportes = 1` (antes: 4).
3. El dashboard público y el score interno del identificador cuentan lo mismo (1).

## D. Consulta pública (US4/US5/US6)

- Anónimo: ve totales, señal "Actividad baja/alta de reportes", resumen de plataformas, categorías (sin SPAM/OTRO), ubicación por PAÍS. NO ve `nivelRiesgo`, score, timeline ni ciudad.
- Autenticado: además ve departamento/ciudad, timeline, fechas e informe.
- El detalle se muestra aunque haya 1 solo reporte (nada de "sin información suficiente").
- Plataformas: conteos correctos (sin "(undefined)").

## E. Seguimiento (US4/US7)

- Reporte propio: muestra todas las conductas identificadas ordenadas por gravedad; "No se identifica riesgo" si solo SPAM/OTRO; "Gracias por reportar."; actividad del identificador SIN score ni etiqueta de riesgo.

## F. Bugs UI (US8)

- Menú lateral: en `/dashboard/admin/spam` solo "Revisión de spam" está resaltado.
- Comité: cambiar entre tabs Bandeja/Gestión/Auditoría sin salto de layout.

## G. Gate

```bash
npm run lint && npm run test && npm run build && npx tsc --noEmit
./scripts/dev-restart.sh
```
