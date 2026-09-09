(function () {
  const BENTO_VERSION = "20260910f";
  if (window.__gitiuBentoReady === BENTO_VERSION) return;
  window.__gitiuBentoReady = BENTO_VERSION;
  window.__gitiuBentoVersion = BENTO_VERSION;
  document.documentElement.setAttribute("data-gitiu-bento-version", BENTO_VERSION);

  // Keep automatic mode consistent with Primer's system color preference.
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const syncSystemTheme = () => {
    document.documentElement.setAttribute("data-gitiu-system-dark", String(systemTheme.matches));
  };
  syncSystemTheme();
  systemTheme.addEventListener("change", syncSystemTheme);

  const isHomePage = /\/(?:index\.html|page\d+\.html)?$/.test(location.pathname) || location.pathname === "/";
  const isTalkPage = /\/talk\.html$/.test(location.pathname);

  let postDataCache = null;

  function ensureDesignCssLast() {
    const href = `/gitiu-bento.css?v=${BENTO_VERSION}`;
    const links = [...document.querySelectorAll('link[href*="gitiu-bento.css"]')];
    let link = links.find((item) => item.getAttribute("href") === href || item.href.endsWith(href));
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
    }
    if (!link.isConnected) {
      document.head.appendChild(link);
    } else {
      // Keep the loaded theme sheet attached: moving it can invalidate it for a frame.
      // Move later template/plugin styles ahead of it to retain the intended cascade.
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach(sheet => {
        if (sheet !== link && (link.compareDocumentPosition(sheet) & Node.DOCUMENT_POSITION_FOLLOWING)) {
          link.before(sheet);
        }
      });
    }
    links.forEach((item) => {
      if (item !== link) item.remove();
    });
  }

  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch (_) {
      return value;
    }
  }

  function normalizePostPath(value) {
    if (!value) return "";
    const pathname = new URL(value, location.href).pathname.replace(/^\/+/, "");
    return safeDecode(pathname);
  }

  function localHref(value) {
    if (!value) return "#";
    try {
      const url = new URL(value, location.href);
      if (isLocalPreview() && isSiteHost(url.hostname)) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch (_) {
      return value;
    }
    return value;
  }

  function isLocalPreview() {
    return /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i.test(location.hostname);
  }

  function isSiteHost(hostname) {
    return hostname === "www.gitiu.com" || hostname === "gitiu.com";
  }

  function normalizeWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  function summarizeDescription(value, labels, maxLength = 34) {
    const cleaned = normalizeWhitespace(
      (value || "")
        .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[#>*_`~-]/g, "")
        .replace(/^\d+\.\s*/gm, "")
    );
    const fallback = labels.includes("说说") ? "短句、生活瞬间和一些当时的心情。" : "文章、照片和一段值得留下的时间。";
    if (!cleaned) return fallback;
    return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}...` : cleaned;
  }

  function isTalkPost(post) {
    return Array.isArray(post?.labels) && post.labels.includes("说说");
  }

  function isTalkItem(item) {
    return [...item.querySelectorAll(".LabelName")].some((label) => label.textContent.trim() === "说说");
  }

  function postTimeValue(post) {
    if (Number.isFinite(Number(post?.createdAt))) return Number(post.createdAt) * 1000;
    const parsed = Date.parse(post?.createdDate || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function quoteFromPost(post) {
    const lines = String(post?.description || "")
      .split(/\r?\n/)
      .map((line) => normalizeWhitespace(line.replace(/https?:\/\/\S+/g, "")))
      .filter(Boolean);
    const preferred = lines.find((line) => line.includes("夕阳")) || lines[1] || lines[0] || post?.postTitle || "";
    return preferred.length > 24 ? `${preferred.slice(0, 24)}...` : preferred;
  }

  async function fetchPostData() {
    if (postDataCache) return postDataCache;
    let json = null;
    try {
      for (const path of ["/gitiu-post-meta.json", "/postList.json"]) {
        const response = await fetch(path, { cache: "no-store" });
        if (response.ok) {
          json = await response.json();
          break;
        }
      }
      if (!json) throw new Error("no post metadata");
      const entries = Object.values(json).filter((item) => item && Array.isArray(item.labels));
      const byPath = new Map();
      entries.forEach((item) => {
        const normalized = normalizePostPath(item.postUrl);
        byPath.set(normalized, item);
        byPath.set(encodeURI(normalized), item);
      });
      postDataCache = { entries, byPath };
    } catch (_) {
      postDataCache = { entries: [], byPath: new Map() };
    }
    return postDataCache;
  }

  function iconPath(name) {
    return window.IconList && window.IconList[name] ? window.IconList[name] : "";
  }

  function iconLink(href, title, icon) {
    const link = document.createElement("a");
    link.className = "gitiu-icon-button";
    link.href = localHref(href);
    link.title = title;
    link.innerHTML = `<svg class="octicon" width="16" height="16"><path d="${iconPath(icon)}"></path></svg>`;
    return link;
  }

  function themeIconName() {
    const mode = document.documentElement.getAttribute("data-color-mode");
    return mode === "dark" ? "moon" : mode === "auto" ? "sync" : "sun";
  }

  function themeButton() {
    const link = document.createElement("a");
    link.className = "gitiu-icon-button";
    link.href = "javascript:void(0)";
    link.title = "切换主题";
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "octicon");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    path.setAttribute("d", iconPath(themeIconName()));
    svg.appendChild(path);
    link.appendChild(svg);
    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (typeof window.modeSwitch === "function") {
        window.modeSwitch();
      } else {
        const current = document.documentElement.getAttribute("data-color-mode");
        const next = current === "light" ? "dark" : current === "dark" ? "auto" : "light";
        document.documentElement.setAttribute("data-color-mode", next);
      }
      window.setTimeout(() => path.setAttribute("d", iconPath(themeIconName())), 0);
    });
    return link;
  }

  function pill(href, text, icon) {
    const link = document.createElement("a");
    link.className = "gitiu-link-pill";
    link.href = localHref(href);
    const path = iconPath(icon);
    if (path) {
      link.innerHTML = `<svg class="octicon" width="16" height="16" aria-hidden="true"><path d="${path}"></path></svg><span>${text}</span>`;
    } else {
      link.textContent = text;
    }
    return link;
  }

  function pillMarkup(href, text, icon) {
    const path = iconPath(icon);
    const svg = path ? `<svg class="octicon" width="16" height="16" aria-hidden="true"><path d="${path}"></path></svg>` : "";
    return `<a class="gitiu-link-pill gitiu-link-${icon}" href="${localHref(href)}">${svg}<span>${text}</span></a>`;
  }

  function textOf(selector, root = document) {
    return root.querySelector(selector)?.textContent.trim() || "";
  }

  function softLabel(text, kind) {
    const span = document.createElement("span");
    span.className = `Label gitiu-soft-label gitiu-label-${kind}`;
    span.textContent = text;
    return span;
  }

  function labelKind(text, className) {
    if (className.includes("LabelTime")) return "date";
    if (/^\d+$/.test(text)) return "count";
    if (text === "说说") return "talk";
    if (text === "转载") return "repost";
    if (text === "文章") return "article";
    return "neutral";
  }

  function cloneLabels(source) {
    const meta = document.createElement("div");
    meta.className = "gitiu-post-meta";
    source.querySelectorAll(".Label").forEach((label) => {
      const text = label.textContent.trim();
      if (!text) return;
      meta.appendChild(softLabel(text, labelKind(text, label.className)));
    });
    return meta;
  }

  function makePostItem(source, postMeta) {
    const href = localHref(source.getAttribute("href") || "#");
    const title = textOf(".listTitle", source);
    const labels = [...source.querySelectorAll(".LabelName")].map((label) => label.textContent.trim());
    const item = document.createElement("a");
    item.className = "gitiu-post-item";
    item.href = href;

    const text = document.createElement("div");
    const heading = document.createElement("h2");
    heading.textContent = title;
    const desc = document.createElement("p");
    desc.textContent = summarizeDescription(postMeta?.description, labels);
    text.append(heading, desc);

    item.append(text, cloneLabels(source));
    return item;
  }

  function makeProfileCard(postData) {
    const title = textOf(".blogTitle") || document.title;
    const subtitle = document.querySelector("#content > div")?.textContent.trim() || "";
    const avatar = document.querySelector("#avatarImg")?.getAttribute("src") || "cat.svg";
    const posts = postData.entries.length || document.querySelectorAll(".SideNav-item").length;
    const commentsFromJson = postData.entries.reduce((sum, item) => sum + (Number(item.commentNum) || 0), 0);
    const commentsFromDom = [...document.querySelectorAll(".SideNav-item .Label:not(.LabelName):not(.LabelTime)")].reduce((sum, label) => {
      const value = Number.parseInt(label.textContent.trim(), 10);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
    const comments = commentsFromJson || commentsFromDom;
    const runDayText = document.querySelector("#runday")?.textContent || "";
    const runDays = (runDayText.match(/\d+/) || [Math.max(0, Math.floor((Date.now() - new Date(2019, 9, 24).getTime()) / 86400000))])[0];

    const card = document.createElement("article");
    card.className = "gitiu-card gitiu-profile-card";
    card.innerHTML = `
      <div class="gitiu-profile-top">
        <div>
          <h1><a class="gitiu-brand-link" href="index.html"><img class="gitiu-brand-logo" src="/logos/gitiu-cat.svg" width="240" height="72" alt="Gitiu's Blog"></a></h1>
          <span class="gitiu-brand-subtitle"><img class="gitiu-slogan-art" src="/logos/gitiu-slogan.svg" width="240" height="40" alt="我的生活际遇"></span>
        </div>
      </div>
      <p>记录生活、短句、旅途、夜晚和一些还没有被归类的瞬间。</p>
      <div class="gitiu-notebook" aria-label="博客记录摘要">
        <div class="gitiu-notebook-counts">
          <div class="gitiu-notebook-entry"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 5l5 5M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15l-1 5ZM13 20h7"/></svg><strong>${posts}</strong><span>条记录</span></div>
          <div class="gitiu-notebook-entry"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0Z"/><path d="M7 10h8M7 14h5"/></svg><strong>${comments}</strong><span>条评论</span></div>
        </div>
        <div class="gitiu-notebook-time" aria-label="建站于 2019.10.24，至今 ${runDays} 天">
          <span class="gitiu-notebook-thread" aria-hidden="true"></span>
          <span class="gitiu-notebook-since"><span>始于</span> 2019.10.24</span>
          <span class="gitiu-notebook-today"><span class="gitiu-notebook-day-prefix">第 </span><strong>${runDays}</strong> 天</span>
        </div>
      </div>
      <div class="gitiu-profile-links">
        <span class="gitiu-card-subtle">探索</span>
        <div class="gitiu-links">
          ${pillMarkup("about.html", "关于", "about")}
          ${pillMarkup("tag.html", "归档", "post")}
          ${pillMarkup("link.html", "友链", "link")}
          ${pillMarkup("rss.xml", "RSS", "rss")}
        </div>
      </div>
    `;
    return card;
  }

  function makePostCard(items, postData) {
    const card = document.createElement("article");
    card.className = "gitiu-card gitiu-post-card";

    const head = document.createElement("div");
    head.className = "gitiu-card-head";
    const title = document.createElement("span");
    title.textContent = "最近更新";
    const actions = document.createElement("div");
    actions.className = "icon-row";
    actions.append(
      iconLink("tag.html", "搜索", "search"),
      themeButton()
    );
    head.append(title, actions);

    const list = document.createElement("div");
    list.className = "gitiu-post-list";
    const articleItems = items.filter((item) => !isTalkItem(item));
    articleItems.slice(0, 4).forEach((item) => {
      const postMeta = postData.byPath.get(normalizePostPath(item.getAttribute("href")));
      list.appendChild(makePostItem(item, postMeta));
    });

    const pagination = document.querySelector(".paginate-container");
    const pager = document.createElement("div");
    pager.className = "gitiu-pagination";
    const count = document.createElement("span");
    count.textContent = `显示最新 ${Math.min(articleItems.length, 4)} 篇`;
    const next = localHref("tag.html#文章");
    const more = document.createElement("a");
    more.className = "gitiu-more";
    more.href = next;
    more.textContent = "全部文章";
    pager.append(count, more);

    card.append(head, list, pager);
    return card;
  }

  function makeQuoteCard(items, postData) {
    const talk = items.find((item) => [...item.querySelectorAll(".LabelName")].some((label) => label.textContent.trim() === "说说")) || items[0];
    const visibleTalk = postData.byPath.get(normalizePostPath(talk?.getAttribute("href")));
    const latestTalk = visibleTalk || postData.entries
      .filter((item) => item.labels.includes("说说"))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
    const title = quoteFromPost(latestTalk) || textOf(".listTitle", talk);
    const card = document.createElement("a");
    card.className = "gitiu-card gitiu-quick-card";
    card.href = localHref("talk.html");
    card.innerHTML = `
      <div class="gitiu-card-head"><span>说说看板</span><span class="Label" style="background-color:#fde8f5;color:#9d2b72">时间线</span></div>
      <p class="gitiu-quote">“${title}”</p>
      <span class="gitiu-card-subtle gitiu-quote-more">全部动态 →</span>
    `;
    return card;
  }

  function makeLinksCard() {
    const card = document.createElement("article");
    card.className = "gitiu-card gitiu-quick-card";
    const head = document.createElement("div");
    head.className = "gitiu-card-head";
    head.innerHTML = `<span>入口</span><span class="Label" style="background-color:#eef0f3;color:#4b5563">Link</span>`;
    const links = document.createElement("div");
    links.className = "gitiu-links";
    links.append(
      pill("about.html", "关于", "about"),
      pill("link.html", "友链", "link"),
      pill("rss.xml", "RSS", "rss"),
      pill("tag.html", "标签", "post")
    );
    card.append(head, links);
    return card;
  }

  async function applyHome() {
    if (!isHomePage) return;
    const content = document.querySelector("#content");
    if (document.querySelector(".gitiu-bento-grid")) {
      document.body.classList.add("gitiu-home");
      return;
    }
    const nav = document.querySelector(".SideNav");
    if (!content || !nav) return;

    const items = [...nav.querySelectorAll(".SideNav-item")];
    if (!items.length) return;

    const postData = await fetchPostData();
    document.body.classList.add("gitiu-home");
    const grid = document.createElement("section");
    grid.className = "gitiu-bento-grid";
    grid.append(
      makeProfileCard(postData),
      makePostCard(items, postData),
      makeQuoteCard(items, postData)
    );
    content.replaceChildren(grid);
  }

  function makeTalkTimelineItem(post) {
    const link = document.createElement("a");
    link.className = "gitiu-talk-item";
    link.href = localHref(post.postUrl || "#");

    const body = document.createElement("div");
    body.className = "gitiu-talk-body";
    const title = document.createElement("h3");
    title.textContent = post.postTitle || "未命名说说";
    const date = document.createElement("time");
    date.className = "gitiu-talk-date";
    date.dateTime = post.createdDate || "";
    date.textContent = (post.createdDate || "").slice(5).replace("-", ".") || "—";
    const desc = document.createElement("p");
    desc.textContent = summarizeDescription(post.description, post.labels || [], 110);
    body.append(title, desc);

    const arrow = document.createElement("span");
    arrow.className = "gitiu-talk-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    link.append(date, body, arrow);
    return link;
  }

  async function applyTalkPage() {
    if (!isTalkPage) return;
    const content = document.querySelector("#content");
    if (!content) return;
    if (content.querySelector(".gitiu-talk-board")) {
      document.body.classList.add("gitiu-talk-page");
      return;
    }

    const postData = await fetchPostData();
    const talks = postData.entries
      .filter(isTalkPost)
      .sort((a, b) => postTimeValue(b) - postTimeValue(a));

    document.body.classList.add("gitiu-talk-page");
    const board = document.createElement("section");
    board.className = "gitiu-talk-board";

    const head = document.createElement("div");
    head.className = "gitiu-talk-head";
    head.innerHTML = `
      <div>
        <span class="gitiu-card-subtle">${talks.length} 条动态 · 按时间收藏</span>
        <h1>说说<span class="gitiu-talk-title-dot">.</span></h1>
        <p>生活里的小事，随手记下来。</p>
      </div>
      <a class="gitiu-link-pill" href="${localHref("index.html")}">返回首页</a>
    `;

    board.append(head);
    const years = new Map();
    talks.forEach(post => {
      const year = (post.createdDate || "").slice(0, 4) || "未注明年份";
      if (!years.has(year)) years.set(year, []);
      years.get(year).push(post);
    });
    years.forEach((posts, year) => {
      const group = document.createElement("section");
      group.className = "gitiu-talk-year";
      const heading = document.createElement("h2");
      heading.className = "gitiu-year-heading";
      heading.textContent = year;
      const count = document.createElement("span");
      count.textContent = `${posts.length} 条记录`;
      heading.append(count);
      const list = document.createElement("div");
      list.className = "gitiu-talk-list";
      posts.forEach(post => list.append(makeTalkTimelineItem(post)));
      group.append(heading, list);
      board.append(group);
    });
    content.replaceChildren(board);
  }

  function applyGeneralPage() {
    if (isHomePage || isTalkPage) return;
    const content = document.querySelector("#content");
    if (!content) return;
    if (document.querySelector("#postBody")) {
      document.body.classList.add("gitiu-post-page");
      return;
    }
    document.body.classList.add("gitiu-card-page");
    content.classList.add("gitiu-card");
  }

  function localizeInternalLinks() {
    if (!isLocalPreview()) return;
    document.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      const nextHref = localHref(href);
      if (href !== nextHref) link.setAttribute("href", nextHref);
    });
  }

  function removeFooterRunDay() {
    const runDay = document.querySelector("#runday");
    if (runDay) runDay.replaceChildren();
  }

  function enhanceTagPage() {
    const title = document.querySelector(".tagTitle");
    const filters = document.querySelector("#taglabel");
    if (!title || !filters) return;
    document.body.classList.add("gitiu-tag-page");
    title.textContent = "文章归档";
    const subtitle = document.createElement("p");
    subtitle.className = "gitiu-archive-intro";
    subtitle.textContent = "把写过的日子，慢慢收好。";
    title.after(subtitle);
    const search = document.querySelector(".subnav-search");
    const form = document.createElement("form");
    form.className = "gitiu-archive-search";
    form.setAttribute("role", "search");
    const input = search.querySelector("input");
    input.setAttribute("aria-label", "搜索文章标题");
    input.placeholder = "搜索文章标题…";
    const button = document.createElement("button");
    button.type = "submit";
    button.className = "gitiu-search-submit";
    button.textContent = "搜索";
    form.append(input, button);
    search.remove();
    document.querySelector("#content").prepend(form);
    const status = document.createElement("p");
    status.className = "gitiu-archive-status";
    status.setAttribute("role", "status");
    filters.after(status);
    const nav = document.querySelector(".SideNav");
    const rows = () => [...nav.querySelectorAll(".lists")];
    let active = "All";
    let query = "";
    function refresh() {
      const entries = rows();
      if (!entries.length) return;
      entries.forEach(row => {
        if (row.dataset.archiveYear) return;
        const date = row.querySelector(".LabelTime");
        row.dataset.archiveDate = date.textContent.trim();
        row.dataset.archiveYear = row.dataset.archiveDate.slice(0, 4);
        const time = document.createElement("time");
        time.className = "gitiu-archive-date";
        time.dateTime = row.dataset.archiveDate;
        time.textContent = row.dataset.archiveDate.slice(5).replace("-", ".");
        row.querySelector("a").append(time);
      });
      let visible = 0;
      entries.forEach(row => {
        const labels = [...row.querySelectorAll(".LabelName")].map(el => el.textContent);
        const matches = query ? row.querySelector(".listTitle").textContent.toLocaleLowerCase().includes(query.toLocaleLowerCase()) : active === "All" || labels.includes(active);
        row.style.display = matches ? "block" : "none";
        if (matches) visible++;
      });
      nav.querySelectorAll(".gitiu-archive-year").forEach(el => el.remove());
      const years = [...new Set(entries.map(row => row.dataset.archiveYear))].sort().reverse();
      years.forEach(year => {
        const group = entries.filter(row => row.dataset.archiveYear === year).sort((a, b) => b.dataset.archiveDate.localeCompare(a.dataset.archiveDate));
        const count = group.filter(row => row.style.display !== "none").length;
        const heading = document.createElement("h2");
        heading.className = "gitiu-archive-year";
        heading.hidden = count === 0;
        heading.append(document.createTextNode(year));
        const number = document.createElement("span");
        number.textContent = `${count} 条记录`;
        heading.append(number);
        nav.append(heading, ...group);
      });
      filters.querySelectorAll("button").forEach(chip => {
        const name = chip.dataset.archiveLabel || chip.childNodes[0].textContent.trim();
        chip.dataset.archiveLabel = name;
        if (name === "All") chip.childNodes[0].textContent = "全部 ";
        chip.classList.toggle("gitiu-active-chip", !query && name === active);
        chip.setAttribute("aria-pressed", String(!query && name === active));
      });
      title.textContent = "文章归档";
      document.title = query ? `${query} · 文章归档` : "文章归档 · Gitiu’s Blog";
      status.textContent = query ? `“${query}” · 找到 ${visible} 条记录` : `共 ${entries.length} 条记录 · ${active === "All" ? "全部分类" : active}`;
      const empty = document.querySelector(".notFind");
      empty.textContent = "没有找到匹配的文章，换个关键词试试。";
      empty.style.display = visible ? "none" : "block";
    }
    function selectHash() {
      const value = safeDecode(location.hash.slice(1));
      const names = [...filters.querySelectorAll("button")].map(el => el.dataset.archiveLabel || el.childNodes[0].textContent.trim());
      active = !value || value === "All" ? "All" : names.includes(value) ? value : "All";
      query = active === "All" && value && value !== "All" && !names.includes(value) ? value : "";
      input.value = query;
      refresh();
    }
    window.searchShow = () => {
      query = input.value.trim();
      active = "All";
      history.replaceState(null, "", `${location.pathname}${location.search}${query ? "#" + encodeURIComponent(query) : ""}`);
      refresh();
    };
    window.setClassDisplay = selectHash;
    window.updateShowTag = label => {
      active = label;
      query = "";
      input.value = "";
      history.pushState(null, "", `${location.pathname}${location.search}#${encodeURIComponent(label)}`);
      refresh();
    };
    form.addEventListener("submit", event => {
      event.preventDefault();
      window.searchShow();
    });
    // The engine loads its archive asynchronously; observe that completion once.
    const observer = new MutationObserver(() => {
      if (!rows().length) return;
      observer.disconnect();
      selectHash();
    });
    observer.observe(nav, {childList: true});
    if (rows().length) { observer.disconnect(); selectHash(); }
    window.addEventListener("hashchange", selectHash);
  }

  function enhanceLinkPage() {
    const postBody = document.querySelector("#postBody");
    if (!postBody || !/\/link\.html$/.test(location.pathname) || postBody.querySelector(".gitiu-friends")) return;
    const table = postBody.querySelector("table");
    if (!table) return;
    document.body.classList.add("gitiu-link-page");
    const sites = [...table.querySelectorAll("tbody tr")].flatMap(row => {
      const cells = row.querySelectorAll("td");
      const anchor = cells[0]?.querySelector("a");
      if (!anchor) return [];
      try {
        const url = new URL(anchor.getAttribute("href"), location.href);
        if (!["https:", "http:"].includes(url.protocol)) return [];
        return [{name: anchor.textContent.trim(), desc: cells[1]?.textContent.trim() || "记录生活与灵感", url}];
      } catch (_) { return []; }
    });
    const mark = `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="8" width="46" height="48" rx="14"/><path d="M16 45V25l10 6a21 21 0 0 1 12 0l10-6v20c0 7-32 7-32 0Z"/><path d="M25 39v3m14-3v3m-10 3q3 3 6 0M42 15v8m-4-4h8M8 48h48"/></svg>`;
    const make = (tag, cls, text) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (text) el.textContent = text;
      return el;
    };
    const title = document.querySelector(".postTitle");
    title.textContent = "友链";
    const intro = make("p", "gitiu-friends-intro", "海内存知己，天涯若比邻。");
    title.after(intro);
    const section = make("section", "gitiu-friends");
    const heading = make("div", "gitiu-friends-heading");
    heading.append(make("h2", "", "隔壁的朋友"));
    const friends = sites.filter(site => !isSiteHost(site.url.hostname));
    heading.append(make("span", "", `${friends.length} 个站点 · 各自有趣`));
    const grid = make("div", "friend-grid");
    friends.forEach(site => {
      const card = make("a", "friend-card");
      card.href = site.url.href;
      card.target = "_blank";
      card.rel = "nofollow noopener noreferrer";
      const seed = [...site.url.hostname].reduce((value, char) => value + char.charCodeAt(0), 0) % 4;
      const avatar = make("span", `friend-emblem friend-tone-${seed}`);
      avatar.setAttribute("aria-hidden", "true");
      avatar.innerHTML = mark;
      const initial = make("span", "friend-initial", Array.from(site.name)[0].toUpperCase());
      avatar.append(initial);
      const img = document.createElement("img");
      img.className = "friend-site-icon";
      img.alt = "";
      img.width = 40;
      img.height = 40;
      img.referrerPolicy = "no-referrer";
      img.decoding = "async";
      img.onload = () => {
        if (img.naturalWidth >= 32 && img.naturalHeight >= 32) avatar.classList.add("has-site-icon");
        else img.remove();
      };
      img.onerror = () => img.remove();
      img.src = new URL("/favicon.ico", site.url).href;
      avatar.append(img);
      const info = make("span", "friend-info");
      info.append(make("span", "friend-name", site.name), make("span", "friend-desc", site.desc), make("span", "friend-domain", site.url.hostname.replace(/^www\./, "")));
      const arrow = make("span", "friend-arrow", "↗");
      arrow.setAttribute("aria-hidden", "true");
      card.append(avatar, info, arrow);
      grid.append(card);
    });
    section.append(heading, grid);

    // Keep the original application requirements and comment entry.
    const applyTitle = [...postBody.querySelectorAll("h3")].find(el => el.textContent.includes("友链申请"));
    const details = make("details", "friend-application");
    const summary = make("summary", "", "交换友链");
    summary.append(make("span", "", "申请说明与留言格式"));
    details.append(summary);
    const rules = make("div", "friend-rules");
    let node = applyTitle?.nextSibling;
    while (node) {
      const next = node.nextSibling;
      rules.append(node);
      node = next;
    }
    rules.querySelectorAll("pre").forEach(pre => {
      if (!pre.textContent.includes("name:")) return;
      pre.textContent = "name: Gitiu's Blog\nurl: https://www.gitiu.com/\navatar: https://www.gitiu.com/logos/gitiu-neighbor.svg\ndesc: 谁能预测未来!";
    });
    details.append(rules);
    const own = make("section", "friend-own");
    const ownMark = make("span", "friend-own-mark");
    ownMark.innerHTML = mark;
    const ownInfo = make("div", "friend-own-info");
    ownInfo.append(make("span", "friend-eyebrow", "本站名片"), make("h2", "", "Gitiu's Blog"), make("p", "", "谁能预测未来!"));
    const ownUrl = make("a", "", "www.gitiu.com");
    ownUrl.href = "https://www.gitiu.com/";
    ownInfo.append(ownUrl);
    const copy = make("button", "friend-copy", "复制本站信息");
    copy.type = "button";
    const feedback = make("span", "friend-copy-feedback");
    feedback.setAttribute("role", "status");
    copy.addEventListener("click", async () => {
      const text = "name: Gitiu's Blog\nurl: https://www.gitiu.com/\navatar: https://www.gitiu.com/logos/gitiu-neighbor.svg\ndesc: 谁能预测未来!";
      try {
        await navigator.clipboard.writeText(text);
        feedback.textContent = "已复制";
      } catch (_) {
        details.open = true;
        feedback.textContent = "请在下方选中并复制本站信息";
      }
    });
    const action = make("div", "friend-own-actions");
    action.append(copy, feedback);
    own.append(ownMark, ownInfo, action);
    postBody.replaceChildren(section, own, details);
    const comments = document.querySelector("#cmButton");
    if (comments) comments.textContent = "留言 / 申请友链";
  }

  function enhanceControls() {
    const glyph = name => {
      const paths = {
        search: "M13.8 13.8 18 18M15 8.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z",
        next: "m8 5 5 5-5 5", back: "m12 5-5 5 5 5",
        copy: "M7 6V3h10v11h-3M3 7h10v11H3Z",
        chat: "M17 12.5a3 3 0 0 1-3 3H8l-4 3v-4a3 3 0 0 1-2-3v-6a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3ZM6 7h7M6 11h4",
        menu: "M7 5h10M7 10h10M7 15h10M3 5h.1M3 10h.1M3 15h.1",
        close: "m5 5 10 10M15 5 5 15"
      };
      return `<svg class="gitiu-ui-glyph" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.next}"/></svg>`;
    };
    const decorate = (selector, kind, icon, tail = false) => {
      document.querySelectorAll(selector).forEach(el => {
        if (el.dataset.gitiuControl) return;
        el.classList.add("gitiu-control");
        el.dataset.gitiuControl = kind;
        if (icon && !el.querySelector("svg")) el.insertAdjacentHTML(tail ? "beforeend" : "afterbegin", glyph(icon));
      });
    };
    const scan = () => {
      decorate(".title-right .circle, .title-right .btn, .gitiu-icon-button", "icon");
      decorate(".gitiu-profile-links .gitiu-link-pill", "nav");
      decorate(".gitiu-talk-head .gitiu-link-pill", "secondary", "back");
      decorate(".gitiu-more", "secondary", "next", true);
      decorate(".gitiu-link-pill, .pagination a", "secondary");
      decorate(".gitiu-search-submit", "primary", "search");
      decorate("#cmButton", "primary", "chat");
      const commentButton = document.querySelector("#cmButton");
      if (commentButton?.disabled) {
        commentButton.setAttribute("aria-busy", "true");
        if (commentButton.firstChild?.nodeType === Node.TEXT_NODE && commentButton.firstChild.textContent.trim() === "loading") {
          commentButton.firstChild.textContent = "正在加载";
        }
      }
      decorate(".friend-copy", "secondary", "copy");
      decorate("#taglabel button", "filter");
      decorate("clipboard-copy", "icon");
      document.querySelectorAll("clipboard-copy").forEach(el => {
        el.tabIndex = 0;
        el.setAttribute("aria-label", "复制代码");
        el.title = "复制代码";
      });
      document.querySelectorAll(".copy-feedback").forEach(el => {
        if (el.textContent === "Copied!") el.textContent = "已复制";
        el.setAttribute("role", "status");
      });
      [[".lb-lightbox-prev", "上一张图片", "back"], [".lb-lightbox-next", "下一张图片", "next"], [".lb-lightbox-close", "关闭图片", "close"]].forEach(([selector, label, icon]) => {
        document.querySelectorAll(selector).forEach(el => {
          if (el.dataset.gitiuControl) return;
          el.textContent = "";
          decorate(selector, "icon", icon);
          el.setAttribute("aria-label", label);
          el.title = label;
        });
      });
      const viewer = document.querySelector(".lb-lightbox-overlay");
      if (viewer && !viewer.dataset.gitiuControlsReady) {
        viewer.dataset.gitiuControlsReady = "1";
        let returnFocus = null;
        const syncViewer = () => {
          const open = viewer.classList.contains("active");
          viewer.inert = !open;
          viewer.setAttribute("aria-hidden", String(!open));
          if (open) {
            returnFocus = document.activeElement;
            viewer.querySelector(".lb-lightbox-close")?.focus({preventScroll: true});
          } else if (returnFocus?.isConnected) { returnFocus.focus({preventScroll: true}); returnFocus = null; }
        };
        syncViewer();
        new MutationObserver(syncViewer).observe(viewer, {attributes: true, attributeFilter: ["class"]});
      }
      const toc = document.querySelector(".toc-icon");
      if (toc && !toc.dataset.gitiuControl) {
        decorate(".toc-icon", "icon");
        toc.setAttribute("role", "button");
        toc.tabIndex = 0;
        const panel = document.querySelector(".toc");
        if (panel) { panel.id = "gitiu-article-toc"; toc.setAttribute("aria-controls", panel.id); }
        const sync = () => {
          const open = toc.classList.contains("active");
          toc.innerHTML = glyph(open ? "close" : "menu");
          toc.setAttribute("aria-expanded", String(open));
          toc.setAttribute("aria-label", open ? "收起目录" : "文章目录");
          toc.title = open ? "收起目录" : "文章目录";
        };
        sync();
        new MutationObserver(sync).observe(toc, {attributes: true, attributeFilter: ["class"]});
        document.addEventListener("keydown", event => {
          if (event.key === "Escape" && toc.classList.contains("active")) { toc.click(); toc.focus(); }
        });
      }
      document.querySelectorAll(".gitiu-control").forEach(el => {
        if (!el.getAttribute("aria-label") && el.title) el.setAttribute("aria-label", el.title);
        if (el.matches("clipboard-copy, .toc-icon") && !el.dataset.gitiuKeyboard) {
          el.dataset.gitiuKeyboard = "1";
          el.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); el.click(); }
          });
        }
      });
    };
    scan();
    // Template plugins add code-copy, image-viewer and TOC controls after loading.
    let queued = false;
    new MutationObserver(records => {
      if (queued || !records.some(record => record.addedNodes.length)) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; scan(); });
    }).observe(document.body, {childList: true, subtree: true});
  }

  function watchLocalLinks() {
    if (!isLocalPreview() || window.__gitiuLocalLinksWatching) return;
    window.__gitiuLocalLinksWatching = true;
    const observer = new MutationObserver(() => localizeInternalLinks());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"]
    });
    [0, 120, 480, 1200, 2400].forEach((delay) => window.setTimeout(localizeInternalLinks, delay));
  }

  async function boot() {
    ensureDesignCssLast();
    removeFooterRunDay();
    await applyHome();
    await applyTalkPage();
    const chosenLogo = new URLSearchParams(location.search).get("logo");
    const logo = ["cat", "fold", "seal"].includes(chosenLogo) ? chosenLogo : "cat";
    const syncBrand = () => {
      const mode = document.documentElement.dataset.colorMode;
      const dark = mode === "dark" || (mode === "auto" && systemTheme.matches);
      document.querySelectorAll(".gitiu-brand-logo").forEach(image => {
        image.src = `/logos/gitiu-${logo}${dark ? "-dark" : ""}.svg?v=${BENTO_VERSION}`;
      });
      document.querySelectorAll(".gitiu-slogan-art").forEach(image => {
        image.src = `/logos/gitiu-slogan${dark ? "-dark" : ""}.svg?v=${BENTO_VERSION}`;
      });
    };
    syncBrand();
    new MutationObserver(syncBrand).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-color-mode", "data-gitiu-system-dark"]
    });
    applyGeneralPage();
    enhanceTagPage();
    enhanceLinkPage();
    enhanceControls();
    document.querySelectorAll('[title="切换主题"], [title="搜索"]').forEach((control) => {
      control.setAttribute("aria-label", control.title);
      if (control.title !== "切换主题") return;
      control.setAttribute("role", "button");
      control.setAttribute("tabindex", "0");
      control.addEventListener("keydown", (event) => {
        if (event.key === " " || (event.key === "Enter" && !control.hasAttribute("href"))) {
          event.preventDefault();
          control.click();
        }
      });
    });
    const syncThemeIcons = () => {
      document.querySelectorAll('[title="切换主题"] svg path').forEach((path) => {
        path.setAttribute("d", iconPath(themeIconName()));
      });
    };
    syncThemeIcons();
    new MutationObserver(syncThemeIcons).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-color-mode"]
    });
    localizeInternalLinks();
    watchLocalLinks();
    [0, 120, 480, 1200].forEach((delay) => window.setTimeout(removeFooterRunDay, delay));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
