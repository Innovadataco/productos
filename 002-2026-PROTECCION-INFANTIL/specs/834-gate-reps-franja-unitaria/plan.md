# Plan · SPEC-834

## Enfoque
1. Medir las DOS puertas de creación de franja contra `origin/main` (I-440): el lote (`materializarFranjas`)
   y la unitaria (`franjas/route.ts`). Confirmado: la unitaria valida banderas/vigencia/solape, SIN REPS.
2. Localizar la FUENTE ÚNICA del criterio REPS × modalidad y verificar que es alcanzable desde la unitaria:
   `modalidadRepsRequerida` (mapeo cita→REPS, un solo lugar) + `PerfilProfesionalRepository`
   `.esRepsElegibleParaModalidad` / `.repsAlDia` (SPEC-790 T4 · motor `repsElegible`). Es la que usa 828.
   NO reimplementar el criterio.
3. Acotar el gate al HUECO DE MODALIDAD puro (VEREDICTO A): `repsAlDia ∧ ¬esRepsElegibleParaModalidad`.
   Las causas de vigencia NO se bloquean acá (813 / 836 / backstop 828).
4. Cablear el mensaje de Diseño (FORMA-SPEC834 v1.0) con pivote por DATO; el pivote exige atiende(otra) ∧
   REPS(otra) para no prometer una publicación que la compuerta de banderas rechaza.
5. Candado de conducta en el POST real, RED-first en dos sentidos. Gate completo por EXIT CODE.

## Riesgos atendidos
- **El predicado colapsado miente a una persona:** `esRepsElegibleParaModalidad` junta hueco de modalidad con
  estado 7 y vencida. MEDIDO (test real, luego removido): en estado 7 el gate rechazaba y el mensaje decía
  «su inscripción no cubre la modalidad» a quien la inscripción está perfecta. Se escaló al CEO → VEREDICTO A
  (acotar con `repsAlDia`), no un `else`.
- **El pivote como segunda promesa falsa:** se ofrece la otra modalidad solo si es publicable de verdad
  (atiende ∧ REPS cubre).
- **825 no está en main:** el lote aún no llama la fuente única; cuando entre su pieza 2 debe llamar el MISMO
  par (coordinación pasada al CEO → Dev-1). No afecta a 834 (la fuente es 790 T4, no 825).
- **BD:** no toca objetos de base; sin radio de catálogo, sin CASCADE.

## No tocar / coordinación
- NO tocar el lote (825 pieza 2, de Dev-1) ni el candado de 828.
- Rama off `origin/main` (`a513f6a4f`); PR entra detrás de #822…#826 (cola del CEO).
