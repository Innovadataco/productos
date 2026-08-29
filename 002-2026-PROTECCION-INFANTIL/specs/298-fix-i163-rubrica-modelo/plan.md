# PLAN 298 — Fix I-163: rúbrica respeta `modeloClasificacion` (002-PI-201)

## 1. Estrategia

Cambio quirúrgico en 3 archivos + 1 archivo de test. Sin migraciones. Sin cambios en el schema Prisma. Un solo commit atómico; PR contra `main`; gate `gh pr checks 13/13 verde` antes de señal REALIZADO.

## 2. Diseño por archivo

### 2.1 `src/lib/ai/rubrica.ts`

Cambio de firma:

```ts
export async function clasificarConRubrica(
    texto: string,
    config?: Partial<ConfigRubrica>,
    override?: { modeloClasificacion?: string }
): Promise<ResultadoRubrica>
```

En el arranque de la función, después de resolver `cfg` y `categoriasPosibles`, calcular la lista efectiva de modelos:

```ts
let modelosVotantes: string[] = cfg.modelos;
if (override?.modeloClasificacion) {
    if (!cfg.modelos.includes(override.modeloClasificacion)) {
        logger.warn(
            `[RUBRICA] modelo override no listado en cfg.modelos: ${override.modeloClasificacion}`
        );
    }
    modelosVotantes = [override.modeloClasificacion];
}
```

Sustituir el `for (const modelo of cfg.modelos)` del bloque de votación por `for (const modelo of modelosVotantes)`. Nada más se toca (embudo, decisor, umbrales, gravedad, secundarias, PII, `posibleAgresorPar` — todo intacto).

**Ajuste RF-6 (`metrics.modelo` real, incorporado tras revisión de CEO):** en el bloque `return { ... metrics: { modelo: ... } }`, `modelo` pasa de `` `rubrica:${cfg.modelos.join("+")}` `` a `` `rubrica:${modelosVotantes.join("+")}` ``. Sin override queda idéntico ("rubrica:m1+m2+m3"); con override queda "rubrica:<override>". Este mismo valor es el que `clasificacion.ts:99` persiste en `ClasificacionIA.modeloUsado`, así la simulación piloto distingue corridas por modelo.

### 2.2 `src/lib/ai/motor.ts`

Ampliar `OpcionesMotor`:

```ts
export interface OpcionesMotor {
    configRubrica?: Partial<ConfigRubrica> | undefined;
    /** SPEC-298 (I-163): override quirúrgico del comité; si viene, el motor
     *  vota con este único modelo. */
    modeloClasificacion?: string | undefined;
}
```

En `clasificarConMotorActivo`, pasar el override al llamar a la rúbrica:

```ts
const r = await clasificarConRubrica(
    texto,
    opciones.configRubrica,
    opciones.modeloClasificacion ? { modeloClasificacion: opciones.modeloClasificacion } : undefined
);
```

### 2.3 `src/lib/dal/services/reporte-processing/clasificacion.ts`

Línea 70 pasa de:

```ts
const [resultado, piiResult] = await Promise.all([
    clasificarConMotorActivo(texto, {}),
    detectarPiiCombinado(parametros.modeloAnonimizacion, texto),
]);
```

a:

```ts
const [resultado, piiResult] = await Promise.all([
    clasificarConMotorActivo(texto, { modeloClasificacion: parametros.modeloClasificacion }),
    detectarPiiCombinado(parametros.modeloAnonimizacion, texto),
]);
```

`parametros.modeloClasificacion` ya está tipado como `string` no-vacío (fallback en `parametros.ts:29,68`), así que no hace falta guardar contra `undefined`.

### 2.4 `src/lib/ai/rubrica.test.ts` — 3 tests nuevos

Ambos tests van dentro de un nuevo `describe("clasificarConRubrica — override modeloClasificacion (SPEC-298 / I-163)", ...)`. Estrategia:

