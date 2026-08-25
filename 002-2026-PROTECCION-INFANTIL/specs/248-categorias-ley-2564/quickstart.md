# Quickstart: SPEC-248 — Categorías Ley 2564 completas + Definiciones legales editables

Verificación manual tras `./scripts/dev-restart.sh` con la migración y el seed aplicados.

## 1. Enum y seed

```bash
npx prisma migrate dev   # aplica agregar_categorias_ley_2564
npx prisma db seed       # siembra preguntas, definiciones, severidades, grupos
```

Verificar en `psql` (o `npx prisma studio`): `CategoriaConducta` tiene 15 valores; `AccionAudit` tiene el valor `RUBRICA_DEFINICION_UPDATE`.

## 2. Editor de definiciones legales (rol ADMIN)

1. Login como `ADMIN`.
2. Ir a `/admin/ia?tab=rubrica`.
3. Seleccionar `CIBERACOSO` en el selector de categoría.
4. Verificar el card ámbar ANTES de las preguntas: badge `CIBERACOSO`, "Ciberacoso" como `conductaLegal`, `Ley 2564 de 2026 · art. 6.e`, el texto literal del brief §6.
5. Click "Editar definición legal" → modal con 4 campos precargados.
6. Cambiar `definicionLiteral`, guardar.
7. Recargar la página → el cambio persiste.
8. Repetir para `HAPPY_SLAPPING` y `STALKING`, y para una categoría del grupo grooming (ej. `SOLICITUD_MATERIAL`) — confirmar que muestra `rolDentroDeConducta`.

## 3. Solo lectura (rol COMITE_VALIDACION)

1. Login como `COMITE_VALIDACION`.
2. Ir a `/admin/ia?tab=rubrica`, seleccionar cualquier categoría.
3. Verificar que el card se ve, pero SIN botón "Editar definición legal".

## 4. AuditLog

```bash
# vía Prisma Studio o psql
SELECT accion, "tipoRecurso", "recursoId", metadatos, "creadoEn"
FROM audit_log
WHERE accion = 'RUBRICA_DEFINICION_UPDATE'
ORDER BY "creadoEn" DESC LIMIT 5;
```

Confirmar que la edición del paso 2.6 quedó registrada con `metadatos.categoria = "CIBERACOSO"`.

## 5. Contrato del endpoint extendido

```bash
curl -s http://localhost:5005/api/admin/ia/rubrica -H "Cookie: token=<jwt-admin>" | jq 'keys'
# esperado: ["definiciones","modelos","modeloEmbudo","preguntas","temperatura","umbralPresencia"]
```

## 6. Simulación obligatoria (§7 del brief — antes de aceptar en prod)

```bash
npm run <script-simulacion-run>   # ver scripts/ existentes de evals del clasificador
```

Revisar el reporte: precision/recall/confusion matrix de las 14 categorías, sin regresión en las 11 previas, con los casos de bullying/stalking/happy-slapping ahora cayendo en la categoría correcta (antes `OTRO`).

## 7. Gate de calidad estándar (AGENTS.md)

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build && ./scripts/dev-restart.sh
```
