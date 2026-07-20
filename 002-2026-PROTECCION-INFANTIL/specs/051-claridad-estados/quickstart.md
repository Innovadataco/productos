# Quickstart: Validación de Claridad y estados

**Prerequisites**: El proyecto debe estar corriendo en `http://localhost:5005` tras `./scripts/dev-restart.sh`.

---

## 1. Verificar componentes de error

### Escenario A: Error de carga en "Mis reportes"

1. Iniciar sesión como usuario `PARENT`.
2. Navegar a `/mis-reportes`.
3. Simular un fallo de red (por ejemplo, detener el backend o bloquear la petición en DevTools).

**Esperado**: Se muestra un mensaje claro con título y botón "Reintentar" en lugar de un texto suelto.

---

## 2. Verificar componentes de estado vacío

### Escenario B: Listado de operadores vacío

1. Iniciar sesión como `ADMIN`.
2. Navegar a `/dashboard/admin/operadores/gestion`.
3. Si no hay operadores registrados, el listado debe mostrar el componente `EmptyState` con título y descripción contextual.

**Esperado**: Mensaje "No hay operadores registrados" dentro del componente estándar, no un simple párrafo.

---

## 3. Verificar microcopy empático

### Escenario C: Formulario de reporte

1. Navegar a `/reportar` sin iniciar sesión.
2. Avanzar por los pasos del wizard.

**Esperado**:
- El título y subtítulos usan lenguaje claro y respetuoso.
- Se recuerda que el reporte es informativo y no reemplaza la denuncia formal.
- Los mensajes de ayuda no usan lenguaje alarmista ni culpante.

### Escenario D: Consulta pública sin reportes

1. Navegar a `/consulta`.
2. Ingresar un identificador que no tenga reportes.

**Esperado**: El mensaje indica neutramente que no hay reportes suficientes y ofrece acciones siguientes.

---

## 4. Verificar jerarquía visual en pantallas densas

### Escenario E: Dashboard de administración

1. Iniciar sesión como `ADMIN`.
2. Navegar a `/dashboard/admin`.

**Esperado**: Título de página, secciones de métricas, gráficos y tabla de precisión tienen espaciado y encabezados consistentes.

### Escenario F: Gestión de operadores / comité

1. Navegar a `/dashboard/admin/operadores/gestion` y `/dashboard/admin/comite/gestion`.

**Esperado**: Cada bloque (resumen, formulario, listado) tiene encabezado visual claro y separación coherente.

---

## 5. Ejecutar tests y build

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

**Meta**: Todos los checks pasan sin errores introducidos por este spec.

