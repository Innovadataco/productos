# AGENTS.md · Producto 005 · BI · Inteligencia de Negocio

> Reglas de código para todo agente IA que trabaje en este repo.
> Complementa `.specify/memory/constitution.md` (LEY vinculante).
> Origen: aprendizajes destilados de PI (58 patrones · 15 candados obligatorios).

---

## Contexto rápido

- **Proyecto:** Producto 005 · BI (Inteligencia de Negocio para IDC)
- **Uso Fase 1:** interno · Jelkin + Fábrica
- **Uso Fase 2/3:** módulos comerciales dentro de la app PI (colegios · padres Premium)
- **Stack:** Next.js 16 · TypeScript · Prisma · PostgreSQL (réplica) · Apache Superset · Vanna.ai · Ollama · Bot Telegram
- **Deploy:** VPS Hostinger (mismo que PI · red interna Docker · subdominio `tablero.pi.innovadataco.com`)
- **Ollama:** vive en Mac Studio · vía Tailscale (100.91.87.86:11435) · KEEP_ALIVE=24h

---

## §1 · Reglas duras (cero-negociables · mismas de PI + candados BI)

### Cinco Reglas de Oro (DoD mínima)
1. Spec Kit en todo (`.specify/specs/`)
2. Subir a GitHub tras cada fase
3. Siempre pruebas (unit + integración + E2E)
4. Siempre desplegable · que compile NO basta · verificación en vivo
5. Siempre documentar (`cierre.md` · `tasks.md` con casillas)

### Verde en CI ≠ funciona
Antes de decir REALIZADO: entrar a la app desplegada con el rol correspondiente · recorrer · reportar qué viste. 11 defectos encontrados en 2h con CI verde (aprendizaje PI 26-ago).

### Verificar en fuente · nunca suponer
- Contra código · `git` · `gh` · BD real
- Si `grep` da negativo · confirmar por segundo camino (AST · ejecución · BD)
- La ausencia de un resultado en `grep` **NO es evidencia de ausencia** (I-138 PI · separadores numéricos)

### Migraciones aditivas · jamás destructivas
- Nunca `prisma migrate reset` · nunca `DROP TABLE` sin autorización humana firmada
- `.claude/settings.local.json` deniega comandos destructivos por default
- Rebase que borre migración o revierte `schema.prisma` = HALLAZGO · PARA

### Un solo worker (advisory lock único)
- Tabla `WORKER_LOCK_IDS` versionada con `unique` en CI
- Todo worker con pg-boss llama `ensureQueue` antes de `work/schedule`
- Test de arranque contra BD vacía

### Healthcheck obligatorio
Todo servicio en `docker-compose*.yml` DEBE tener `healthcheck:`. Ratchet grep-based en CI que falla si aparece servicio sin healthcheck.

### Cero secretos en chat/commits/docs
- Valores solo en `.env` (fuera de git) y en `~/.config/bi-e2e/.env.e2e` (permisos 600)
- En documentos y chat siempre puntero: `ver INVENTARIO-DE-SECRETOS.md`
- Pre-commit hook detecta `sk-` · `xoxb-` · `PARAM_*_KEY` · `password:`

### `Date` nativo prohibido para aritmética temporal
- `date-fns-tz` obligatorio
- `TZ=America/Bogota` en contenedores
- `@db.Timestamptz(6)` explícito en Prisma
- Origen: D-69 PI (bug real cerca de medianoche descubrió que faltaba TZ en 4 contenedores)

### Un Desarrollo · un worktree
`git worktree add ../bi-<SPEC>` obligatorio antes de arrancar en paralelo. Origen: D-82 PI (I-109 fue cuasi-catástrofe).

### `rm -rf .next` (o equivalente Turbopack/Vite) antes de creer un build
Cachés viejas causan verdes falsos. Aplicable a cualquier bundler.

### Push único al final del SPEC
Gate LOCAL completo por fase antes de PUSH único. Origen: D-54 PI.

### Máximo 2 iteraciones CI por síntoma
Al 3er rojo del mismo síntoma → PARA + avisa CEO. Origen: D-55 PI.

