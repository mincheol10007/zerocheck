// zerocheck — shared client-side logic
// Loads data/*.json once, exposes helpers via window.zc

(function () {
  const cache = {};

  async function loadJSON(path) {
    if (cache[path]) return cache[path];
    const res = await fetch(path);
    if (!res.ok) throw new Error(`fetch ${path} failed (${res.status})`);
    const json = await res.json();
    cache[path] = json;
    return json;
  }

  async function loadAll() {
    const [drinksJson, ingredientsJson, labelsJson] = await Promise.all([
      loadJSON("data/drinks.json"),
      loadJSON("data/ingredients.json"),
      loadJSON("data/risk-labels.json"),
    ]);
    const drinks = drinksJson.drinks;
    const ingredients = ingredientsJson.ingredients;
    const labels = labelsJson.labels;
    const disclaimer = labelsJson.disclaimer;

    const ingredientMap = {};
    ingredients.forEach((i) => (ingredientMap[i.id] = i));

    return { drinks, ingredients, ingredientMap, labels, disclaimer };
  }

  // --- helpers ---
  function ingredientsFor(drink, ingredientMap) {
    return drink.ingredient_ids
      .map((id) => ingredientMap[id])
      .filter(Boolean);
  }

  function riskCounts(drink, ingredientMap) {
    const counts = { green: 0, yellow: 0, red: 0 };
    ingredientsFor(drink, ingredientMap).forEach((ing) => {
      if (counts[ing.risk_level] !== undefined) counts[ing.risk_level]++;
    });
    return counts;
  }

  function highestRisk(drink, ingredientMap) {
    const counts = riskCounts(drink, ingredientMap);
    if (counts.red > 0) return "red";
    if (counts.yellow > 0) return "yellow";
    return "green";
  }

  // 위험도 막대 그래프 — 가로 비율 막대
  function riskBarHTML(drink, ingredientMap, labels) {
    const counts = riskCounts(drink, ingredientMap);
    const total = counts.green + counts.yellow + counts.red;
    if (total === 0) return "";
    const seg = (key) => {
      if (counts[key] === 0) return "";
      const pct = (counts[key] / total) * 100;
      return `<div style="width:${pct}%; background:${labels[key].color};" title="${labels[key].emoji} ${labels[key].label_ko} ${counts[key]}개"></div>`;
    };
    return `
      <div class="flex h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        ${seg("green")}${seg("yellow")}${seg("red")}
      </div>
      <div class="mt-1 flex gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <span>${labels.green.emoji} ${counts.green}</span>
        <span>${labels.yellow.emoji} ${counts.yellow}</span>
        <span>${labels.red.emoji} ${counts.red}</span>
      </div>
    `;
  }

  function riskChip(level, labels) {
    const l = labels[level];
    return `<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white" style="background:${l.color};">${l.emoji} ${l.label_ko}</span>`;
  }

  function ingredientCard(ing, labels) {
    const l = labels[ing.risk_level];
    return `
      <div class="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="font-semibold text-zinc-900 dark:text-zinc-50">${ing.name_ko}</div>
            <div class="text-xs text-zinc-500 dark:text-zinc-400">${ing.name_en} · ${ing.category}</div>
          </div>
          <span class="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white" style="background:${l.color};">${l.emoji} ${l.label_ko}</span>
        </div>
        <p class="mt-2 text-sm text-zinc-700 dark:text-zinc-200">${ing.summary}</p>
        <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">${ing.detail}</p>
        <p class="mt-2 text-[10px] uppercase tracking-wide text-zinc-400">출처 · ${ing.source}</p>
      </div>
    `;
  }

  function drinkCard(drink, ingredientMap, labels) {
    const top = highestRisk(drink, ingredientMap);
    return `
      <a href="search.html?q=${encodeURIComponent(drink.name)}" class="group block rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 shadow-sm hover:shadow-md transition">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="font-bold text-zinc-900 dark:text-zinc-50 group-hover:underline">${drink.name}</div>
            <div class="text-xs text-zinc-500 dark:text-zinc-400">${drink.brand} · ${drink.volume_ml}ml</div>
          </div>
          ${riskChip(top, labels)}
        </div>
        <div class="mt-2">
          <span class="inline-block rounded-full bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 text-xs text-zinc-700 dark:text-zinc-200">${drink.category}</span>
        </div>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">${drink.tagline}</p>
        <div class="mt-3">
          ${riskBarHTML(drink, ingredientMap, labels)}
        </div>
      </a>
    `;
  }

  function legendHTML(labels) {
    return Object.entries(labels)
      .map(
        ([k, l]) => `
        <div class="flex items-start gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3">
          <span class="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-white text-xs" style="background:${l.color};">${l.emoji}</span>
          <div>
            <div class="text-sm font-semibold text-zinc-900 dark:text-zinc-50">${l.label_ko} <span class="text-xs font-normal text-zinc-500">(${l.label_en})</span></div>
            <div class="text-xs text-zinc-600 dark:text-zinc-300">${l.summary}</div>
          </div>
        </div>`
      )
      .join("");
  }

  // 검색: 음료 또는 성분 매치
  function search(query, drinks, ingredients, ingredientMap) {
    const q = query.trim().toLowerCase();
    if (!q) return { drinkMatches: [], ingredientMatches: [] };
    const qStripped = q.replace(/\s+/g, "");

    // 카테고리 동의어 — "콜라/사이다/에너지/탄산/스포츠" 매칭 보조
    const knownCategories = ["콜라", "사이다", "에너지", "탄산", "스포츠"];

    function drinkMatches_(d) {
      const name = d.name.toLowerCase();
      const nameStripped = name.replace(/\s+/g, "");
      const brand = d.brand.toLowerCase();
      const category = d.category.toLowerCase();

      // 직접 substring 매치
      if (name.includes(q)) return true;
      if (brand.includes(q)) return true;
      if (category.includes(q)) return true;
      if (nameStripped.includes(qStripped)) return true;

      // 합성어 매치 — "제로콜라" 같은 합성어를 토큰 분해
      if (qStripped.includes("제로")) {
        const isZero = nameStripped.includes("제로") || nameStripped.includes("슈가프리") || d.tagline.includes("칼로리 0") || d.tagline.includes("슈가프리");
        // "제로" + 카테고리 동의어 패턴 (콜라/사이다/에너지/탄산/스포츠)
        for (const cat of knownCategories) {
          if (qStripped.includes(cat) && isZero && (category.includes(cat) || nameStripped.includes(cat))) {
            return true;
          }
        }
        // "제로" + 브랜드/이름 키워드 (단, 카테고리 키워드가 query에 있었다면 위에서 처리됨)
        const rest = qStripped.replace("제로", "");
        const queryHadCategory = knownCategories.some((c) => qStripped.includes(c));
        if (!queryHadCategory && rest && isZero && (nameStripped.includes(rest) || brand.includes(rest))) return true;
        // 그냥 "제로"만 입력하면 제로 음료 전부
        if (qStripped === "제로" && isZero) return true;
      }

      // 공백 구분 토큰 매치 — 모든 토큰이 이름(또는 카테고리)에 있어야 함
      const tokens = q.split(/\s+/).filter(Boolean);
      if (tokens.length > 1) {
        const hay = `${name} ${category}`;
        if (tokens.every((t) => hay.includes(t))) return true;
      }

      return false;
    }

    const drinkMatches = drinks.filter(drinkMatches_);

    const ingredientMatches = ingredients
      .filter(
        (i) =>
          i.name_ko.toLowerCase().includes(q) ||
          i.name_en.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      )
      .map((i) => ({
        ingredient: i,
        drinks: drinks.filter((d) => d.ingredient_ids.includes(i.id)),
      }));

    return { drinkMatches, ingredientMatches };
  }

  window.zc = {
    loadAll,
    ingredientsFor,
    riskCounts,
    highestRisk,
    riskBarHTML,
    riskChip,
    ingredientCard,
    drinkCard,
    legendHTML,
    search,
  };
})();
