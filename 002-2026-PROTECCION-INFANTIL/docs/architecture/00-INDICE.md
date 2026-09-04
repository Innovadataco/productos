> GENERADO por `scripts/arch/generar-indice.ts` — no editar a mano.
> Fuentes: `scripts/arch/artefactos.ts`.
> Regenerar: `npx tsx scripts/arch/generar-indice.ts` (o `npm run arch:check` para verificar).

# 00 · Índice de la línea base de arquitectura

Documentación GENERADA leyendo el código (SPEC-126). Si el código cambia,
se regenera; si lo commiteado difiere de la regeneración, `arch:check` falla.

| Artefacto | Contenido | Fuentes de código | Regenerar |
| --- | --- | --- | --- |
| [00-INDICE.md](00-INDICE.md) | Índice de la línea base | `scripts/arch/artefactos.ts` | `npx tsx scripts/arch/generar-indice.ts` |
| [01-modelo-datos.md](01-modelo-datos.md) | Modelo de datos (Prisma) | `prisma/schema.prisma`<br>`scripts/arch/excepciones.json` | `npx tsx scripts/arch/generar-modelo-datos.ts` |
| [02-roles-capacidades.md](02-roles-capacidades.md) | Roles y capacidades (puerta y permisos) | `src/lib/proxy.ts`<br>`src/lib/nav-items.ts`<br>`src/lib/permisos-catalogo.ts`<br>`src/components/modules/NavHeader.tsx`<br>`prisma/seed.ts`<br>`src/app/**` | `npx tsx scripts/arch/generar-roles-capacidades.ts` |
| [03-pantallas.md](03-pantallas.md) | Pantallas por rol y transiciones | `src/app/**`<br>`src/lib/proxy.ts`<br>`src/lib/nav-items.ts` | `npx tsx scripts/arch/generar-pantallas.ts` |
| [04-guardias-api.md](04-guardias-api.md) | Guardianes de /api/** (fase de análisis · SPEC-400b · I-236 · I-239) | `src/app/api/**`<br>`src/lib/routing/guardias.ts`<br>`src/lib/routing/roles-titulares.ts`<br>`middleware.ts` | `npx tsx scripts/arch/generar-guardias-api.ts` |
| [06-stack.md](06-stack.md) | Stack, contenedores y puertos | `package.json`<br>`Dockerfile`<br>`docker-compose.prod.yml`<br>`docker-compose.yml` | `npx tsx scripts/arch/generar-stack.ts` |

## Compuerta

`npm run arch:check` (cableada al CI de la raíz del monorepo) verifica:

1. **Drift**: regenera los 5 artefactos y falla si difieren de lo commiteado.
2. **Huérfanos**: un modelo Prisma sin relaciones fuera de `scripts/arch/excepciones.json` falla.
3. **Aserción A (puerta ≡ predicado)**: `proxy()` y `esDestinoPermitidoPorRol` dan el mismo
   veredicto en todo el inventario rol × ruta (sesión canónica).
4. **Aserción B (el menú no miente)**: todo href que la navegación pinta para un rol es
   alcanzable para ese rol según el proxy (regla de pintado D-41: módulo de BD ∧ predicado).