### Payload real en tests
Los tests envían el mismo JSON que envía el componente cliente · NUNCA versión inventada. Origen: I-126 PI (CI verde sobre payload inventado).

### Seed idempotente `upsert` con `update:{}`
Test que corre seed 2 veces y aserta cero cambios en la 2ª pasada. Origen: I-69 · I-108 PI.

### Ratchet de índices post-migración en CI
Script `verificar-indices-post-migrate.mjs` compara `pg_indexes` real vs lista canónica. Falla el pipeline si desaparece un índice crítico (HNSW · trigram). Origen: A-45 PI.

---

## §2 · Reglas específicas del motor NL-to-SQL (candados 1-10 de CONSTITUTION.md §3)

Cualquier función que llame a Ollama para generar SQL DEBE respetar:

### 1. Enum cerrado JSON Schema
```typescript
const schema = {
  type: "object",
  properties: {
    tabla_idx: { type: "integer", minimum: 0, maximum: TABLAS_PERMITIDAS.length - 1 },
    columnas_idx: { type: "array", items: { type: "integer" } },
    operadores: { type: "array", items: { enum: ["=", "!=", "<", ">", "<=", ">=", "LIKE"] } },
  },
  required: ["tabla_idx", "columnas_idx"],
  additionalProperties: false,  // OBLIGATORIO
}
```

### 2. Structured outputs · temp 0 · seed 42
```typescript
await ollama.chat({
  model: process.env.LLM_MODEL_SQL || "qwen2.5:14b",
  format: schema,  // Structured output nativo
  options: { temperature: 0, seed: 42 },
});
```
Si no parsea · se tira · NO se rescata a la fuerza.

### 3. Índices numéricos vs strings verbatim
Presento catálogo enumerado al LLM · el LLM devuelve `{tabla_idx: 3}` · el servidor traduce a `"Reporte"`. Elimina paráfrasis.

### 4. Descomposición en checks atómicos (deny-by-default)
En vez de "¿qué me pides?" → checks: `¿métrica?` `¿dimensión temporal?` `¿filtros?` `¿agrupación?`. Si falta uno · no se genera SQL · se pide clarificación.

### 5. Jurado 2/3 modelos
2-3 modelos generan SQL en paralelo. Canonicalizar AST. Si ≥2/3 NO coinciden → `estado = "REVISION"` · no se ejecuta.

### 6. Reglas determinísticas ANTES y DESPUÉS
- **Pre-LLM:** regex bloquea intención destructiva (`DROP`, `DELETE`, `UPDATE`, "borra", "elimina") ANTES de llamar al LLM
- **Post-LLM:** valida SQL generado (whitelist tablas · `LIMIT` obligatorio · sin cross-join sin claves · sin columnas PII sin permiso)
- Las guardas NUNCA reclasifican · solo escalan a revisión humana

### 7. Cache semántico de veredictos HUMANOS
Tabla `nl_query → sql_aprobado` (solo entradas confirmadas por operador humano). Nueva pregunta busca hits ≥ umbral y devuelve SQL humano SIN llamar al LLM.

### 8. Catálogo como DATO editable en BD
Tabla `CatalogoBI` con tablas · columnas · sinónimos · glosario. Schema JSON del LLM se construye dinámicamente contra el catálogo vigente. Cambio de esquema = UPDATE en BD · no despliegue.

### 9. Si no hay dato · NO INVENTA
Cuando el LLM devuelve "no encontré datos" → plantilla determinista: *"No hay datos operativos para esa consulta. Puede ser que aún no se registren eventos de esa categoría o el criterio sea muy específico."* Nunca completa con supuestos.

### 10. Plantillas deterministas para salida narrativa
LLM genera SQL + elige plantilla. La cifra numérica viene del ResultSet · NUNCA texto libre del modelo. Plantilla: `"En tu colegio hubo {N} reportes en {periodo}, la categoría más frecuente fue {X}"` con slots vinculados a filas de la consulta.

---

## §3 · Reglas específicas de multi-tenancy (candados 11-13)

### 11. Guard de tenancy · rechazo automático de SQL sin `WHERE tenant_id`
3 capas: middleware app + prompt engineering + validación SQL post-generación. Test: "usuario A intenta URL de tenant B en cada endpoint" (D-89 PI). Rechazo automático · nunca ejecuta.

