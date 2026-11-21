// Поиск по архиву на API Pagefind (индекс и движок — Pagefind, вывод — свой, в сетке строк архива).
// Отдельный файл: CSP запрещает встроенные скрипты. Результаты собираются через DOM, без innerHTML.
(() => {
  const form = document.getElementById('search-form');
  if (!form) return;
  const input = form.querySelector('input');
  const out = document.getElementById('search-results');
  const base = form.dataset.pagefind;
  const riskName = { low: 'низкий', medium: 'средний', high: 'высокий', critical: 'критический' };
  let pagefind = null;
  let seq = 0;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const plural = (n) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'совпадение';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'совпадения';
    return 'совпадений';
  };
  // Выдержка Pagefind — HTML с <mark>. Разбираем в инертном документе и переносим только текст и <mark>.
  const excerpt = (html) => {
    const p = el('p');
    const doc = new DOMParser().parseFromString(`<p>${html}</p>`, 'text/html');
    doc.body.firstChild.childNodes.forEach((node) => {
      if (node.nodeName === 'MARK') p.appendChild(el('mark', '', node.textContent));
      else p.appendChild(document.createTextNode(node.textContent));
    });
    return p;
  };
  const load = async () => {
    if (!pagefind) {
      pagefind = await import(base + 'pagefind.js');
      await pagefind.options({ excerptLength: 24 });
      pagefind.init();
    }
    return pagefind;
  };

  const render = (q, total, items) => {
    const count = el('p', 'search-count', total
      ? `${total} ${plural(total)}`
      : `По запросу «${q}» ничего не нашлось. Попробуйте CVE-ID или название инструмента.`);
    const list = el('ul', 'rows');
    items.forEach((d) => {
      const m = d.meta || {};
      const li = el('li', 'row');
      li.append(el('span', 'num', m.issue ? `№${m.issue}` : ''));
      const t = el('time', '', m.date || '');
      if (m.date) t.dateTime = m.date;
      li.append(t);
      const body = el('div', 'body');
      const h = el('h3');
      if (m.lab) h.append(el('span', 'flag-lab', '--lab'), ' ');
      if (m.special) h.append(el('span', 'flag-lab', '--special'), ' ');
      const a = el('a', '', m.title || d.url);
      a.href = d.url;
      h.append(a);
      body.append(h, excerpt(d.excerpt || ''));
      if (m.risk && riskName[m.risk]) body.append(el('span', `risk risk-${m.risk}`, `риск: ${riskName[m.risk]}`));
      li.append(body);
      list.append(li);
    });
    out.replaceChildren(count, ...(total ? [list] : []));
  };

  form.addEventListener('submit', (e) => e.preventDefault());
  input.addEventListener('input', async () => {
    const q = input.value.trim();
    const my = ++seq;
    if (!q) { out.replaceChildren(); return; }
    let pf;
    try { pf = await load(); } catch {
      out.replaceChildren(el('p', 'search-count', 'Поиск не загрузился. Обновите страницу.'));
      return;
    }
    const res = await pf.debouncedSearch(q, {}, 250);
    if (res === null || my !== seq) return;
    const data = await Promise.all(res.results.slice(0, 20).map((r) => r.data()));
    if (my !== seq) return;
    render(q, res.results.length, data);
  });
})();
