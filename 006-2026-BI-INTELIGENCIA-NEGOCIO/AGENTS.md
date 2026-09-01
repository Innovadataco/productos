# AGENTS.md · Producto 006 · Inteligencia de Negocio (BI v2)

> Reglas de código para todo agente IA que trabaje en este repo.
> Complementa `.specify/memory/constitution.md` (LEY vinculante).
> Origen: aprendizajes destilados de PI y del BI v1 (005) — 005 queda intacto SOLO como referencia/cantera; nunca se arregla pieza por pieza ni se escribe en él.

---

## Contexto rápido

- **Proyecto:** Producto 006 · Inteligencia de Negocio (BI v2) — sucesor de `005-2026-BI-INTELIGENCIA-NEGOCIO` (BI v1, congelado como referencia).
- **Alcance del negocio:** análisis descriptivo de la operación de PI (qué pasó, qué está pasando, histórico): reportes por fechas, tendencias, comportamientos, proyecciones y estadísticas. El modelo genera SQL de SOLO LECTURA contra la réplica.
- **Dominio:** `https://bi.innovadataco.com/`
- **Stack:** Next.js 16 · TypeScript · Tailwind · Prisma · PostgreSQL (réplica read-only de PI) · Ollama (1 modelo `qwen2.5:14b`) · Dashboards nativos (Tremor/Recharts/ECharts)
- **Auth:** LOGIN PROPIO, cerrado por defecto: sin sesión válida no se ve nada. BI **NO comparte login/JWT/cookie/secreto con PI** (decisión CEO 31-08-2026). Credenciales hasheadas (bcrypt/argon2), jamás en claro; jamás pasar `rol` por body del cliente.
- **Rama única:** `work/bi-SPEC-006-bi-v2` · worktree `.worktrees/bi-SPEC-006-bi-v2` · de ella salen TODOS los PRs y NO se borra tras merge — se rebasa sobre `main` (ver §7).
- **Deploy:** Docker Compose en VPS Hostinger (mismo VPS que PI, stack separado). BI corre aparte de PI a propósito: las consultas pesadas de BI no deben afectar la operación de PI.
- **Ollama:** vive en Mac Studio · vía Tailscale (`100.91.87.86:11435`) · KEEP_ALIVE=24h
- **Eliminado para siempre:** Superset, Vanna, jurado de 3 modelos, login propio con clave en claro, paso de `rol` por body. En el VPS ya se borraron esos contenedores/volúmenes y se paró el stack de BI v1. PI sigue corriendo intacto: NO tocarlo.
- **Reutilizado de 005:** catálogo BI (`BICatalogoTabla/Columna/Metrica/Ejemplo` + seed), vistas materializadas `mv_fact_*`, scripts de réplica pg_logical, conceptos `BIConsultaLog` y `BICacheSemantico`.

---

## §1 · Reglas duras (cero-negociables)

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
`git worktree add ../006-<SPEC>` obligatorio antes de arrancar en paralelo. Origen: D-82 PI (I-109 fue cuasi-catástrofe).

### `rm -rf .next` (o equivalente Turbopack/Vite) antes de creer un build
Cachés viejas causan verdes falsos. Aplicable a cualquier bundler.

### Push en cada checkpoint (G3 · CEO 31-08-2026)
Lo no pusheado NO EXISTE: push en cada checkpoint, no uno único al final del SPEC. Deroga la regla "push único" de PI para este producto.

### Rama única del frente (CEO 31-08-2026)
`work/bi-SPEC-006-bi-v2`. De ella salen TODOS los PRs; tras cada merge la rama NO se borra — se rebasa sobre `main`. Una rama = un frente vivo. Deroga la convención "una rama por spec" del `AGENTS.md` raíz para el 006, por orden directa del CEO.

### Máximo 2 iteraciones CI por síntoma
Al 3er rojo del mismo síntoma → PARA + avisa CEO. Origen: D-55 PI.

### Payload real en tests
Los tests envían el mismo JSON que envía el componente cliente · NUNCA versión inventada. Origen: I-126 PI (CI verde sobre payload inventado).

### Seed idempotente `upsert` con `update:{}`
Test que corre seed 2 veces y aserta cero cambios en la 2ª pasada. Origen: I-69 · I-108 PI.

### Ratchet de índices post-migración en CI
Script `verificar-indices-post-migrate.mjs` compara `pg_indexes` real vs lista canónica. Falla el pipeline si desaparece un índice crítico (HNSW · trigram). Origen: A-45 PI.

---

## §2 · Reglas específicas del motor NL-to-SQL (candados 1-10)

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

