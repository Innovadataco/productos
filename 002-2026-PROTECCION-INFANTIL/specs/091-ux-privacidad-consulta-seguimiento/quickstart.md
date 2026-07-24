# Quickstart — Spec 091: UX y privacidad de la consulta + seguimiento

## A. Privacidad de la consulta (US1)

1. En el home, buscar un identificador con reportes.
2. DevTools → Network: la llamada es `POST /api/consulta` con el identificador en el **body**; la URL del navegador NO cambia ni contiene el identificador.
3. Los resultados se muestran inline como antes (contrato 089 intacto; sin nivelRiesgo).

## B. Re-consultar el propio reporte (US2)

1. En el home, sección "Consultar el estado de mi reporte": escribir `RPT-XXXXXX` → "Ver estado de mi reporte".
2. El navegador va a `/seguimiento` **sin** `?numero=` en la URL y el estado se carga solo (sessionStorage, se limpia tras usarlo).

## C. Animación de estado (US3)

1. Seguimiento de un reporte en proceso: spinner girando una vez.
2. Seguimiento de un reporte procesado: 3 flechas encendiéndose izq→der + check verde con rebote. Corre una sola vez al cargar.

## D. Tests y gate

```bash
npx vitest run src/app/api/consulta/route.test.ts src/components/modules/HomePageClient.test.tsx src/components/modules/EstadoTransicion.test.tsx
npm run lint && npm run test && npm run build && npx tsc --noEmit
./scripts/dev-restart.sh
```
