# SPEC-037 · plan.md · bloque Pruebas de Jelkin

## Estrategia
Un array más en el mismo `operacion.json`. Reutiliza `claseTag` + `mostrar` de `operacion.ts` (cero normalizadores nuevos). Componente calcado de `TablaRecorridos` (misma línea visual, mismas clases CSS `panel/ph/scroll/table/tag`). Sin deps nuevas.

## Archivos
- `src/lib/bi/operacion.ts` — AGREGA `PruebaJelkin`, `PruebasJelkin`, campo `pruebasJelkin?` en `Operacion`. (Aditivo · no toca lector ni normalizadores.)
- `src/components/bi/operacion/TablaPruebasJelkin.tsx` — nuevo.
- `src/app/operacion/page.tsx` — 1 línea: `<TablaPruebasJelkin p={r.data.pruebasJelkin} />` bajo `<TablaRecorridos>`.
- `tests/fixtures/operacion.sample.json` — agrega bloque `pruebasJelkin`.
- `tests/unit/bi-pruebas-jelkin-render.test.tsx` — nuevo.

## Componente (calcado)
```tsx
export function TablaPruebasJelkin({ p }: { p?: PruebasJelkin | null }) {
  const filas = p?.filas ?? [];
  if (filas.length === 0) return null;           // candado 9
  return (
    <div className="panel">
      <div className="ph">
        <h2>Pruebas de Jelkin</h2>
        {p?.resumen ? <span className="meta">{p.resumen}</span> : null}
      </div>
      <div className="scroll">
        <table>
          <thead><tr>
            <th className="c">#</th><th>Prueba</th>
            <th className="c">Fecha</th><th>Hallazgos</th><th className="c">Estado</th>
          </tr></thead>
          <tbody>
            {filas.map((row, i) => (
              <tr key={row.id || i}>
                <td className="c id">{mostrar(row.id)}</td>
                <td className="nm">{mostrar(row.prueba)}</td>
                <td className="c"><Fecha v={row.fecha} /></td>
                <td>{mostrar(row.hallazgos)}</td>
                <td className="c"><TagEstado v={row.estado} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```
`Fecha` y `TagEstado` = copias locales de los helpers de `TablaRecorridos` (mismo comportamiento: null→dash, tag por `claseTag`).

## Reglas de aislamiento (candado 9)
Componente retorna `null` si `filas` vacío/ausente. Page no envuelve en `&&` extra — delega al componente (una sola fuente de decisión).

## RAM — turno de build escalonado con Dev BI-2
Avisar a Fábrica ANTES de correr `next build`. Si Ollama (motor PI prod) empieza a swapear serio → PARAR (prod PI > velocidad BI).

## Gate LOCAL
```
rm -rf .next && npm run build && npm run typecheck && npm run test:unit && bash scripts/ratchets/run-all.sh
```

## Evidencia §6
`next build && next start` (NO next dev) con fixture → 2 capturas (con datos / sin pruebasJelkin).

## Push
```
git add src/app/operacion/page.tsx src/components/bi/operacion src/lib/bi/operacion.ts tests/ .specify/specs/037-*
git commit -m "feat(bi): SPEC-037 bloque pruebas de Jelkin en /operacion"
git push origin work/bi-SPEC-037-pruebas-jelkin && gh pr create --base main
```

## Fuera de scope
auth/guard/login · operacion/layout.tsx · leerOperacion · normalizadores existentes · reordenamiento.
