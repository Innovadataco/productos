# Quickstart — SPEC-104: validación de la votación por índices

> NO correr ninguna evaluación del banco (la ordena ZEUS después: dos corridas de 200).
> Esta guía valida el mecanismo, no la medición.

## 1. Suite unitaria (mocks, sin Ollama)

```bash
export PATH="$HOME/.local/bin:$PATH"
npx vitest run src/lib/ai/rubrica.test.ts
# Esperado: verde — cumplimiento por índices, índices inválidos descartados,
# principal por gravedad intacta (SPEC-098), embudo/red de seguridad intactos.
```

## 2. Un solo caso real contra Ollama (no es la eval del banco)

```bash
npx tsx -e "
import { clasificarConRubrica } from './src/lib/ai/rubrica';
import { prisma } from './src/lib/prisma';
(async () => {
  const r = await clasificarConRubrica('<texto de un caso del banco, pegado aquí>');
  console.log(r.categoria, r.estado, r.categoriasPresentes);
  for (const v of r.votosModelos) console.log(v.modelo, JSON.stringify(v.categorias, null, 1));
  await prisma.\$disconnect();
})();"
# Esperado: los votos muestran preguntasCumplidas como textos canónicos (traducidos
# desde índice); ningún cumple:false por formato de copia.
```

## 3. I-30 — modo --rubrica-only arranca

```bash
npx tsx scripts/eval-dual-banco.ts 2 --rubrica-only
# Esperado: lee el baseline por defecto (sin ENOENT) y clasifica 2 casos.
npx tsx scripts/eval-dual-banco.ts 2 --rubrica-only --legacy-desde=scripts/simulacion/resultados-dual-095-baseline-pre098.json
# Esperado: mismo resultado con el archivo explícito.
```

## 4. Restricciones (verificación de no-cambio)

```bash
git diff HEAD~1 -- src/lib/ai/rubrica-semilla.ts prisma/seed.ts | wc -l   # 0: textos intactos
# En BD: ia.rubrica.modelos, ia.rubrica.umbral_presencia e ia.rubrica.enabled sin cambios (LEGACY, D-19).
```

## 5. Gate

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
```