- Mockear `llamarOllamaStructured` (importado desde `./ollama` o el helper equivalente que se usa hoy en el suite) con `vi.mock`. La spy cuenta invocaciones y registra el `modelo` recibido.
- Mockear `cargarConfigRubrica` para devolver una `ConfigRubrica` mínima con `modelos: ["m-a", "m-b", "m-c"]`, un `modeloEmbudo` distinto (`"m-embudo"`), y una `preguntas` sencilla con 2 categorías y 1 pregunta cada una.

**RF-A (con override):**

```ts
await clasificarConRubrica("texto", undefined, { modeloClasificacion: "m-solo" });
const modelosLlamados = spyOllama.mock.calls
    .map((c) => c[0])                  // 1er arg = modelo
    .filter((m) => m !== "m-embudo");  // descarta el embudo
expect(modelosLlamados).toEqual(["m-solo"]);
```

**RF-B (sin override):**

```ts
await clasificarConRubrica("texto");
const modelosLlamados = spyOllama.mock.calls
    .map((c) => c[0])
    .filter((m) => m !== "m-embudo");
expect(modelosLlamados).toEqual(["m-a", "m-b", "m-c"]);
```

**RF-6 (metrics.modelo real):**

```ts
const conOverride = await clasificarConRubrica("texto", CONFIG_TEST, { modeloClasificacion: "qwen2.5:14b" });
expect(conOverride.metrics.modelo).toBe("rubrica:qwen2.5:14b");

const sinOverride = await clasificarConRubrica("texto", CONFIG_TEST);
expect(sinOverride.metrics.modelo).toBe(`rubrica:${CONFIG_TEST.modelos.join("+")}`);
```

Warning de RF-5: no se afirma explícitamente en el test (la señal es un `logger.warn`); si el costo sube sin aportar cobertura funcional se deja fuera.

## 3. Orden de trabajo

1. **T-1** — `rubrica.ts`: cambio de firma + `modelosVotantes` + reemplazo del `for` de votación. Verificar que `llamarOllamaStructured` sigue recibiendo `cfg.temperatura` para el mono-modelo.
2. **T-2** — `motor.ts`: ampliar `OpcionesMotor`, propagar override al llamado.
3. **T-3** — `clasificacion.ts:70`: pasar `{ modeloClasificacion: parametros.modeloClasificacion }`.
4. **T-4** — `rubrica.test.ts`: agregar `describe` con RF-A y RF-B.
5. **T-5** — Gate local: `npx tsc --noEmit`, `npm run test` (afectados primero, luego suite completa).
6. **T-6** — README de specs (índice) + Status en spec.md ya cubierto por §7 de disciplina.
7. **T-7** — `git rebase origin/main` + `git diff --name-status origin/main..HEAD` → pegar en el chat.
8. **T-8** — Commit único, push, `gh pr create --base main`.
9. **T-9** — Esperar `gh pr checks` en 13/13 verde.
10. **T-10** — Señal `REALIZADO` con hash, PR y tabla `gh pr checks`.

## 4. Gate pre-push

```
git fetch origin
git rebase origin/main
git diff --name-status origin/main..HEAD
```

Salida esperada (5 archivos): `M src/lib/ai/rubrica.ts`, `M src/lib/ai/motor.ts`, `M src/lib/dal/services/reporte-processing/clasificacion.ts`, `M src/lib/ai/rubrica.test.ts`, `A specs/298-fix-i163-rubrica-modelo/{spec,plan,tasks}.md`, `M specs/README.md`.

## 5. Riesgos operativos

- **`gh pr checks` no llega a 13/13**: rebase sobre `main`, mirar la falla concreta, corregir y volver a empujar. No hacer merge sin verde total (regla dura del instructivo).
- **Tests pre-existentes rojos** (verificados en el PR anterior 002-PI-300: 5 fallos pre-existentes en `procesar/route.test.ts` y `estadisticas-publicas`): documentarlos como pre-existentes en el PR body si el gate CI de este repo los tolera; si no, no se pueden ignorar y hay que rebasar hasta que main los cure.

## 6. Post-merge

- Fábrica ejecuta merge a `main`.
- Jelkin dispara deploy.
- El efecto observable es que las simulaciones del sandbox ya reflejan el modelo elegido en `accuracy`.
