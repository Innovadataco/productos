# Plan de implementación: SPEC-199 — Parche motor SPAM (002-PI-093)

## Resumen

Aplicar dos fixes complementarios al motor: (A) completar la rúbrica SPAM en código fuente y endurecer OFRECIMIENTO_REGALOS; (C) añadir guarda de dominancia SPAM en las guardas de seguridad. Persistir el cambio estructural vía seed forzado y añadir 2 parámetros de configuración. Cero migraciones destructivas.

## Cambios de código

### 1. Rúbrica SPAM y ajuste OFRECIMIENTO_REGALOS (Fix A)

#### 1.1 `src/lib/ai/rubrica-semilla.ts`

- Añadir bloque `SPAM` con 5 preguntas:

```ts
SPAM: [
    { texto: "¿El texto ofrece dinero, premios, sorteos o beneficios sin víctima concreta identificable?", activo: true, tipo: "decisiva" },
    { texto: "¿Incluye URLs, teléfonos o cuentas para reclamar/visitar/contactar comercialmente?", activo: true, tipo: "decisiva" },
    { texto: "¿Usa lenguaje de urgencia comercial (cupos limitados, solo 24h, ya!!!, felicitaciones)?", activo: true },
    { texto: "¿Describe una situación masiva/genérica en vez de un incidente con víctima e involucrado identificables?", activo: true },
    { texto: "¿El propósito principal es vender/promover/estafar, no reportar peligro contra un menor?", activo: true, tipo: "decisiva" }
],
```

- Cambiar pregunta 2 de `OFRECIMIENTO_REGALOS`:
  - Antes: `"¿El ofrecimiento es personal, dirigido específicamente a este menor?"`
  - Después: `"¿El mensaje se dirige a UN individuo específico (por nombre, situación o contexto único), NO como una campaña masiva o mensaje genérico?"`

#### 1.2 `prisma/seed.ts`

- En el bloque de rúbrica (después de `const rubricaParams`), cambiar el `upsert` de `ia.rubrica.preguntas` para forzar el valor:

```ts
// EXCEPCIÓN DOCUMENTADA (SPEC-199): ia.rubrica.preguntas es un parámetro
// ESTRUCTURAL del motor. Cuando se agrega/modifica una categoría o una
// pregunta decisiva, se debe propagar a producción aunque el parámetro ya
// exista. Los ajustes de redacción por expertos deben hacerse en este
// archivo fuente, no en runtime, para mantener trazabilidad.
for (const rp of rubricaParams) {
    await prisma.parametroSistema.upsert({
        where: { clave: rp.clave },
        update: rp.clave === "ia.rubrica.preguntas"
            ? { valor: rp.valor, descripcion: rp.descripcion }
            : {},
        create: {
            clave: rp.clave,
            valor: rp.valor,
            tipo: rp.tipo,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: rp.descripcion,
        },
    });
}
```

- Añadir en `monitoreoNuevos` (o sección equivalente de params nuevos) los 2 parámetros:
  - `{ clave: "spam.dominancia_umbral", valor: "0.66", tipo: TipoParametro.FLOAT, ... }`
  - `{ clave: "spam.dominancia_categoria_grave_severidad_min", valor: "75", tipo: TipoParametro.INTEGER, ... }`

### 2. Guarda de dominancia SPAM (Fix C)

#### 2.1 `src/lib/ai/guardas-decision.ts`

Cambiar la firma de `decidirGuardasSeguridad` para recibir `categoriasSecundarias` y los umbrales de dominancia:

```ts
export function decidirGuardasSeguridad({
    texto,
    clasificacion,
    categoriasSecundarias,
    estadoInicial,
    esRafaga,
    umbralSpam,
    umbralSpamDominancia,
    severidadMinGrave,
    severidad,
}: {
    texto: string;
    clasificacion: GuardasClasificacion;
    categoriasSecundarias: Array<{ categoria: string; score: number }>;
    estadoInicial: EstadoReporte;
    esRafaga: boolean;
    umbralSpam: number;
    umbralSpamDominancia: number;
    severidadMinGrave: number;
    severidad: (categoria: string) => number;
}): GuardasDecision
```

Añadir la nueva guarda después del guarda de spam por confianza y antes del doxing:

```ts
// SPEC-199: dominancia SPAM. Si SPAM vota fuerte entre las categorías
// presentes y ninguna es lo suficientemente grave, forzar POSIBLE_SPAM.
const presentes = [
    { categoria: clasificacion.categoria, score: clasificacion.confianza },
    ...categoriasSecundarias,
];
if (
    estadoFinal !== "POSIBLE_SPAM" &&
    categoriasSecundarias.some((c) => c.categoria === "SPAM" && c.score >= umbralSpamDominancia)
) {
    const hayCategoriaGrave = presentes.some((c) => severidad(c.categoria) >= severidadMinGrave);
    if (!hayCategoriaGrave) {
        estadoFinal = "POSIBLE_SPAM";
        reglasAplicadas.push("spam_dominancia");
    }
}
```

#### 2.2 `src/lib/dal/services/reporte-processing/guardas.ts`

- Pasar `categoriasSecundarias: clasificacion.categoriasSecundarias` a `decidirGuardasSeguridad`.
- Leer los parámetros `spam.dominancia_umbral` y `spam.dominancia_categoria_grave_severidad_min` desde `ParametroSistema` (vía helper existente) y pasarlos.
- Proveer función `severidad` que lea `scoring.severity.<categoria>`.

#### 2.3 `src/lib/ai/sandbox.ts`

- Actualizar la llamada a `decidirGuardasSeguridad` para pasar `categoriasSecundarias` y los nuevos parámetros (leerlos del config o usar defaults).

### 3. Tests

#### 3.1 `src/lib/ai/guardas-decision.test.ts`

- Añadir tests de dominancia SPAM:
  - OFRECIMIENTO_REGALOS ganador + SPAM 0.67 → `POSIBLE_SPAM` con `spam_dominancia`.
  - EXTORSION ganador + SPAM 0.67 → conserva estado inicial (no SPAM).
  - SPAM 0.5 → no fuerza.
- Actualizar todas las llamadas existentes para incluir `categoriasSecundarias: []` y los nuevos parámetros.

#### 3.2 Test de aceptación (nuevo o en test de integración)

- Un test que simule clasificación de texto publicitario y verifique `POSIBLE_SPAM`.
- Un test de extorsión que verifique que no se fuerza SPAM.

### 4. Documentación

- Actualizar `docs/architecture/03-stack-tecnico.md` si cambia algo del stack (no aplica).
- `specs/199-parche-motor-spam/quickstart.md`: instrucciones de prueba manual post-deploy.
- `specs/199-parche-motor-spam/data-model.md`: nota de que no hay cambios de schema, solo parámetros.

## Gate de calidad

- `npx tsc --noEmit`
- `npm run lint -- --no-cache`
- `npm run arch:check`
- `npm run test:unit`
- `npm run test:integration`
- `npm run build`
- CI verde 6/6.
