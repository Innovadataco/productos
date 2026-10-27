# SPEC-915 · Residual de voz del colegio: imperativo tú SUELTO → usted

**Prioridad:** BAJA · sin deploy especial (viaja en el próximo deploy de colegio).
**Rama:** `work/pi-SPEC-915-voz-colegio-imperativo` desde `origin/main` (968d5c0a).
**Regla:** D-107 · el territorio del colegio + comité habla de **usted**; el padre/público conserva **tú** (no se toca).

## Problema

SPEC-463 cazó el tuteo por pronombres (tu/tus/tú/tuyo), SPEC-523 por formas verbales
inequívocas (-as/-es present, -aste/-iste pretérito) y SPEC-913 por enclíticos
(inténtalo/quítalo) + «link». **Ninguno cubría el imperativo tú SUELTO** («Elige uno»,
«Selecciona grado», «Consulta el estado»): SPEC-523 lo difirió explícitamente al pase
visual porque el imperativo tú es **homógrafo** de la 3ª-persona indicativa y de
sustantivos/adjetivos (`la consulta`, `la carga`, badge `Activa`/`Inactiva`). Diseño cazó
en vivo el caso de `SeccionMateriasCurso` («Elige uno…»).

## Alcance

1. Fix del caso de Diseño: `SeccionMateriasCurso.tsx` «Elige uno»→«Elija uno».
2. Barrido del imperativo tú SUELTO en la UI del colegio/comité (`colegio/**`,
   `dashboard/colegio/**`, `lib/colegio/**`) → usted. **No** padre/público.
3. Candado de clase por **morfología** (no lista de superficies) que cierra el gap.

## Defectos corregidos (10, hallados por el propio candado)

| Archivo | tú → usted |
|---|---|
| `lib/colegio/grados.ts` | Selecciona grado → **Seleccione** grado |
| `components/.../curso/SeccionMateriasCurso.tsx` | Elige uno → **Elija** uno |
| `components/.../unificado/SeccionIdentificadores.tsx` | Agrega … podrás → **Agregue** … **podrá** |
| `components/.../OnboardingModal.tsx` | Completa estos pasos → **Complete** |
| `components/.../comite/CasoDetalle.tsx` | Agrega o activa → **Agregue** o **active**; Selecciona un integrante → **Seleccione** |
| `components/.../comite/IntegrantesList.tsx` | Documenta quiénes → **Documente** |
| `app/dashboard/colegio/comite/casos/page.tsx` | Consulta el estado → **Consulte** |
| `app/dashboard/colegio/comite/integrantes/page.tsx` | Crea … y documenta → **Cree** … y **documente** |
| `app/dashboard/colegio/profesores/ProfesoresPageClient.tsx` | Usa «Agregar profesor» → **Use** |

## Candado (`voz-usted.candado.test.ts`, bloque SPEC-915)

Se extiende el candado de voz de SPEC-523 (mismo árbol, misma maquinaria de lexemas)
cerrando el gap que su propia cabecera dejó anotado. Detección por **morfología**:

```
imperativo tú  =  presente de 2ª persona (marca de tuteo, SPEC-523)  −  «s» final
                  seleccionas→selecciona · eliges→elige · escribes→escribe
```

Desambigua del homógrafo con dos guardas:

- **Posición de instrucción**: arranque de cadena/oración (inicio de línea o tras
  `. ¿ ¡ ( « : > " '`).
- **Objeto**: seguido de otra palabra → descarta el adjetivo suelto del badge
  (`"Activa" : "Inactiva"`), el sustantivo con artículo (`la consulta`) y la 3ª-persona.

Guardas extra: token Mayúscula-inicial + minúsculas (descarta `ENUM` en mayúsculas e
identificadores camelCase); comentarios removidos; `EXCEPCIONES_SUSTANTIVO` para un
sustantivo legítimo en arranque de oración (hoy vacío — el barrido no halló ninguno).

**Control positivo** (muere con el defecto): revertir «Elija uno»→«Elige uno» pone el
candado en rojo; el `it` de control positivo lo verifica inline.

Resultado del barrido inicial: 10 hits, **0 falsos positivos** (el badge `Activa`, los
nombres `consulta`/`carga` y los ENUM quedaron fuera por diseño).

## Fuera de alcance

- Padre/público (`dashboard/padre/**`): conservan tú (D-107, §1.9). No se tocan.
- Enclíticos y «link»: ya los cubre SPEC-913 (`copy-colegio-voz.candado.test.ts`), intacto.
- Un **segundo** imperativo coordinado a mitad de cadena (p. ej. el «active» tras «Agregue o»)
  no se caza de forma independiente: la guarda es de arranque de oración. No es hueco —
  la cadena entera queda protegida por su primer imperativo; el copy ya se corrigió a usted.
