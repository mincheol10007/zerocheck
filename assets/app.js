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
      <button type="button" data-drink-id="${drink.id}" class="zc-drink-card group block w-full text-left rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 shadow-sm hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-emerald-500">
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
      </button>
    `;
  }

  // --- Coupang link ---
  // 빌드 타임에 박힌 affiliate_url 우선, 없으면 단순 검색 URL fallback.
  function coupangSearchUrl(drinkName) {
    return `https://www.coupang.com/np/search?q=${encodeURIComponent(drinkName)}`;
  }
  function coupangBuyUrl(drink) {
    return drink && drink.affiliate_url ? drink.affiliate_url : coupangSearchUrl(drink.name);
  }

  // --- Detail modal ---
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ingredientRowHTML(ing, labels) {
    const l = labels[ing.risk_level] || labels.green;
    // 좋은 성분 (green) 은 옅은 emerald 톤, 나쁜 성분 (yellow/red) 은 옅은 amber/red 톤
    const rowBg =
      ing.risk_level === "green"
        ? "bg-emerald-50 dark:bg-emerald-900/20"
        : ing.risk_level === "yellow"
        ? "bg-amber-50 dark:bg-amber-900/20"
        : "bg-red-50 dark:bg-red-900/20";
    return `
      <tr class="${rowBg} align-top">
        <td class="px-3 py-2 text-sm">
          <div class="font-semibold text-zinc-900 dark:text-zinc-50">${escapeHtml(ing.name_ko)}</div>
          <div class="text-xs text-zinc-500 dark:text-zinc-400">${escapeHtml(ing.name_en)}</div>
        </td>
        <td class="px-3 py-2 text-xs text-zinc-700 dark:text-zinc-200 whitespace-nowrap">${escapeHtml(ing.category)}</td>
        <td class="px-3 py-2 whitespace-nowrap">
          <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white" style="background:${l.color};">${l.emoji} ${escapeHtml(l.label_ko)}</span>
        </td>
        <td class="px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200">${escapeHtml(ing.summary)}</td>
        <td class="px-3 py-2 text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">${escapeHtml(ing.source)}</td>
      </tr>
    `;
  }

  function detailModalHTML(drink, ingredientMap, labels) {
    const ings = ingredientsFor(drink, ingredientMap);
    const top = highestRisk(drink, ingredientMap);
    const coupangUrl = coupangBuyUrl(drink);
    const isAffiliate = !!drink.affiliate_url;
    return `
      <div id="zc-modal-backdrop" class="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-2 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="zc-modal-title">
        <div id="zc-modal-panel" class="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-zinc-800 shadow-2xl border border-zinc-200 dark:border-zinc-700 my-4">
          <button type="button" id="zc-modal-close" aria-label="닫기" class="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <span aria-hidden="true">×</span>
          </button>

          <div class="px-5 pt-5 pb-3 border-b border-zinc-200 dark:border-zinc-700">
            <div class="flex items-start justify-between gap-3 pr-10">
              <div>
                <h2 id="zc-modal-title" class="text-xl font-bold text-zinc-900 dark:text-zinc-50">${escapeHtml(drink.name)}</h2>
                <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">${escapeHtml(drink.brand)} · ${escapeHtml(drink.category)} · ${drink.volume_ml}ml</div>
                <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">${escapeHtml(drink.tagline)}</p>
              </div>
              ${riskChip(top, labels)}
            </div>
            <div class="mt-3">${riskBarHTML(drink, ingredientMap, labels)}</div>
          </div>

          <div class="px-5 py-4">
            <h3 class="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">성분표 <span class="text-xs font-normal text-zinc-500">(${ings.length}개)</span></h3>
            <div class="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table class="w-full text-left">
                <thead class="bg-zinc-100 dark:bg-zinc-900/50">
                  <tr>
                    <th class="px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">성분명 (한/영)</th>
                    <th class="px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">카테고리</th>
                    <th class="px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">위험도</th>
                    <th class="px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">한 줄 요약</th>
                    <th class="px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">출처</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-200 dark:divide-zinc-700">
                  ${ings.map((i) => ingredientRowHTML(i, labels)).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <div class="px-5 pb-3 pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-zinc-200 dark:border-zinc-700">
            <div class="text-xs text-zinc-500 dark:text-zinc-400">
              ※ 위험도 색은 참고용. 자세한 기준은 <a href="info.html" class="underline hover:text-emerald-600">정보</a> 페이지 참고.
            </div>
            <a href="${coupangUrl}" target="_blank" rel="noopener sponsored" class="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <span>🛒</span><span>쿠팡에서 보기${isAffiliate ? '<sup class="ml-1 text-[10px] font-normal opacity-75">제휴</sup>' : ''}</span>
            </a>
          </div>
          ${isAffiliate ? `
          <div class="px-5 pb-4 pt-0 text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">
            ※ 이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
          </div>` : ''}
        </div>
      </div>
    `;
  }

  let _modalState = null;
  function closeDrinkDetail() {
    if (!_modalState) return;
    const { onKey, prevOverflow } = _modalState;
    document.removeEventListener("keydown", onKey);
    const el = document.getElementById("zc-modal-backdrop");
    if (el && el.parentNode) el.parentNode.removeChild(el);
    document.body.style.overflow = prevOverflow || "";
    _modalState = null;
  }

  async function openDrinkDetail(drinkId) {
    try {
      const { drinks, ingredientMap, labels } = await loadAll();
      const drink = drinks.find((d) => d.id === drinkId);
      if (!drink) {
        console.warn(`openDrinkDetail: drink not found id=${drinkId}`);
        return;
      }
      // 기존 모달이 있으면 먼저 닫기
      if (_modalState) closeDrinkDetail();

      const wrapper = document.createElement("div");
      wrapper.innerHTML = detailModalHTML(drink, ingredientMap, labels);
      const node = wrapper.firstElementChild;
      document.body.appendChild(node);

      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      function onKey(e) {
        if (e.key === "Escape") closeDrinkDetail();
      }
      document.addEventListener("keydown", onKey);

      _modalState = { onKey, prevOverflow };

      // backdrop 클릭 → 닫기 (panel 내부 클릭은 무시)
      node.addEventListener("click", (e) => {
        if (e.target === node) closeDrinkDetail();
      });
      const closeBtn = node.querySelector("#zc-modal-close");
      if (closeBtn) closeBtn.addEventListener("click", () => closeDrinkDetail());
    } catch (e) {
      console.error("openDrinkDetail error", e);
    }
  }

  // 전역 위임 — drinkCard 버튼 클릭 → 모달 오픈
  function bindDrinkCardClicks(root) {
    const scope = root || document;
    scope.addEventListener("click", (e) => {
      const btn = e.target.closest && e.target.closest(".zc-drink-card");
      if (!btn) return;
      const id = btn.getAttribute("data-drink-id");
      if (!id) return;
      e.preventDefault();
      openDrinkDetail(id);
    });
  }

  // 페이지 로드 시 자동 바인딩 (한 번만)
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => bindDrinkCardClicks(document));
    } else {
      bindDrinkCardClicks(document);
    }
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

  // --- 위험 점수 / 필터 / 정렬 (index 페이지 toolbar) ---
  // green=0, yellow=1, red=3 가중치. 음료 점수 = 성분 점수 평균.
  const RISK_SCORE = { green: 0, yellow: 1, red: 3 };

  function calcRiskScore(drink, ingredientMap) {
    const ings = ingredientsFor(drink, ingredientMap);
    if (!ings.length) return 0;
    const sum = ings.reduce((s, i) => s + (RISK_SCORE[i.risk_level] ?? 0), 0);
    return sum / ings.length;
  }

  function greenRatio(drink, ingredientMap) {
    const ings = ingredientsFor(drink, ingredientMap);
    if (!ings.length) return 0;
    const g = ings.filter((i) => i.risk_level === "green").length;
    return g / ings.length;
  }

  // 인공감미료 카테고리에 속하는 성분 id 집합
  function ingredientIdsByCategory(ingredients, category) {
    return new Set(
      ingredients.filter((i) => i.category === category).map((i) => i.id)
    );
  }

  /**
   * filters = {
   *   quick: { naturalOnly: bool, noArtificial: bool, noCaffeine: bool },
   *   categories: Set<string>  // 일반 카테고리 필터 (AND)
   * }
   */
  function filterDrinks(drinks, ingredients, filters) {
    const f = filters || {};
    const quick = f.quick || {};
    const categories = f.categories instanceof Set ? f.categories : new Set(f.categories || []);

    const artificialIds = ingredientIdsByCategory(ingredients, "인공감미료");
    const naturalSweetIds = new Set([
      ...ingredientIdsByCategory(ingredients, "천연감미료"),
      ...ingredientIdsByCategory(ingredients, "희소당"),
    ]);

    // category -> Set<ingredient id>
    const catToIds = {};
    ingredients.forEach((i) => {
      if (!catToIds[i.category]) catToIds[i.category] = new Set();
      catToIds[i.category].add(i.id);
    });

    return drinks.filter((d) => {
      const ids = d.ingredient_ids;

      // quick: noCaffeine
      if (quick.noCaffeine && ids.includes("caffeine")) return false;

      // quick: noArtificial (인공감미료 0개)
      const artCount = ids.filter((id) => artificialIds.has(id)).length;
      if (quick.noArtificial && artCount > 0) return false;

      // quick: naturalOnly — 인공감미료 0개 + 천연감미료/희소당 ≥1
      if (quick.naturalOnly) {
        if (artCount > 0) return false;
        const natCount = ids.filter((id) => naturalSweetIds.has(id)).length;
        if (natCount === 0) return false;
      }

      // categories AND: 선택된 각 카테고리마다 음료에 그 카테고리 성분이 ≥1개 있어야 함
      for (const cat of categories) {
        const catIds = catToIds[cat];
        if (!catIds) return false;
        const hit = ids.some((id) => catIds.has(id));
        if (!hit) return false;
      }

      return true;
    });
  }

  /**
   * mode = "default" | "safe" | "low-bad" | "danger"
   *   safe     — green 비율 높은 순 (안심순)
   *   low-bad  — yellow+red 비율 낮은 순 (주의순)
   *   danger   — 위험 점수 높은 순 (위험순)
   *   default  — drinks.json 원본 순서
   */
  function sortDrinks(drinks, ingredientMap, mode) {
    const arr = drinks.slice();
    if (mode === "safe") {
      // green 비율 desc, tie → score asc
      arr.sort((a, b) => {
        const ga = greenRatio(a, ingredientMap);
        const gb = greenRatio(b, ingredientMap);
        if (gb !== ga) return gb - ga;
        return calcRiskScore(a, ingredientMap) - calcRiskScore(b, ingredientMap);
      });
    } else if (mode === "low-bad") {
      // yellow+red 비율 asc = green 비율 desc (≈ safe와 같지만, tie 처리는 score asc)
      arr.sort((a, b) => {
        const ba = 1 - greenRatio(a, ingredientMap);
        const bb = 1 - greenRatio(b, ingredientMap);
        if (ba !== bb) return ba - bb;
        return calcRiskScore(a, ingredientMap) - calcRiskScore(b, ingredientMap);
      });
    } else if (mode === "danger") {
      arr.sort((a, b) => calcRiskScore(b, ingredientMap) - calcRiskScore(a, ingredientMap));
    }
    // "default": 원본 순서 유지
    return arr;
  }

  function renderDrinks(drinks, ingredientMap, labels) {
    return drinks.map((d) => drinkCard(d, ingredientMap, labels)).join("");
  }

  // 카테고리별 그룹 (info 페이지에서 사용)
  function groupIngredientsByCategory(ingredients) {
    const groups = {};
    ingredients.forEach((i) => {
      const k = i.category || "기타";
      if (!groups[k]) groups[k] = [];
      groups[k].push(i);
    });
    // 각 그룹 내부에서 위험도 정렬 (green → yellow → red)
    const order = { green: 0, yellow: 1, red: 2 };
    Object.keys(groups).forEach((k) => {
      groups[k].sort((a, b) => {
        const ra = order[a.risk_level] ?? 9;
        const rb = order[b.risk_level] ?? 9;
        if (ra !== rb) return ra - rb;
        return (a.name_ko || "").localeCompare(b.name_ko || "", "ko");
      });
    });
    return groups;
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
    calcRiskScore,
    greenRatio,
    filterDrinks,
    sortDrinks,
    renderDrinks,
    coupangSearchUrl,
    coupangBuyUrl,
    openDrinkDetail,
    closeDrinkDetail,
    bindDrinkCardClicks,
    groupIngredientsByCategory,
  };
})();
