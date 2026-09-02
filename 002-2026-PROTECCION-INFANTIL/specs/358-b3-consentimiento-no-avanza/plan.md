# SPEC-358 · Plan

1. Reproducir la traza real (login → aceptar → /api/me) por API: sale 201/200 →
   la sesión no es la causa.
2. Reproducir en navegador el recorrido de Jelkin: el botón no se habilita.
3. Aislar: crear a mano un IntersectionObserver igual → tampoco dispara. Causa
   raíz confirmada.
4. Reemplazar el gate por una medida directa del scroll (montaje, evento scroll,
   resize), conservando el observer como refuerzo.
5. Resguardo: `clientHeight === 0` no concluye nada (no debilitar el candado).
6. Tests con observer mudo + verificación en navegador de punta a punta.
