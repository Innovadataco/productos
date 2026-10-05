# Plan · SPEC-827

## Enfoque
1. Medir el flujo del selector (819): `POST /api/padre/soporte/peticiones` → `crearPeticionServicio` →
   `solicitudHabeasData.create`. El objeto se agrega ahí.
2. Schema + migración D-121 (array de enum): campo `clasesSolicitadas` + DEFAULT con cast + CHECK NOT VALID.
   La escribe Dev, la revisa Datos por D-121 en el PR (el carril es REVISIÓN, no autoría).
3. Service + ruta: code-gate + superRefine que cortan antes del CHECK (error limpio). Enum completo.
4. UI: eje C multi-select con las 6 clases (copy de Diseño) + los límites del relato al elegirlo en RECTIFICACION.
5. Candados en dos capas (conducta + inserción) + candado de UI, con RED-first. Gate COMPLETO por EXIT CODE.

## Riesgos atendidos
- **Regresión del cutover:** la ruta exige objeto para RECT/SUPR y el selector de 819 está live → la UI del
  objeto va en el MISMO PR (sin ella, RECT/SUPR se rechazarían). Por eso mecanismo + UI juntos.
- **Array de enum (D-121):** (a) DEFAULT con cast explícito; (b) Prisma ciego al CHECK → la regla va en CHECK +
  candado de inserción, no solo el superRefine; (c) NOT VALID por las filas previas.
- **No recortar el derecho:** el enum es completo aunque el copy fuera parcial; las 6 etiquetas llegaron
  (FORMA-SPEC827 b87771e) → UI completa, sin hueco-funcional.
- **No confundir petición con resolución:** campo nuevo, nunca reusar `clasesDatoAfectadas`.
- **Copy legal:** §2 (límites) se cablea refrescado (e4b31da); §3 [ABOGADO·tensión] NO (control sin cerrar).

## No tocar / coordinación
- NO tocar `plazos-legales.ts` ([NORMA]) ni el tipo elegido por el padre.
- Migración revisada por Datos (D-121) en el PR; array-de-enum señalado como blanco de revisión.
- Rama off `origin/main` (66cef7f58).
