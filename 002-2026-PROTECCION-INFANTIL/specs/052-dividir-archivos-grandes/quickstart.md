# Quickstart: Validación del refactor de archivos grandes

**Prerequisites**: Docker, Node.js >=22, `npm`, PostgreSQL levantado, `.env.test` configurado.

---

## 1. Validar estado base

```bash
npm run test
```

**Esperado**: Todos los tests pasan antes de iniciar el refactor.

---

## 2. Validar después de cada archivo refactorizado

Tras cada extracción (US1, US2, US3, US4), ejecutar:

```bash
npx tsc --noEmit
npm run lint
npm run test
```

**Esperado**: Cero errores de TypeScript, cero errores de lint, todos los tests verdes.

---

## 3. Validar funcionalmente IaEvalManager

```bash
# Levantar app
./scripts/dev-restart.sh

# Acceder como ADMIN a:
# http://localhost:5005/dashboard/admin/ia/eval
```

**Esperado**: Los tabs Laboratorio, Casos e Historial funcionan; se puede crear un experimento; el detalle y comparador muestran métricas.

---

## 4. Validar funcionalmente AdminReporteDetalle

```bash
# Acceder como ADMIN u OPERADOR a:
# http://localhost:5005/dashboard/admin/operadores/revision
# Abrir un reporte y ejecutar: anonimizar, corregir, confirmar, baja, reactivar, revelar original, escalar.
```

**Esperado**: Cada acción produce el mismo resultado y los mismos mensajes que antes del refactor.

---

## 5. Validar procesamiento de reportes

```bash
# Tests específicos del worker
npm run test -- src/app/api/reportes/procesar/route.test.ts
```

**Esperado**: Todos los tests de `route.test.ts` pasan, incluyendo clasificación, anonimización, duplicados, errores transitorios y alertas.

---

## 6. Validar build

```bash
npm run build
```

**Esperado**: Compila sin errores.

---

## 7. Validar deploy limpio

```bash
./scripts/dev-restart.sh
```

**Esperado**: El script termina con `healthcheck OK`, un solo worker activo y la app en puerto 5005.