### 2. Structured outputs · temp 0 · seed 42 · UN solo modelo
```typescript
await ollama.chat({
  model: process.env.LLM_MODEL_SQL || "qwen2.5:14b",
  format: schema,  // Structured output nativo
  options: { temperature: 0, seed: 42 },
});
```
Un solo modelo (`qwen2.5:14b` en la Mac Studio). Si no parsea · se tira · NO se rescata a la fuerza.

### 3. Índices numéricos vs strings verbatim
Presento catálogo enumerado al LLM · el LLM devuelve `{tabla_idx: 3}` · el servidor traduce a `"Reporte"`. Elimina paráfrasis.

### 4. Descomposición en checks atómicos (deny-by-default)
En vez de "¿qué me pides?" → checks: `¿métrica?` `¿dimensión temporal?` `¿filtros?` `¿agrupación?`. Si falta uno · no se genera SQL · se pide clarificación.

### 5. Un solo modelo + validador post-LLM estricto
No hay jurado de modelos: el único modelo genera SQL y un validador determinista post-LLM lo somete a TODAS las guardas (whitelist de tablas, `LIMIT` obligatorio, sin cross-join sin claves, sin columnas PII sin permiso, solo `SELECT`). Si la salida no parsea o no valida → NO se ejecuta · se pide clarificación al usuario. Jamás se ejecuta SQL no validado "a ver qué pasa".

### 6. Reglas determinísticas ANTES y DESPUÉS
- **Pre-LLM:** regex bloquea intención destructiva (`DROP`, `DELETE`, `UPDATE`, "borra", "elimina") ANTES de llamar al LLM
- **Post-LLM:** valida SQL generado (whitelist tablas · `LIMIT` obligatorio · sin cross-join sin claves · sin columnas PII sin permiso)
- Las guardas NUNCA reclasifican · solo escalan a revisión humana

### 7. Cache semántico de veredictos HUMANOS
Tabla `BICacheSemantico` (`nl_query → sql_aprobado`, solo entradas confirmadas por operador humano). Nueva pregunta busca hits ≥ umbral y devuelve SQL humano SIN llamar al LLM.

### 8. Catálogo como DATO editable en BD
Tablas `BICatalogoTabla/Columna/Metrica/Ejemplo` con tablas · columnas · sinónimos · glosario. Schema JSON del LLM se construye dinámicamente contra el catálogo vigente. Cambio de esquema = UPDATE en BD · no despliegue.

### 9. Si no hay dato · NO INVENTA
Cuando el LLM devuelve "no encontré datos" → plantilla determinista: *"No hay datos operativos para esa consulta. Puede ser que aún no se registren eventos de esa categoría o el criterio sea muy específico."* Nunca completa con supuestos.

### 10. Plantillas deterministas para salida narrativa
LLM genera SQL + elige plantilla. La cifra numérica viene del ResultSet · NUNCA texto libre del modelo. Plantilla: `"En {periodo} hubo {N} reportes; la categoría más frecuente fue {X}"` con slots vinculados a filas de la consulta.

---

## §3 · Reglas específicas de multi-tenancy (candados 11-13)

### 11. Guard de tenancy · rechazo automático de SQL sin `WHERE tenant_id`
3 capas: middleware app + prompt engineering + validación SQL post-generación. Test: "usuario A intenta URL de tenant B en cada endpoint" (D-89 PI). Rechazo automático · nunca ejecuta.

### 12. Traza completa por consulta
Cada consulta guarda en tabla `BIConsultaLog`: prompt · esquema visto · SQL propuesto · plan ejecución · filas devueltas · plantilla usada · latencia por paso · usuario · IP · timestamp. Panel `/admin/consultas/{id}`.

### 13. Sanitizer PII antes de emitir al usuario
Toda respuesta pasa por sanitizer que busca patrones (`\d{10}` · emails · direcciones · nombres del schema). Ratchet grep-based CI · falla si aparece PII cruda en el path de respuesta al cliente. Origen: I-28 PI.

---

## §4 · Estructura del repo

