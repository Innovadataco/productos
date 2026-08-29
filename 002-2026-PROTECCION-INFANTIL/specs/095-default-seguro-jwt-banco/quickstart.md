# Quickstart — Spec 095

## A. Default seguro (US1)

```sql
SELECT clave, valor FROM "ParametroSistema" WHERE clave='ia.rubrica.enabled';
-- esperado: false (legacy por defecto; activable a true para desarrollo de la rúbrica)
```
Reportar un texto: el pipeline usa el motor legacy (logs: modelo único × 5 votos, sin embudo).

## B. JWT parametrizado (US2)

- Cambiar `security.jwt_ttl_hours` en Configuración (p. ej. 1) → el próximo login emite token de 1h (verificar `exp - iat`).

## C. Banco gobernado (US3)

```sql
SELECT "fixtureVersion", COUNT(*) FROM "CasoEval" GROUP BY 1;
-- esperado: 1 → 110 (subordinado), 2 → 200 (gobernado)
npx tsx scripts/exportar-banco-simulacion.ts   # regenera el JSON desde CasoEval v2
```

## D. Adjudicación (US3b/c)

- Hoja de trabajo: `docs/adjudicacion-095-casos-disputa.md` (42 casos, votos por modelo, columnas vacías).
- Tras adjudicar: `npx tsx scripts/eval-dual-banco.ts 200` → comparación limpia legacy vs rúbrica (`resultados-dual-095.json`).

## E. Gate

```bash
npm run lint && npm run test && npm run build && npx tsc --noEmit
./scripts/dev-restart.sh
```
