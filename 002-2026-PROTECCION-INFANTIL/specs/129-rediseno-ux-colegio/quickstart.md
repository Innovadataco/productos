# Quickstart: SPEC-129 — Rediseño de UX del panel del colegio

Verificación con una cuenta SCHOOL_ADMIN activa (dev o prod), tras implementar.

## C1 — Aterrizaje y logo en su área

1. Login como colegio → aterriza en `/dashboard/colegio` (no en el home público).
2. Estando en `/` (home público), `/dashboard-publico` o `/seguimiento`, pulsa el logo
   → llega a `/dashboard/colegio`.
3. Con otro rol (ADMIN/OPERADOR), el logo en zona pública sigue yendo a `/` (SPEC-106 intacto).

## C2/C3 — Home con consulta + estadísticas

4. En `/dashboard/colegio` se ve el formulario de consulta pública y, debajo, las
   estadísticas (totales, mapa, categorías) sin navegar a otra pantalla.

## C3 — Navegación lateral

5. Todas las páginas del área muestran el menú vertical (Inicio, Cursos, Alumnos,
   Alertas, Auditoría) con el ítem activo marcado. No hay tabs horizontales ni iconos
   sueltos abajo. "Cambiar contraseña" y "Cerrar sesión" solo están en el menú del header.

## C4 — Acciones en línea

6. En Cursos: editar y activar/desactivar se hacen desde la fila (modal/confirmación),
   sin cambiar de pantalla. "Nuevo curso" y "Carga masiva" visibles como acciones de
   encabezado.
7. En Alumnos: la gestión de identificadores se abre desde la fila del alumno.

## C5 — Alertas

8. Sin datos: encabezado que explica qué son + "Aparecerán cuando un identificador que
   registres para un alumno salga en un reporte" + CTA a Alumnos.
9. Con datos: lista anonimizada con badge de estado (nueva / vista / gestionada).

## C6 — Auditoría

10. Las filas se leen en lenguaje natural (acción, actor, fecha legible); ningún JSON
    crudo visible (el detalle técnico, si existe, está colapsado).

## Gates técnicos

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build && npm run arch:check
```

Todo verde; tests de regresión del logo por rol incluidos en la suite.
