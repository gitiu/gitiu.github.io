(function () {
  const BENTO_VERSION = "20260609a";
  if (window.__gitiuBentoReady === BENTO_VERSION) return;
  window.__gitiuBentoReady = BENTO_VERSION;
  window.__gitiuBentoVersion = BENTO_VERSION;
  document.documentElement.setAttribute("data-gitiu-bento-version", BENTO_VERSION);

  const isHomePage = /\/(?:index\.html|page\d+\.html)?$/.test(location.pathname) || location.pathname === "/";
  const isTalkPage = /\/talk\.html$/.test(location.pathname);

  let postDataCache = null;

  function ensureDesignCssLast() {
    const href = `/gitiu-bento.css?v=${BENTO_VERSION}`;
    document.querySelectorAll('link[href*="gitiu-bento.css"]').forEach((link) => link.remove());
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.documentElement.appendChild(link);
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
    const runDays = (runDayText.match(/\d+/) || ["2419"])[0];

    const card = document.createElement("article");
    card.className = "gitiu-card gitiu-profile-card";
    card.innerHTML = `
      <div class="gitiu-profile-top">
        <img class="gitiu-avatar" src="${avatar}" alt="avatar">
        <div>
          <h1>${title}</h1>
          <span class="Label" style="background-color:#eef0f3;color:#4b5563">我的生活际遇</span>
        </div>
      </div>
      <p>记录生活、短句、旅途、夜晚和一些还没有被归类的瞬间。</p>
      <div class="gitiu-stat-row">
        <div class="gitiu-stat"><strong>${posts}</strong><span>文章</span></div>
        <div class="gitiu-stat"><strong>${comments}</strong><span>评论</span></div>
        <div class="gitiu-stat"><strong>${runDays}</strong><span>运行天数</span></div>
      </div>
      <div class="gitiu-profile-links">
        <span class="gitiu-card-subtle">探索</span>
        <div class="gitiu-links">
          ${pillMarkup("about.html", "关于", "about")}
          ${pillMarkup("tag.html", "标签", "post")}
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
    const meta = document.createElement("div");
    meta.className = "gitiu-talk-meta";
    const title = document.createElement("h2");
    title.textContent = post.postTitle || "未命名说说";
    const date = document.createElement("time");
    date.textContent = post.createdDate || "";
    meta.append(title, date);
    const desc = document.createElement("p");
    desc.textContent = summarizeDescription(post.description, post.labels || [], 90);
    body.append(meta, desc);

    link.appendChild(body);
    return link;
  }

  async function applyTalkPage() {
    if (!isTalkPage) return;
    const content = document.querySelector("#content");
    if (!content) return;

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
        <span class="gitiu-card-subtle">短动态</span>
        <h1>说说时间线</h1>
      </div>
      <a class="gitiu-link-pill" href="${localHref("index.html")}">返回首页</a>
    `;

    const list = document.createElement("div");
    list.className = "gitiu-talk-list";
    talks.forEach((post) => list.appendChild(makeTalkTimelineItem(post)));

    board.append(head, list);
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
    if (!document.querySelector(".tagTitle") || !document.querySelector("#taglabel")) return;
    document.body.classList.add("gitiu-tag-page");

    const styleTagTitle = () => {
      const title = document.querySelector(".tagTitle");
      if (!title || title.querySelector(".gitiu-title-hash")) return;
      title.innerHTML = title.textContent.replace("#", '<span class="gitiu-title-hash">#</span>');
    };

    const syncActiveChip = () => {
      styleTagTitle();
      const current = safeDecode(location.hash.replace(/^#/, "")) || "All";
      document.querySelectorAll("#taglabel .Label").forEach((chip) => {
        const name = chip.childNodes[0]?.textContent.trim() || chip.textContent.replace(/\d+$/, "").trim();
        chip.classList.toggle("gitiu-active-chip", name === current);
      });
    };

    const input = document.querySelector(".subnav-search-input");
    if (input && !input.dataset.gitiuSearchReady) {
      input.dataset.gitiuSearchReady = "1";
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && typeof window.searchShow === "function") {
          event.preventDefault();
          window.searchShow();
          window.setTimeout(syncActiveChip, 0);
        }
      });
    }

    const searchIcon = document.querySelector(".subnav-search-icon");
    if (searchIcon && !searchIcon.dataset.gitiuSearchReady) {
      searchIcon.dataset.gitiuSearchReady = "1";
      searchIcon.setAttribute("role", "button");
      searchIcon.setAttribute("tabindex", "0");
      const runSearch = () => {
        if (typeof window.searchShow === "function") {
          window.searchShow();
          window.setTimeout(syncActiveChip, 0);
        }
      };
      searchIcon.addEventListener("click", runSearch);
      searchIcon.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          runSearch();
        }
      });
    }

    [0, 120, 480, 1200].forEach((delay) => window.setTimeout(syncActiveChip, delay));
    window.addEventListener("hashchange", syncActiveChip);
  }

  function faviconFor(url) {
    try {
      const host = new URL(url, location.href).hostname;
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=96`;
    } catch (_) {
      return "cat.svg";
    }
  }

  function enhanceLinkPage() {
    const postBody = document.querySelector("#postBody");
    if (!postBody || !/\/link\.html$/.test(location.pathname)) return;
    document.body.classList.add("gitiu-link-page");

    const table = postBody.querySelector("table");
    if (table && !postBody.querySelector(".friend-grid")) {
      const grid = document.createElement("div");
      grid.className = "friend-grid";
      table.querySelectorAll("tbody tr").forEach((row) => {
        const cells = row.querySelectorAll("td");
        const anchor = cells[0]?.querySelector("a");
        if (!anchor) return;
        const rawHref = anchor.getAttribute("href") || "#";
        const href = localHref(rawHref);
        const name = anchor.textContent.trim();
        const desc = cells[1]?.textContent.trim() || "记录生活与灵感";
        const card = document.createElement("a");
        card.className = "friend-card";
        card.href = href;
        card.target = "_blank";
        card.rel = "nofollow noopener";
        card.innerHTML = `
          <img class="friend-avatar" src="${faviconFor(rawHref)}" alt="${name}">
          <span class="friend-info">
            <span class="friend-name">${name}</span>
            <span class="friend-desc">${desc}</span>
          </span>
        `;
        grid.appendChild(card);
      });
      table.closest("markdown-accessiblity-table")?.replaceWith(grid);
    }

    const applyTitle = [...postBody.querySelectorAll("h3")].find((heading) => heading.textContent.includes("友链申请"));
    if (applyTitle && !postBody.querySelector(".apply-rules-box")) {
      const box = document.createElement("div");
      box.className = "apply-rules-box";
      applyTitle.before(box);
      let node = applyTitle;
      while (node) {
        const next = node.nextSibling;
        box.appendChild(node);
        node = next;
      }
    }
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
    applyGeneralPage();
    enhanceTagPage();
    enhanceLinkPage();
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
