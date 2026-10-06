(function () {
  // =====================================================================
  // 1. Подсветка синтаксиса SQL (PostgreSQL)
  // =====================================================================

  // <hl-core>
  // Категория -> слова. Функции подсвечиваются только если за ними идёт "("
  // (так LEFT JOIN остаётся ключевым словом, а LEFT(name, 3) — функцией).
  const FUNCTION_WORDS = {
    "fn-agg": "count sum avg min max array_agg string_agg bool_and bool_or every " +
      "json_agg jsonb_agg json_object_agg jsonb_object_agg bit_and bit_or " +
      "stddev stddev_pop stddev_samp variance var_pop var_samp corr covar_pop " +
      "covar_samp mode percentile_cont percentile_disc xmlagg",
    "fn-str": "length char_length character_length octet_length bit_length lower upper " +
      "initcap concat concat_ws substring substr left right lpad rpad ltrim rtrim " +
      "btrim trim replace translate position strpos split_part regexp_replace " +
      "regexp_match regexp_matches regexp_split_to_table regexp_split_to_array " +
      "repeat reverse format md5 ascii chr overlay starts_with to_hex quote_ident " +
      "quote_literal quote_nullable encode decode convert",
    "fn-date": "now date_trunc date_part extract age make_date make_time make_timestamp " +
      "make_interval to_char to_date to_timestamp timeofday clock_timestamp " +
      "statement_timestamp transaction_timestamp justify_days justify_hours " +
      "justify_interval isfinite current_date current_time current_timestamp " +
      "localtime localtimestamp",
    "fn-math": "abs ceil ceiling floor round trunc sign sqrt cbrt power pow exp ln log log10 " +
      "mod div random setseed pi degrees radians sin cos tan asin acos atan atan2 " +
      "sinh cosh tanh gcd lcm width_bucket scale factorial",
    "fn-win": "row_number rank dense_rank percent_rank cume_dist ntile lag lead " +
      "first_value last_value nth_value",
    "fn-other": "coalesce nullif greatest least cast generate_series unnest array_length " +
      "array_append array_cat array_remove array_position array_to_string " +
      "string_to_array cardinality json_build_object jsonb_build_object " +
      "json_build_array jsonb_build_array to_json to_jsonb json_extract_path " +
      "jsonb_extract_path jsonb_set jsonb_array_elements row_to_json to_number " +
      "current_setting pg_typeof gen_random_uuid uuid_generate_v4",
  };

  // Эти слова — функции и без скобок (CURRENT_DATE, LOCALTIME ...).
  const NO_PAREN_WORDS = {
    "fn-date": "current_date current_time current_timestamp localtime localtimestamp",
    "fn-other": "current_user session_user",
  };

  const KEYWORDS = new Set((
    "select from where group by having order limit offset fetch first next only rows row " +
    "join inner left right full outer cross natural on using union all intersect except " +
    "distinct as and or not in is isnull notnull between like ilike similar to escape " +
    "exists any some case when then else end with recursive insert into values update " +
    "set delete returning create table alter drop add column constraint primary key " +
    "foreign references unique check default index view if cascade restrict truncate " +
    "begin commit rollback asc desc nulls last over partition window filter within " +
    "lateral for array collate at zone analyze explain"
  ).split(/\s+/));

  const TYPES = new Set((
    "integer int int2 int4 int8 smallint bigint serial bigserial smallserial decimal " +
    "numeric real double precision float float4 float8 money boolean bool char " +
    "character varchar varying text bytea date time timestamp timestamptz timetz " +
    "interval uuid json jsonb xml inet cidr macaddr"
  ).split(/\s+/));

  const CONSTANTS = new Set(["null", "true", "false"]);

  // Map, а не обычный объект: колонка с именем "constructor" не должна
  // совпасть со свойством прототипа.
  const FUNC_MAP = new Map();
  Object.entries(FUNCTION_WORDS).forEach(([cat, words]) =>
    words.split(/\s+/).forEach((w) => FUNC_MAP.set(w, cat)));
  const NO_PAREN_MAP = new Map();
  Object.entries(NO_PAREN_WORDS).forEach(([cat, words]) =>
    words.split(/\s+/).forEach((w) => NO_PAREN_MAP.set(w, cat)));

  // Один проход слева направо. Порядок альтернатив важен:
  // комментарии раньше операторов ("--" и "/*" раньше "-" и "/").
  const TOKEN_RE = new RegExp([
    "(--[^\\n]*)",                                        // 1 строчный комментарий
    "(\\/\\*[\\s\\S]*?(?:\\*\\/|$))",                     // 2 блочный комментарий
    "('(?:[^']|'')*(?:'|$))",                             // 3 строка '...'
    "(\\$\\$[\\s\\S]*?(?:\\$\\$|$))",                     // 4 строка $$...$$
    "(\"(?:[^\"]|\"\")*(?:\"|$))",                        // 5 "идентификатор"
    "(\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)",               // 6 число
    "([A-Za-z_\\u0080-\\uFFFF][\\w$\\u0080-\\uFFFF]*)",   // 7 слово
    "(::|<>|!=|<=|>=|\\|\\||->>|->|#>>|#>|@>|<@|!~\\*|~\\*|!~|[~+\\-*\\/%^=<>&|])", // 8 оператор
    "([,;().\\[\\]])",                                    // 9 скобки, запятые, точка
  ].join("|"), "g");

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function classifyWord(word, text, start, end) {
    // Слово после точки (Trip.date, t.class) — всегда имя, а не ключевое слово.
    if (start > 0 && text[start - 1] === ".") return "ident";

    const lower = word.toLowerCase();

    let i = end;
    while (i < text.length && /\s/.test(text[i])) i++;
    const isCall = text[i] === "(";

    if (isCall && FUNC_MAP.has(lower)) return FUNC_MAP.get(lower);
    if (NO_PAREN_MAP.has(lower)) return NO_PAREN_MAP.get(lower);
    if (CONSTANTS.has(lower)) return "const";
    if (TYPES.has(lower)) return "type";
    if (KEYWORDS.has(lower)) return "keyword";
    return "ident";
  }

  // Возвращает безопасный HTML со <span class="hl-...">.
  function highlightSql(source) {
    const text = source === null || source === undefined ? "" : String(source);
    TOKEN_RE.lastIndex = 0;
    let out = "";
    let last = 0;
    let m;
    while ((m = TOKEN_RE.exec(text)) !== null) {
      if (m.index > last) out += escapeHtml(text.slice(last, m.index));
      const token = m[0];
      let cls;
      if (m[1] !== undefined || m[2] !== undefined) cls = "comment";
      else if (m[3] !== undefined || m[4] !== undefined) cls = "string";
      else if (m[5] !== undefined) cls = "ident";
      else if (m[6] !== undefined) cls = "number";
      else if (m[7] !== undefined) cls = classifyWord(token, text, m.index, TOKEN_RE.lastIndex);
      else if (m[8] !== undefined) cls = "operator";
      else cls = "punct";
      out += '<span class="hl-' + cls + '">' + escapeHtml(token) + "</span>";
      last = TOKEN_RE.lastIndex;
    }
    if (last < text.length) out += escapeHtml(text.slice(last));
    return out;
  }
  // </hl-core>

  // =====================================================================
  // 2. Настройки цветов подсветки (выпадающее окно в топбаре)
  // =====================================================================
  // Стандартные цвета живут в style.css (:root, --hl-*). Здесь хранятся
  // только изменённые пользователем — в localStorage этого браузера.

  const HL_STORAGE_KEY = "sqlTrainer.hlColors";
  const HEX_RE = /^#[0-9a-f]{6}$/;

  const HL_GROUPS = [
    {
      title: "Основное",
      items: [
        ["keyword", "Ключевые слова", "SELECT FROM"],
        ["type", "Типы данных", "INTEGER"],
        ["ident", "Имена таблиц и колонок", "Trip.id"],
        ["operator", "Операторы", "= <> ||"],
        ["punct", "Скобки и запятые", "( , ;"],
      ],
    },
    {
      title: "Функции PostgreSQL",
      items: [
        ["fn-agg", "Агрегатные", "COUNT AVG"],
        ["fn-str", "Строковые", "LOWER CONCAT"],
        ["fn-date", "Дата и время", "NOW AGE"],
        ["fn-math", "Математические", "ROUND ABS"],
        ["fn-win", "Оконные", "RANK LAG"],
        ["fn-other", "Прочие", "COALESCE CAST"],
      ],
    },
    {
      title: "Значения и комментарии",
      items: [
        ["string", "Строки", "'moscow'"],
        ["number", "Числа", "42 3.14"],
        ["const", "NULL, TRUE, FALSE", "NULL"],
        ["comment", "Комментарии", "-- text"],
      ],
    },
  ];

  const PREVIEW_SQL =
    "-- средняя цена по компаниям\n" +
    "SELECT c.name, COUNT(*) AS trips,\n" +
    "       ROUND(AVG(p.price), 2) AS avg_price,\n" +
    "       UPPER(c.name) || '_air' AS tag,\n" +
    "       DATE_TRUNC('month', NOW()) AS month,\n" +
    "       RANK() OVER (ORDER BY COUNT(*) DESC) AS rnk,\n" +
    "       COALESCE(CAST(p.price AS NUMERIC), 0) AS price\n" +
    "FROM Trip t\n" +
    "LEFT JOIN Company c ON t.company = c.id\n" +
    "WHERE t.town_from = 'Moscow' AND p.price > 100\n" +
    "  AND p.place IS NOT NULL\n" +
    "GROUP BY c.name;";

  function initSettings() {
    const btn = document.getElementById("settingsBtn");
    const panel = document.getElementById("settingsPanel");
    const list = document.getElementById("hlList");
    const resetAll = document.getElementById("hlResetAll");
    const preview = document.getElementById("hlPreview");
    if (!btn || !panel || !list) return;

    const root = document.documentElement;
    const ids = [];
    HL_GROUPS.forEach((g) => g.items.forEach((item) => ids.push(item[0])));

    // Стандартные значения читаем из CSS до применения пользовательских.
    const computed = getComputedStyle(root);
    const defaults = {};
    ids.forEach((id) => {
      const v = computed.getPropertyValue("--hl-" + id).trim().toLowerCase();
      defaults[id] = HEX_RE.test(v) ? v : "#cccccc";
    });

    // Только изменённые цвета: { id: "#rrggbb" }
    let colors = {};
    try {
      const saved = JSON.parse(localStorage.getItem(HL_STORAGE_KEY) || "{}");
      ids.forEach((id) => {
        const v = typeof saved[id] === "string" ? saved[id].toLowerCase() : "";
        if (HEX_RE.test(v) && v !== defaults[id]) colors[id] = v;
      });
    } catch (e) {
      colors = {};
    }
    Object.keys(colors).forEach((id) => root.style.setProperty("--hl-" + id, colors[id]));

    function persist() {
      try {
        if (Object.keys(colors).length) {
          localStorage.setItem(HL_STORAGE_KEY, JSON.stringify(colors));
        } else {
          localStorage.removeItem(HL_STORAGE_KEY);
        }
      } catch (e) {
        /* localStorage недоступен — цвета просто не сохранятся */
      }
    }

    const rows = {};

    function refreshRow(id) {
      const current = colors[id] || defaults[id];
      rows[id].input.value = current;
      rows[id].row.dataset.modified = id in colors ? "true" : "false";
    }

    function setColor(id, value) {
      value = value.toLowerCase();
      if (value === defaults[id]) {
        delete colors[id];
        root.style.removeProperty("--hl-" + id);
      } else {
        colors[id] = value;
        root.style.setProperty("--hl-" + id, value);
      }
      refreshRow(id);
      persist();
    }

    HL_GROUPS.forEach((group) => {
      const title = document.createElement("div");
      title.className = "hl-group-title";
      title.textContent = group.title;
      list.appendChild(title);

      group.items.forEach(([id, name, sample]) => {
        const row = document.createElement("div");
        row.className = "hl-row";

        const input = document.createElement("input");
        input.type = "color";
        input.className = "hl-color";
        input.id = "hl-color-" + id;

        const label = document.createElement("label");
        label.className = "hl-name";
        label.htmlFor = input.id;
        label.textContent = name;

        const demo = document.createElement("span");
        demo.className = "hl-sample hl-" + id;
        demo.textContent = sample;

        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "hl-row-reset";
        reset.textContent = "↺";
        reset.title = "Сбросить к стандартному";
        reset.setAttribute("aria-label", "Сбросить цвет: " + name);

        input.addEventListener("input", () => setColor(id, input.value));
        reset.addEventListener("click", () => setColor(id, defaults[id]));

        row.append(input, label, demo, reset);
        list.appendChild(row);
        rows[id] = { row, input };
        refreshRow(id);
      });
    });

    resetAll.addEventListener("click", () => {
      Object.keys(colors).forEach((id) => root.style.removeProperty("--hl-" + id));
      colors = {};
      ids.forEach(refreshRow);
      persist();
    });

    if (preview) preview.innerHTML = highlightSql(PREVIEW_SQL);

    function setOpen(open) {
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    }

    btn.addEventListener("click", () => setOpen(panel.hidden));
    document.addEventListener("click", (e) => {
      if (!panel.hidden && !e.target.closest("#settings")) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) {
        setOpen(false);
        btn.focus();
      }
    });
  }

  initSettings();

  // =====================================================================
  // 3. Справка (окно в топбаре)
  // =====================================================================
  // Стандартные тексты лежат в static/reference.json. В localStorage хранятся
  // правки стандартных пунктов (только изменённые поля) и свои пункты.

  const REF_STORAGE_KEY = "sqlTrainer.refEdits";
  const REF_CUSTOM_KEY = "sqlTrainer.refCustom";
  const REF_FIELDS = ["title", "desc", "article", "video", "code"];
  let openReference = null;

  function mk(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Только http(s): ссылка из поля правки не должна быть javascript:.
  function safeUrl(value) {
    try {
      const u = new URL(String(value).trim());
      return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
    } catch (e) {
      return "";
    }
  }

  function initReference() {
    const btn = document.getElementById("refBtn");
    const panel = document.getElementById("refPanel");
    const wrap = document.getElementById("refWrap");
    const searchEl = document.getElementById("refSearch");
    const addBtn = document.getElementById("refAdd");
    const closeBtn = document.getElementById("refClose");
    const backdrop = document.getElementById("refBackdrop");
    const listEl = document.getElementById("refList");
    const entryEl = document.getElementById("refEntry");
    if (!btn || !panel || !wrap || !searchEl || !addBtn || !closeBtn || !backdrop || !listEl || !entryEl) return;

    let entries = [];   // стандартные, из reference.json
    let custom = [];    // свои, добавленные через интерфейс
    let edits = {};     // правки стандартных: { id: { поле: значение } }
    let currentId = null;
    let editing = false;
    let draft = null;   // новый пункт, ещё не сохранённый

    function readJson(key, fallback) {
      try {
        const v = JSON.parse(localStorage.getItem(key) || "null");
        return v === null ? fallback : v;
      } catch (e) {
        return fallback;
      }
    }

    function store(key, value, isEmpty) {
      try {
        if (isEmpty) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* localStorage недоступен: изменения не сохранятся */
      }
    }

    const savedEdits = readJson(REF_STORAGE_KEY, {});
    if (savedEdits && typeof savedEdits === "object" && !Array.isArray(savedEdits)) edits = savedEdits;

    const savedCustom = readJson(REF_CUSTOM_KEY, []);
    if (Array.isArray(savedCustom)) {
      custom = savedCustom
        .filter((x) => x && typeof x.id === "string" && typeof x.title === "string")
        .map((x) => ({
          id: x.id,
          custom: true,
          title: x.title,
          words: Array.isArray(x.words) ? x.words.filter((w) => typeof w === "string") : [],
          desc: typeof x.desc === "string" ? x.desc : "",
          article: typeof x.article === "string" ? x.article : "",
          video: typeof x.video === "string" ? x.video : "",
          code: typeof x.code === "string" ? x.code : "",
        }));
    }

    function persistEdits() { store(REF_STORAGE_KEY, edits, !Object.keys(edits).length); }
    function persistCustom() { store(REF_CUSTOM_KEY, custom, !custom.length); }

    function allEntries() { return entries.concat(custom); }

    // Свои пункты проверяются первыми: они могут переопределить слово.
    function findEntry(id) {
      return custom.find((en) => en.id === id) || entries.find((en) => en.id === id);
    }

    // Пункт с применёнными правками.
    function merged(entry) {
      if (entry.custom) {
        return {
          id: entry.id, custom: true, modified: false, title: entry.title,
          desc: entry.desc, article: entry.article, video: entry.video, code: entry.code,
        };
      }
      const ed = edits[entry.id] || {};
      const out = { id: entry.id, custom: false, modified: entry.id in edits };
      REF_FIELDS.forEach((f) => {
        out[f] = typeof ed[f] === "string" ? ed[f] : entry[f] || "";
      });
      return out;
    }

    function renderList() {
      const q = searchEl.value.trim().toLowerCase();
      listEl.textContent = "";
      const shown = allEntries().filter((en) => {
        if (!q) return true;
        return merged(en).title.toLowerCase().includes(q) || en.words.some((w) => w.includes(q));
      });
      shown.forEach((en) => {
        const chip = mk("button", "ref-chip", merged(en).title);
        chip.type = "button";
        if (en.id === currentId) chip.classList.add("ref-chip-active");
        chip.addEventListener("click", () => select(en.id));
        listEl.appendChild(chip);
      });
      if (!shown.length) listEl.appendChild(mk("p", "ref-empty", "Ничего не найдено."));
    }

    function linkRow(label, url) {
      const row = mk("div", "ref-link-row");
      row.appendChild(mk("span", "ref-link-label", label));
      const href = safeUrl(url);
      if (href) {
        const a = mk("a", "ref-link", href);
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        row.appendChild(a);
      } else {
        row.appendChild(mk("span", "ref-link-none", "не указано"));
      }
      return row;
    }

    function renderEntry() {
      entryEl.textContent = "";

      if (draft) {
        renderForm(draft, merged(draft));
        return;
      }

      const base = findEntry(currentId);
      if (!base) {
        entryEl.appendChild(mk("p", "ref-empty", "Выбери пункт из списка или добавь свой."));
        return;
      }
      const m = merged(base);

      if (editing) {
        renderForm(base, m);
        return;
      }

      const head = mk("div", "ref-entry-head");
      head.appendChild(mk("h2", "ref-title", m.title));
      const edit = mk("button", "ref-edit", "✎");
      edit.type = "button";
      edit.title = "Редактировать";
      edit.setAttribute("aria-label", "Редактировать пункт: " + m.title);
      edit.addEventListener("click", () => {
        editing = true;
        renderEntry();
      });
      head.appendChild(edit);
      entryEl.appendChild(head);

      entryEl.appendChild(mk("p", "ref-desc", m.desc));
      entryEl.appendChild(linkRow("Статья", m.article));
      entryEl.appendChild(linkRow("Видео", m.video));

      entryEl.appendChild(mk("div", "ref-label", "Применение в коде"));
      const code = mk("pre", "ref-code");
      code.innerHTML = highlightSql(m.code);
      entryEl.appendChild(code);
    }

    function field(labelText, control) {
      const box = mk("label", "ref-field");
      box.appendChild(mk("span", "ref-label", labelText));
      box.appendChild(control);
      return box;
    }

    function renderForm(base, m) {
      const title = mk("input", "ref-input");
      title.type = "text";
      title.value = m.title;
      const desc = mk("textarea", "ref-input");
      desc.rows = 4;
      desc.value = m.desc;
      const article = mk("input", "ref-input");
      article.type = "url";
      article.placeholder = "https://...";
      article.value = m.article;
      const video = mk("input", "ref-input");
      video.type = "url";
      video.placeholder = "https://...";
      video.value = m.video;
      const code = mk("textarea", "ref-input ref-input-mono");
      code.rows = 8;
      code.spellcheck = false;
      code.value = m.code;

      const controls = { title, desc, article, video, code };

      entryEl.appendChild(field("Название", title));
      let words = null;
      if (base.custom) {
        words = mk("input", "ref-input");
        words.type = "text";
        words.placeholder = "join, left, on";
        words.value = base.words.join(", ");
        entryEl.appendChild(field("Слова для Ctrl + клик (через запятую)", words));
      }
      entryEl.append(
        field("Описание", desc),
        field("Ссылка на статью", article),
        field("Ссылка на видео", video),
        field("Применение в коде", code)
      );

      const actions = mk("div", "ref-actions");
      const save = mk("button", "run-btn", "Сохранить");
      save.type = "button";
      const cancel = mk("button", "ref-ghost", "Отмена");
      cancel.type = "button";
      actions.append(save, cancel);
      let secondary = null;
      if (!base.custom) {
        secondary = mk("button", "ref-ghost", "Сбросить пункт");
      } else if (base.id) {
        secondary = mk("button", "ref-ghost", "Удалить");
      }
      if (secondary) {
        secondary.type = "button";
        actions.appendChild(secondary);
      }
      entryEl.appendChild(actions);

      function linksValid() {
        for (const f of ["article", "video"]) {
          const v = controls[f].value.trim();
          if (v && !safeUrl(v)) {
            controls[f].style.borderColor = "var(--err)";
            controls[f].focus();
            return false;
          }
          controls[f].style.borderColor = "";
        }
        return true;
      }

      save.addEventListener("click", () => {
        if (!linksValid()) return;

        if (base.custom) {
          const t = title.value.trim();
          if (!t) {
            title.style.borderColor = "var(--err)";
            title.focus();
            return;
          }
          const ws = words.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
          const obj = {
            id: base.id || "u-" + Date.now().toString(36),
            custom: true,
            title: t,
            words: ws.length ? ws : [t.toLowerCase()],
            desc: desc.value.trim(),
            article: article.value.trim(),
            video: video.value.trim(),
            code: code.value.trim(),
          };
          const idx = custom.findIndex((x) => x.id === obj.id);
          if (idx >= 0) custom[idx] = obj;
          else custom.push(obj);
          persistCustom();
          draft = null;
          editing = false;
          currentId = obj.id;
          renderList();
          renderEntry();
          return;
        }

        const next = {};
        REF_FIELDS.forEach((f) => {
          const v = controls[f].value.trim();
          if (v !== (base[f] || "")) next[f] = v;
        });
        if (Object.keys(next).length) edits[base.id] = next;
        else delete edits[base.id];
        persistEdits();
        editing = false;
        renderList();
        renderEntry();
      });

      cancel.addEventListener("click", () => {
        draft = null;
        editing = false;
        renderEntry();
      });

      if (secondary) {
        secondary.addEventListener("click", () => {
          if (base.custom) {
            if (!confirm("Удалить пункт «" + m.title + "»?")) return;
            custom = custom.filter((x) => x.id !== base.id);
            persistCustom();
            currentId = null;
          } else {
            delete edits[base.id];
            persistEdits();
          }
          editing = false;
          renderList();
          renderEntry();
        });
      }
    }

    function select(id) {
      currentId = id;
      editing = false;
      draft = null;
      renderList();
      renderEntry();
    }

    function setOpen(open) {
      panel.hidden = !open;
      backdrop.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      if (open && !editing && !draft) searchEl.focus();
    }

    const ready = fetch(panel.dataset.src)
      .then((res) => res.json())
      .then((data) => {
        entries = Array.isArray(data.entries) ? data.entries : [];
      })
      .catch(() => {
        entryEl.textContent = "";
        entryEl.appendChild(mk("p", "ref-empty", "Не удалось загрузить стандартные пункты."));
      })
      .then(() => {
        renderList();
        if (!entryEl.firstChild) renderEntry();
      });

    // Открыть справку на пункте, к которому относится слово.
    openReference = function (word) {
      ready.then(() => {
        const w = String(word).toLowerCase();
        const match = (en) => en.id === w || en.words.includes(w);
        const found = custom.find(match) || entries.find(match);
        setOpen(true);
        if (found) {
          searchEl.value = "";
          select(found.id);
        } else {
          searchEl.value = word;
          renderList();
        }
      });
    };

    addBtn.addEventListener("click", () => {
      draft = { id: null, custom: true, title: "", words: [], desc: "", article: "", video: "", code: "" };
      currentId = null;
      editing = true;
      renderList();
      renderEntry();
    });

    searchEl.addEventListener("input", renderList);
    btn.addEventListener("click", () => setOpen(panel.hidden));
    closeBtn.addEventListener("click", () => setOpen(false));

    // composedPath, а не closest: кнопки в окне перерисовываются при клике,
    // и к моменту этого обработчика цель уже может быть вне документа.
    document.addEventListener("click", (e) => {
      if (panel.hidden) return;
      const path = e.composedPath();
      if (!path.includes(panel) && !path.includes(btn)) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || panel.hidden) return;
      if (editing || draft) {
        editing = false;
        draft = null;
        renderEntry();
      } else {
        setOpen(false);
        btn.focus();
      }
    });
  }

  initReference();

  // =====================================================================
  // 4. Тренажёр (только на странице с карточкой)
  // =====================================================================

  const layout = document.querySelector(".layout");
  if (!layout) return;

  const cardId = layout.dataset.cardId;

  // --- Показать/скрыть эталонный запрос ---
  const answerToggle = document.getElementById("answerToggle");
  const answerReveal = document.getElementById("answerReveal");
  answerReveal.innerHTML = highlightSql(answerReveal.textContent);
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

  // --- Редактор запроса с подсветкой ---
  // Под прозрачным <textarea> лежит <pre> с той же геометрией, в который
  // кладём подсвеченный HTML. Textarea растёт по содержимому, поэтому
  // полос прокрутки нет и слои не расходятся.
  const input = document.getElementById("queryInput");

  const editorWrap = document.createElement("div");
  editorWrap.className = "terminal-editor";
  const highlightLayer = document.createElement("pre");
  highlightLayer.className = "terminal-highlight";
  highlightLayer.setAttribute("aria-hidden", "true");
  input.parentNode.insertBefore(editorWrap, input);
  editorWrap.appendChild(highlightLayer);
  editorWrap.appendChild(input);

  function syncEditor() {
    const value = input.value;
    // Пустая последняя строка в <pre> схлопывается — добавляем пробел.
    highlightLayer.innerHTML = highlightSql(value) + (value.endsWith("\n") ? " " : "");
    input.style.height = "auto";
    input.style.height = input.scrollHeight + "px";
  }

  input.addEventListener("input", syncEditor);
  window.addEventListener("resize", syncEditor);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncEditor);
  syncEditor();

  // --- Ctrl+клик по слову в запросе: открыть справку по нему ---
  function wordAt(text, pos) {
    const re = /[A-Za-z_][\w]*/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (pos >= m.index && pos <= m.index + m[0].length) return m[0];
    }
    return "";
  }

  input.addEventListener("click", (e) => {
    if (!(e.ctrlKey || e.metaKey) || !openReference) return;
    e.stopPropagation();
    const word = wordAt(input.value, input.selectionStart);
    if (word) openReference(word);
  });

  // --- Клик по таблице/колонке в схеме: вставить название в терминал ---
  // Вставляется в позицию курсора (или вместо выделенного текста).
  // Колонка -> имя колонки, заголовок таблицы -> имя таблицы.
  function insertIntoQuery(text) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const before = input.value.slice(0, start);
    const after = input.value.slice(end);
    const insert = (before && !/[\s(,]$/.test(before) ? " " : "") + text;
    input.value = before + insert + after;
    const pos = before.length + insert.length;
    input.focus();
    input.setSelectionRange(pos, pos);
    syncEditor();
  }

  const schemaDiagramEl = document.getElementById("schemaDiagram");
  if (schemaDiagramEl) {
    schemaDiagramEl.addEventListener("click", (e) => {
      const table = e.target.closest(".schema-table");
      if (!table) return;
      const col = e.target.closest(".schema-col");
      insertIntoQuery(col ? col.dataset.column : table.dataset.table);
    });
  }

  // --- Запуск проверки запроса ---
  const runBtn = document.getElementById("runBtn");
  const result = document.getElementById("result");

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
    html += `<pre class="result-query-code">${highlightSql(data.query || "")}</pre>`;
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