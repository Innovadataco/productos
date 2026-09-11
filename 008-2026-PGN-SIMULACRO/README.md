# Simulacro PGN 2026 — INNOVADATACO

App de simulacro de exámenes para dos candidatos del concurso PGN 2026:

- **JELKIN ZAIR CARRILLO FRANCO** → Conv. 52 · Asesor 1AS-19 · Oficina TIC · Bogotá
- **DIANA MARCELA CÁCERES VALDERRAMA** → Conv. 89 · Procuradora Judicial II · Nacional

Stack: **Next.js 14 (App Router) + Tailwind CSS + TypeScript**. Sin auth, sin backend, sin base de datos propia. El banco de preguntas vive en una hoja pública de Google Sheets y se consulta desde el cliente.

## Setup

```bash
npm install
cp .env.local.example .env.local   # y edita NEXT_PUBLIC_SHEET_ID
npm run dev
```

Abre http://localhost:3000.

## Google Sheets (banco de preguntas)

1. Crea una hoja pública (o con acceso "cualquiera con el enlace") en Google Sheets.
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

4. Copia el ID de la hoja (la parte larga de la URL):
   `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`

5. Ponlo en `.env.local` (y en Vercel como variable de entorno):

```bash
NEXT_PUBLIC_SHEET_ID={SHEET_ID}
```

La app consume la hoja vía `https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:json` (parsing en `lib/sheets.ts`).

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

## Deploy en Vercel (pr.innovadataco.com)

1. Sube el repo a GitHub.
2. En [Vercel](https://vercel.com) → **Add New Project** → importa el repo (framework Next.js se detecta solo).
3. **Environment Variables** → agrega `NEXT_PUBLIC_SHEET_ID` con el ID de la hoja.
4. Deploy.
5. Para el dominio `pr.innovadataco.com`: **Settings → Domains** → agrega el dominio y apunta el DNS (CNAME hacia `cname.vercel-dns.com`) en el proveedor DNS.

O con la CLI:

```bash
npm i -g vercel
vercel                 # preview
vercel --prod          # producción
```