```
006-2026-BI-INTELIGENCIA-NEGOCIO/
├── .specify/
│   ├── memory/
│   │   └── constitution.md   ← copia sincronizada del gestión
│   └── specs/                ← todas las specs · SPEC-XXX
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/         ← login propio BI (sesión cerrada por defecto)
│   │   │   └── bi/
│   │   │       ├── preguntar/      ← motor NL→SQL
│   │   │       ├── kpis/           ← KPIs live
│   │   │       └── estado-sistema/ ← salud réplica · MVs · Ollama
│   │   ├── login/            ← pantalla de login propio
│   │   ├── dashboard/        ← home con KPIs
│   │   ├── chat/             ← chat NL→SQL
│   │   └── operacion/        ← tablero operativo (OBLIGATORIA antes del corte de dominio)
│   ├── components/
│   │   ├── bi/               ← componentes BI (gráficas Tremor/Recharts/ECharts)
│   │   └── ui/               ← componentes base (copiados de PI)
│   └── lib/
│       ├── auth/             ← sesión propia BI (credenciales hasheadas · fail-closed)
│       ├── bi/               ← motor NL→SQL (candados 1-10) · llama Ollama directo vía Tailscale
│       ├── catalogo/         ← catálogo dinámico (candado 8)
│       └── observabilidad/   ← logs y métricas (candado 12)
├── prisma/
│   ├── schema.prisma         ← catálogo BI + logs + cache semántico (réplica read-only + tablas propias)
│   ├── migrations/           ← MVs `mv_fact_*` y schema · aditivas, nunca destructivas
│   └── seed.ts               ← idempotente upsert con update:{}
├── scripts/
│   ├── replica-setup/        ← configuración réplica pg_logical (rescatada de 005)
│   ├── verificar-indices-post-migrate.mjs  ← ratchet A-45
│   └── worker-*.mjs          ← con ensureQueue
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/                  ← Playwright
├── .github/workflows/        ← CI en la raíz (nunca en subcarpeta · I-34 PI)
├── docker-compose.yml        ← dev local
├── docker-compose.bi.yml     ← stack BI · SIN Superset ni Vanna
├── AGENTS.md                 ← este archivo
├── README.md
└── package.json
```

