(function () {
  const layout = document.querySelector(".layout");
  if (!layout) return;

  const cardId = layout.dataset.cardId;

  // --- Показать/скрыть эталонный запрос ---
  const answerToggle = document.getElementById("answerToggle");
  const answerReveal = document.getElementById("answerReveal");
  answerToggle.addEventListener("click", () => {
    const isHidden = answerReveal.hasAttribute("hidden");
    if (isHidden) {
      answerReveal.removeAttribute("hidden");
      answerToggle.textContent = "Скрыть эталонный запрос";
    } else {
      answerReveal.setAttribute("hidden", "");
      answerToggle.textContent = "Показать эталонный запрос";
    }
  });

  // --- Вкладки Результат / Схема ---
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  function activateTab(name) {
    tabButtons.forEach((btn) => {
      btn.classList.toggle("tab-btn-active", btn.dataset.tab === name);
    });
    tabPanels.forEach((panel) => {
      if (panel.dataset.tabPanel === name) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "");
      }
    });
    if (name === "schema") {
      requestAnimationFrame(drawSchemaDiagram);
    }
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });

  // Схема открыта по умолчанию при загрузке страницы — отрисуем
  // диаграмму сразу, иначе она останется пустой до первого клика
  // по вкладке (getBoundingClientRect у скрытых элементов даёт 0).
  const initialSchemaPanel = document.querySelector('[data-tab-panel="schema"]');
  if (initialSchemaPanel && !initialSchemaPanel.hasAttribute("hidden")) {
    requestAnimationFrame(drawSchemaDiagram);
  }

  // --- ER-диаграмма схемы: линии связей между таблицами ---
  function drawSchemaDiagram() {
    const container = document.getElementById("schemaDiagram");
    const svg = document.getElementById("schemaLinks");
    const dataEl = document.getElementById("schemaLinksData");
    if (!container || !svg || !dataEl) return;

    let links = [];
    try {
      links = JSON.parse(dataEl.textContent || "[]");
    } catch (e) {
      links = [];
    }

    const containerRect = container.getBoundingClientRect();
    svg.setAttribute("width", containerRect.width);
    svg.setAttribute("height", containerRect.height);
    svg.innerHTML = "";

    links.forEach((link) => {
      const fromEl = document.getElementById(`schema-col-${link.from_table}-${link.from_col}`);
      const toEl = document.getElementById(`schema-col-${link.to_table}-${link.to_col}`);
      if (!fromEl || !toEl) return;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      const fromX = fromRect.right - containerRect.left;
      const fromY = fromRect.top + fromRect.height / 2 - containerRect.top;
      const toX = toRect.left - containerRect.left;
      const toY = toRect.top + toRect.height / 2 - containerRect.top;
      const midX = (fromX + toX) / 2;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`);
      path.setAttribute("class", "schema-link-path");
      svg.appendChild(path);
    });
  }

  window.addEventListener("resize", () => {
    const schemaPanel = document.querySelector('[data-tab-panel="schema"]');
    if (schemaPanel && !schemaPanel.hasAttribute("hidden")) {
      drawSchemaDiagram();
    }
  });

  // --- Запуск проверки запроса ---
  const input = document.getElementById("queryInput");
  const runBtn = document.getElementById("runBtn");
  const result = document.getElementById("result");

  async function runCheck() {
    const query = input.value;
    if (!query.trim()) return;

    activateTab("result");
    result.className = "terminal-result";
    result.textContent = "Проверяю...";

    try {
      const res = await fetch("/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: cardId, query }),
      });
      const data = await res.json();

      result.classList.remove("is-ok", "is-err");
      result.classList.add(data.correct ? "is-ok" : "is-err");
      result.textContent = (data.correct ? "✓ " : "✗ ") + data.message;
    } catch (err) {
      result.classList.remove("is-ok");
      result.classList.add("is-err");
      result.textContent = "✗ Ошибка соединения с сервером.";
    }
  }

  runBtn.addEventListener("click", runCheck);
  input.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runCheck();
    }
  });
})();