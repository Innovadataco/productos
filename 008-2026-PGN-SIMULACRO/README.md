# Simulacro PGN 2026 — INNOVADATACO

App de simulacro de exámenes para dos candidatos del concurso PGN 2026:

- **JELKIN ZAIR CARRILLO FRANCO** → Conv. 52 · Asesor 1AS-19 · Oficina TIC · Bogotá
- **DIANA MARCELA CÁCERES VALDERRAMA** → Conv. 89 · Procuradora Judicial II · Nacional

Stack: **Next.js 14 (App Router) + Tailwind CSS + TypeScript**. Sin auth, sin backend, sin base de datos propia. El banco de preguntas vive en una hoja pública de Google Sheets y se consulta desde el cliente.

## Setup

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

El `NEXT_PUBLIC_SHEET_ID` ya está configurado como fallback en `lib/sheets.ts`. Si necesitas sobreescribirlo, crea `.env.local`:

```bash
NEXT_PUBLIC_SHEET_ID=16S3fArXSV_2yAFOcK-49GD8yOzlG7du3mr8ztPGjEYI
```

## Google Sheets (banco de preguntas)

Hoja pública actual: https://docs.google.com/spreadsheets/d/16S3fArXSV_2yAFOcK-49GD8yOzlG7du3mr8ztPGjEYI/gviz/tq?tqx=out:json

1. Si creas una hoja nueva, ponla como **público o "cualquiera con el enlace → Lector"**.
2. Pega esta fila 1 (encabezados, columnas A–L):

```
id | perfil | tema | pregunta | opcion_0 | opcion_1 | opcion_2 | opcion_3 | respuesta | explicacion | norma | dificultad
```

3. Columnas:

| Col | Campo | Valores |
|-----|-------|---------|
| A | `id` | número |
| B | `perfil` | `Jelkin` \| `Diana` \| `Ambos` |
| C | `tema` | nombre del tema tal cual aparece en `lib/types.ts` (p. ej. `Contratación`, `Derecho penal`) |
| D | `pregunta` | texto (filas vacías en esta columna se ignoran) |
| E–H | `opcion_0`…`opcion_3` | 4 opciones |
| I | `respuesta` | 0–3 (índice de la correcta) |
| J | `explicacion` | texto |
| K | `norma` | texto (opcional) |
| L | `dificultad` | `facil` \| `medio` \| `dificil` |

4. La app consume la hoja vía `https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:json` (parsing en `lib/sheets.ts`).

## Temas por perfil

- **Jelkin:** Contratación (25h), Procuraduría (10h), Técnicos TI (8h), Simulacro mixto.
- **Diana:** Derecho constitucional (15h), Derecho administrativo (12h), Derecho penal (10h), Derecho laboral (8h), Infancia y familia (8h), Derecho civil (6h), Simulacro mixto.

El "Simulacro mixto" toma todas las preguntas del perfil activo (incluidas las de `perfil = Ambos`), mezcladas, máximo 20 por intento.

## Estructura

```
app/            layout, página de selección de perfil, home, quiz/[tema], result/[tema]
components/     ProfileCard, Header, TopicCard, OptionButton, FeedbackBox, ScoreRing, ProgressBar, SkeletonCard
hooks/          useProfile, useProgress, useQuestions
lib/            types.ts (temas y tipos), sheets.ts (fetch + parser gviz + cache), storage.ts (localStorage)
```

## Persistencia (localStorage)

- `pgn_perfil` → `Jelkin` | `Diana`
- `pgn_progress` → `{ Jelkin: { [tema]: {correct,total} }, Diana: { ... } }`

## Build y deploy (estilo PIWEB)

La app se exporta como sitio estático y se sirve con nginx en Docker, igual que `007-2026-PIWEB`.

### Local

```bash
npm run build          # genera ./dist/
docker compose up -d   # levanta en http://127.0.0.1:5018
```

### Producción (VPS)

1. Clona/actualiza el repo en el VPS, por ejemplo `/opt/pgn-simulacro/`.
2. Build:
   ```bash
   cd /opt/pgn-simulacro/
   git pull
   npm ci
   npm run build
   docker compose up -d
   ```
3. El contenedor expone `127.0.0.1:5018:80` (puerto elegido para no chocar con PIWEB en 5017).
4. En el túnel Cloudflare del VPS, rutea `pr.innovadataco.com` a `http://127.0.0.1:5018`.

**No olvidar:** cualquier cambio requiere `npm run build` + `docker compose up -d` (o `docker compose restart`) para regenerar `./dist`.
