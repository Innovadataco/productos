  // Entrada escalonada: cada bloque entra una vez y se calla (§4.5).
  (function () {
    var els = document.querySelectorAll('.entra');
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach(function (e) { e.classList.add('visto'); }); return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('visto'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (e) { io.observe(e); });
    // Red de seguridad: pase lo que pase, a los 2,5 s todo es visible (impresión, lectores, capturas).
    setTimeout(function () { els.forEach(function (e) { e.classList.add('visto'); }); }, 2500);
    // Cierra el menú móvil al elegir una sección.
    document.querySelectorAll('details.menu .lista a').forEach(function (a) { a.addEventListener('click', function () { a.closest('details').removeAttribute('open'); }); });
  })();
  // Interruptor de tema, como el de la app: claro ⇄ oscuro, recordado en este navegador.
  (function () {
    var b = document.getElementById('tema'); if (!b) return;
    b.addEventListener('click', function () {
      var raiz = document.documentElement;
      var actual = raiz.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var nuevo = actual === 'dark' ? 'light' : 'dark';
      raiz.setAttribute('data-theme', nuevo);
      try { localStorage.setItem('pi-tema', nuevo); } catch (e) {}
    });
  })();