Sin `_legacy`: BI v1 vive intacto en `/Users/idc/Documents/GitHub/productos/005-2026-BI-INTELIGENCIA-NEGOCIO` (solo lectura).

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
docker compose -f docker-compose.bi.yml up -d
docker compose -f docker-compose.bi.yml logs -f app
docker compose -f docker-compose.bi.yml exec app npm run <script>
```

### Base de datos (Fase 1b · Prisma + PostgreSQL propio `bi-db`)
```bash
npm run db:generate   # regenera el cliente Prisma (tras cambiar schema.prisma)
npm run db:migrate    # prisma migrate deploy — ADITIVAS, jamás destructivas
npm run db:seed       # seed idempotente: upsert({create:{...}, update:{}})
```
En producción, migrate y seed **NO corren en la imagen standalone** (no lleva
prisma CLI ni tsx): corren vía el servicio one-shot `bi-migrate` (target `tools`
del Dockerfile · profile `tools` del compose), que `scripts/deploy-bi006.sh`
invoca en los pasos [3/6] y [4/6]. Manual:
```bash
docker compose -f docker-compose.bi.yml --profile tools run --rm bi-migrate                     # migrate deploy
docker compose -f docker-compose.bi.yml --profile tools run --rm bi-migrate npx prisma db seed  # seed
```

### Deploy prod (estructura S2 · merge y deploy autorizados a la IA por Jelkin 01-09-2026)
```bash
ssh pi-vps 'cd /opt/proteccion-infantil/bi-repo/006-2026-BI-INTELIGENCIA-NEGOCIO && ./scripts/deploy-bi006.sh'
```

---

## §6 · Rutas peligrosas (leer suite completa si tocas)

Cuando cualquier SPEC toque estos archivos · Fábrica exige recorrido E2E de TODOS los roles antes de aprobar:

- `middleware.ts` · guard de sesión propia BI (cerrado por defecto) · rutas exentas (`/login` y su API)
- `src/lib/auth/*` · login propio BI (hash · fail-closed · helper central de sesión, ver §7 SE1-SE4)
- `src/lib/bi/*` · motor NL→SQL (candados 1-10)
- `src/lib/bi/validador-sql.ts` · validador post-LLM estricto (candados 5-6)
- `src/lib/catalogo/*.ts` · catálogo dinámico (candado 8)
- `prisma/schema.prisma` · esquema BD
- `docker-compose.bi.yml` · stack BI (healthchecks obligatorios)
- `scripts/replica-setup/**` · réplica read-only de PI (NUNCA escribir contra PI primaria)
- `.github/workflows/*.yml` · CI

---

## §7 · Playbook operativo (CEO 31-08-2026 · lo que PI pagó caro)

### Git
- **G1:** nunca push a `main` · nunca force-push · nunca reescribir historia · nunca borrar ramas ajenas · todo por PR.
- **G2:** `git add` SIEMPRE acotado a `006-2026-BI-INTELIGENCIA-NEGOCIO/` (única excepción autorizada: tu propio workflow nuevo en `.github/workflows/`). Jamás `-A` ni `.` en la raíz.
- **P4:** el síntoma no es la causa raíz: antes de arreglar un guard "que deja pasar", grep de si su condición SE EVALÚA alguna vez.
- **P5:** evidencia EN EL PR: comando + salida real + consulta BD. Mejor aún, negativa (sin el cambio, el defecto persiste).

### Docker/VPS
- **D1:** healthcheck en TODO contenedor + `restart: unless-stopped` + logs con rotación (`max-size`) para no llenar el disco.
- **D2:** inventariar puertos ocupados antes de asignar. Red propia de compose, nombres con prefijo `bi-`.
- **D3 · Next.js en Docker (las 4 minas del 005):** (a) pin EXACTO de prisma; (b) `output: 'standalone'` + Dockerfile que copia `.next/standalone` + `.next/static` + `public`; (c) el build necesita devDependencies; (d) env de runtime por `env_file`, nunca horneado en la imagen.
- **D4 · Redirects detrás de proxy:** con bind `0.0.0.0`, `request.url` MIENTE. Todo redirect absoluto usa `x-forwarded-host` con fallback a env (esto tumbó producción una vez).
- **D5:** `pg_dump` NO existe en el contenedor de la app: backups vía el contenedor db.

### Deploy
- **S1:** el script de deploy se PRUEBA COMPLETO antes de mergearlo (build + migrate + seed + healthcheck + verificación BD). Mergear sin probarlo = problemas en producción.
- **S2:** estructura: reset a `origin/main` → imagen etiquetada con el hash → `migrate deploy` → seed → up → healthcheck → bloque "DEPLOY VERIFICADO: `<hash>`". Rollback por tag de imagen anterior.
- **S3:** seed EXPLÍCITO en cada deploy e idempotente: `upsert({create:{...}, update:{}})` — update vacío, nunca pisar lo que el admin editó a mano.

### BD
- **B2:** si una migración asume algo de los datos, que FALLE EN VOZ ALTA si el supuesto no se cumple. Nunca adivinar en silencio.
- **B3:** límites, umbrales y textos = parámetros en BD con seed, nunca constantes en el código.

### Sesión/Guards (el bug más repetido de PI: 5 veces el mismo patrón)
- **SE1:** si cacheás estado de sesión: CADA endpoint que lo cambie re-emite el caché EN LA MISMA RESPUESTA, vía UN helper central. Inline en cada endpoint = el próximo lo olvida.
- **SE2:** si el caché de sesión no se puede leer: para login/acceso, fail-closed.
- **SE3:** guards nuevos: el destino de cada redirect debe estar exento en TODOS los guards que corren después (un bucle así casi cierra PI a todos los usuarios nuevos).
- **SE4:** el usuario NUNCA queda atrapado: salir y cambiar contraseña siempre alcanzables, probado ruta por ruta.

### Tests
- **T2:** tests de TODO lo que toca lo editado, no solo del archivo abierto.
- **T4:** la CI migra su BD desde cero: tus migraciones corren limpias en vacío.

### Infra 005 y VPS (estado real verificado, CEO 31-08-2026)
- Contenedores del 005 APAGADOS por orden de Jelkin y así se quedan: NO reusarlos ni levantarlos; crear los propios desde cero. Sus puertos quedaron libres.
- En el VPS, el clon de despliegue de BI es `/opt/proteccion-infantil/bi-repo/` (PI usa `/opt/proteccion-infantil/repo/`: NO tocar).
- `.env.bi.production` lo crea Jelkin (permisos 600, fuera de git) en `006-2026-BI-INTELIGENCIA-NEGOCIO/` dentro de ese clon. La IA define solo NOMBRES de variables y se los pide; nunca escribe ni lee ese archivo.
- Réplica: reusar rol `bi_replica` y PUBLICACIÓN `bi_replica` del Postgres de PI (lista explícita de tablas operativas). PROHIBIDO replicar tablas con PII cruda (`Usuario`, `Password`, `Session`): datos de menores jamás llegan a BI (Ley 1581). Tabla nueva en la publicación = se pide por nombre y la autoriza Jelkin.
- Slot de réplica: apagar la réplica un rato no pasa nada; retirarla DE FORMA PERMANENTE sin `pg_drop_replication_slot` acumula cambios hasta llenar el disco y TUMBAR PI. El slot del 005 ya fue eliminado: se parte de cero.

---

## §8 · Correcciones honestas

Si detectas un error tuyo · asúmelo abiertamente en `03-EJECUCION/04-INCIDENCIAS.md` del repo gestión (via Fábrica) marcado `"corrección honesta <rol>"`. **No se esconde.** Precedentes PI: I-66 · I-68 · I-69.

---

## 📋 Control del documento

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **Fecha** | 2026-09-01 |
| **Autor** | CEO IDC (mediante instructivo · Desarrollo revisará) |
| **Aprobado** | Jelkin Zair Carrillo Franco |
| **Estado** | 🟢 Vigente |
