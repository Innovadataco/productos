# Quickstart: SPEC-134 — repos tenant-first

## Regla para cualquier repo del dominio colegio

```ts
// ✅ tenant-first, siempre
export async function listarCursos(colegioId: string, filtros: {…}, tx?: DbClient) {
    return (tx ?? prisma).curso.findMany({ where: { colegioId, ...filtros }, select: … });
}

// ✅ escritura por id compuesta, nunca por PK desnuda
export async function actualizarCurso(colegioId: string, id: string, data: {…}, tx?: DbClient) {
    const r = await (tx ?? prisma).curso.updateMany({ where: { id, colegioId }, data });
    if (r.count === 0) throw new AppError(404, "NOT_FOUND", "Curso no encontrado");
}

// ❌ prohibido: where libre del llamador, update por PK, colegioId opcional
```

## Verificar la migración de un archivo

1. `grep "@/lib/prisma" <archivo>` → vacío.
2. Quitar el archivo de `scripts/arch/prisma-directo-allowlist.json` EN EL MISMO commit.
3. Correr su route test / test de módulo + `scripts/arch/dal-frontera.test.ts`.