### 12. Traza completa por consulta
Cada consulta guarda en tabla `ConsultaBI`: prompt · esquema visto · SQL propuesto · plan ejecución · filas devueltas · plantilla usada · latencia por paso · usuario · IP · timestamp. Panel `/admin/consultas/{id}`.

### 13. Sanitizer PII antes de emitir al usuario
Toda respuesta pasa por sanitizer que busca patrones (`\d{10}` · emails · direcciones · nombres del schema). Ratchet grep-based CI · falla si aparece PII cruda en el path de respuesta al cliente. Origen: I-28 PI.

---

## §4 · Estructura del repo

```
005-2026-BI-INTELIGENCIA-NEGOCIO/
├── .specify/
│   ├── memory/
│   │   └── constitution.md   ← copia sincronizada del gestión
│   └── specs/                 ← todas las BI · SPEC-XXX
├── src/
│   ├── app/                   ← Next.js app router · frontend BI
│   ├── lib/
│   │   ├── ai/                ← motor NL-to-SQL (candados 1-10)
│   │   ├── catalogo/          ← catálogo dinámico (candado 8)
│   │   ├── seguridad/         ← tenancy + validación SQL (candados 11-13)
│   │   └── observabilidad/    ← traza por consulta (candado 12)
│   └── ...
├── scripts/
│   ├── deploy-bi-prod.sh                        ← solo Jelkin ejecuta
│   ├── verificar-indices-post-migrate.mjs       ← ratchet A-45
│   └── worker-*.mjs                             ← con ensureQueue
├── prisma/
│   ├── schema.prisma                            ← warehouse BI (réplica read-only + tablas propias)
│   ├── migrations/                              ← aditivas · nunca destructivas
│   └── seed.ts                                  ← idempotente upsert con update:{}
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/                                     ← Calidad
├── docker-compose.yml
├── docker-compose.prod.yml
├── .github/workflows/                           ← CI en la raíz (nunca en subcarpeta · I-34 PI)
├── AGENTS.md                                    ← este archivo
├── README.md
└── package.json
```

---

## §5 · Comandos comunes

### Verificaciones locales (antes de push)
```bash
rm -rf .next   # limpiar cache Next.js (obligatorio antes de creer build)
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run arch:check           # ratchet arquitectónico
npm run ratchets:check       # ratchet grep-based (PII · SQL directo · etc)
```

### Docker local (dev)
```bash
docker-compose up -d
docker-compose logs -f app
docker-compose exec app npm run <script>
```

### Deploy prod (SOLO Jelkin ejecuta)
```bash
./scripts/deploy-bi-prod.sh   # bloqueado para IA por classifier
```

---

## §6 · Rutas peligrosas (leer suite completa si tocas)

Cuando cualquier SPEC toque estos archivos · Fábrica exige recorrido E2E de TODOS los roles antes de aprobar:

- `middleware.ts` · guard de auth · tenancy · rutas exentas
- `src/lib/proxy.ts` (si existe) · redirecciones por rol
- `src/lib/ai/motor.ts` · motor NL-to-SQL (candados 1-10)
- `src/lib/seguridad/tenancy.ts` · guard multi-tenant (candado 11)
- `src/lib/seguridad/validador-sql.ts` · post-validador SQL (candado 6)
- `src/lib/catalogo/*.ts` · catálogo dinámico (candado 8)
- `prisma/schema.prisma` · esquema BD
- `.github/workflows/*.yml` · CI

---

## §7 · Correcciones honestas

Si detectas un error tuyo · asúmelo abiertamente en `03-EJECUCION/04-INCIDENCIAS.md` del repo gestión (via Fábrica) marcado `"corrección honesta <rol>"`. **No se esconde.** Precedentes PI: I-66 · I-68 · I-69.

---

## 📋 Control del documento

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 |
| **Autor** | CEO IDC (mediante instructivo · Desarrollo revisará) |
| **Aprobado** | Jelkin Zair Carrillo Franco |
| **Estado** | 🟢 Vigente |
