// Shared header + footer renderer
(function () {
  function renderHeader(active) {
    const items = [
      { id: "home", label: "홈", href: "index.html" },
      { id: "compare", label: "비교", href: "compare.html" },
      { id: "search", label: "검색", href: "search.html" },
    ];
    const linkClass = (id) =>
      `px-3 py-1.5 rounded-md text-sm font-medium transition ${
        active === id
          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
          : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-200 dark:hover:bg-zinc-700"
      }`;

    return `
      <header class="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 backdrop-blur">
        <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <a href="index.html" class="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-50">
            <span>🥤</span><span>제로체크</span>
            <span class="text-xs font-normal text-zinc-500">zerocheck</span>
          </a>
          <nav class="flex items-center gap-1">
            ${items.map((i) => `<a href="${i.href}" class="${linkClass(i.id)}">${i.label}</a>`).join("")}
          </nav>
        </div>
      </header>
    `;
  }

  function renderFooter(disclaimer) {
    return `
      <footer class="mt-12 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
        <div class="mx-auto max-w-5xl px-4 py-6 text-xs text-zinc-600 dark:text-zinc-400">
          <p class="mb-2 leading-relaxed">${disclaimer || ""}</p>
          <p class="text-zinc-500">🥤 zerocheck · 2026-05-28</p>
        </div>
      </footer>
    `;
  }

  window.zcChrome = { renderHeader, renderFooter };
})();
