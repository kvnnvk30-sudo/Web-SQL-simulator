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

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
  }

  function formatCell(value) {
    return value === null || value === undefined ? "NULL" : String(value);
  }

  // Рендерит запрос пользователя, статус, таблицу результата (если есть)
  // и текст сообщения — по данным, которые вернул /check.
  function renderResult(data) {
    const statusClass = data.correct ? "is-ok" : "is-err";
    const statusText = data.correct ? "✅ Верно" : "❌ Неверно";

    let html = "";

    html += '<div class="result-query">';
    html += '<div class="result-query-label">Запрос</div>';
    html += `<pre class="result-query-code">${escapeHtml(data.query || "")}</pre>`;
    html += "</div>";

    html += `<div class="result-status ${statusClass}">${statusText}</div>`;

    if (Array.isArray(data.columns) && data.columns.length && Array.isArray(data.rows)) {
      html += '<div class="result-table-wrap"><table class="result-table"><thead><tr>';
      data.columns.forEach((col) => {
        html += `<th>${escapeHtml(col)}</th>`;
      });
      html += "</tr></thead><tbody>";
      data.rows.forEach((row) => {
        html += "<tr>";
        row.forEach((cell) => {
          html += `<td>${escapeHtml(formatCell(cell))}</td>`;
        });
        html += "</tr>";
      });
      html += "</tbody></table></div>";
    }

    html += `<div class="result-message ${statusClass}">${escapeHtml(data.message || "")}</div>`;

    result.innerHTML = html;
  }

  async function runCheck() {
    const query = input.value;
    if (!query.trim()) return;

    activateTab("result");
    result.innerHTML = '<p class="result-placeholder">Проверяю...</p>';

    try {
      const res = await fetch("/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: cardId, query }),
      });
      const data = await res.json();
      renderResult(data);
    } catch (err) {
      result.innerHTML = '<p class="result-placeholder is-err">✗ Ошибка соединения с сервером.</p>';
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