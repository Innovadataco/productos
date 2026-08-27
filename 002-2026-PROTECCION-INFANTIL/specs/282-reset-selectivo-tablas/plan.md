# Plan de implementación — SPEC-282 · `resetDatabase()` selectivo por tablas

## Alcance del trabajo

Extender `resetDatabase()` con una variante que recibe la lista de tablas a limpiar. La forma sin argumentos queda intacta. La adopción por parte de los archivos de prueba se hace en SPEC-283.

## Archivos que se tocan

| Archivo | Cambio |
|---|---|
| `src/lib/test-utils.ts` | +parámetro opcional `tablas?: string[]`. Extraer helpers `obtenerTablasDePGTables()` y `truncateAtomic(tablas: string[])` para claridad. |
| `src/lib/test-utils.test.ts` (nuevo) | 4 tests unitarios con BD real, uno por cada acceptance scenario. |

## Diseño técnico

### Firma nueva

```ts
export async function resetDatabase(tablas?: string[]): Promise<void> {
    if (tablas === undefined) {
        const rows: { tablename: string }[] = await prisma.$queryRaw`
            SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        `;
        const todas = rows.map((r) => r.tablename).filter((t) => !EXCLUDED_TABLES.has(t));
        await truncateAtomic(todas);
    } else if (tablas.length > 0) {
        const efectivas = tablas.filter((t) => {
            if (EXCLUDED_TABLES.has(t)) {
                console.error(`[resetDatabase] tabla excluida ignorada: ${t}`);
                return false;
            }
            return true;
        });
        const existentes: { tablename: string }[] = await prisma.$queryRaw`
            SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY(${efectivas})
        `;
        const setExistentes = new Set(existentes.map((r) => r.tablename));
        const faltantes = efectivas.filter((t) => !setExistentes.has(t));
        if (faltantes.length > 0) {
            throw new Error(`Tabla no encontrada en pg_tables: ${faltantes.join(", ")}`);
        }
        await truncateAtomic(efectivas);
    }
    // tablas === [] → salta el TRUNCATE, cae directo a los seeds.
    await otorgarTodosLosPermisos();
    await asegurarPlataformas();
}

async function truncateAtomic(tablas: string[]): Promise<void> {
    if (tablas.length === 0) return;
    const listado = tablas.map((t) => `"${t}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${listado} CASCADE`);
}
```

### Cuatro tests unitarios

```ts
// src/lib/test-utils.test.ts
describe("resetDatabase (SPEC-282)", () => {
    beforeAll(async () => { /* nada: cada test resetea a su gusto */ });

    it("sin argumentos → vacía las 96 tablas (comportamiento actual)", async () => {
        // sembrar Usuario y Reporte, llamar reset, verificar que ambas quedan vacías
    });
    it("con lista explícita → vacía SOLO esas tablas", async () => {
        // sembrar Usuario, Reporte, ModuloPermisible; llamar reset(["Usuario"]); verificar
        // que Usuario está vacía pero Reporte y ModuloPermisible siguen con datos.
    });
    it("con tabla inexistente → lanza error", async () => {
        await expect(resetDatabase(["TablaQueNoExiste"])).rejects.toThrow(/no encontrada/);
    });
    it("con array vacío → NO trunca pero SÍ re-otorga permisos", async () => {
        // sembrar Usuario, borrar todos los PermisoModulo, llamar reset([]),
        // verificar que Usuario sigue sembrado y que PermisoModulo se reconstruyó.
    });
});
```

Los tests corren bajo el mismo mecanismo actual (`beforeEach` con mutex TestMutex + `resetDatabase()` global al inicio de cada uno). NO se auto-referencian de forma recursiva porque el helper del propio test no llama a `resetDatabase()` — hace inserts directos con `prisma.usuario.create(...)`.

## Riesgo y candados

- **Riesgo bajo**: la forma sin argumentos NO cambia (misma consulta, mismo TRUNCATE, mismo seed). Los 364 archivos que la usan hoy siguen funcionando idénticamente.
- **Candado (FR-002)**: se añade un test explícito que verifica el comportamiento actual con lista completa. Si alguien altera esa rama por error, el test rompe.
- **Riesgo de CASCADE**: pasar `["Usuario"]` con CASCADE puede tumbar tablas que dependen de Usuario (Reporte, Suscripcion, etc.). Eso es EL COMPORTAMIENTO CORRECTO — si el test toca Usuario, no puede tener basura en Reporte que dependa de un Usuario borrado. Los llamantes de SPEC-283 tienen que enumerar el cierre transitivo si les importa; si no, quedan cubiertos por CASCADE.

## Pruebas

- 4 tests unitarios (uno por acceptance scenario) en `src/lib/test-utils.test.ts`.
- Verificación empírica: correr la suite completa antes/después del merge — número de pruebas idéntico, cobertura idéntica.

## Rollback

Revertir el commit restaura la firma original (`export async function resetDatabase()`). Ningún archivo de prueba externo depende de la firma nueva en SPEC-282 (SPEC-283 la adopta).
