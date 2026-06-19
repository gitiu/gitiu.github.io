import json
import re
from datetime import datetime
from html import escape
from pathlib import Path


BENTO_VERSION = "20260619b"
ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"

ICON_PATHS = {
    "about": "M10.561 8.073a6.005 6.005 0 0 1 3.432 5.142.75.75 0 1 1-1.498.07 4.5 4.5 0 0 0-8.99 0 .75.75 0 0 1-1.498-.07 6.004 6.004 0 0 1 3.431-5.142 3.999 3.999 0 1 1 5.123 0ZM10.5 5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z",
    "link": "m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z",
    "post": "M0 3.75C0 2.784.784 2 1.75 2h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 14H1.75A1.75 1.75 0 0 1 0 12.25Zm1.75-.25a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-8.5a.25.25 0 0 0-.25-.25ZM3.5 6.25a.75.75 0 0 1 .75-.75h7a.75.75 0 0 1 0 1.5h-7a.75.75 0 0 1-.75-.75Zm.75 2.25h4a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1 0-1.5Z",
    "rss": "M2.002 2.725a.75.75 0 0 1 .797-.699C8.79 2.42 13.58 7.21 13.974 13.201a.75.75 0 0 1-1.497.098 10.502 10.502 0 0 0-9.776-9.776.747.747 0 0 1-.7-.798ZM2.84 7.05h-.002a7.002 7.002 0 0 1 6.113 6.111.75.75 0 0 1-1.49.178 5.503 5.503 0 0 0-4.8-4.8.75.75 0 0 1 .179-1.489ZM2 13a1 1 0 1 1 2 0 1 1 0 0 1-2 0Z",
    "search": "M15.7 13.3l-3.81-3.83A5.93 5.93 0 0 0 13 6c0-3.31-2.69-6-6-6S1 2.69 1 6s2.69 6 6 6c1.3 0 2.48-.41 3.47-1.11l3.83 3.81c.19.2.45.3.7.3.25 0 .52-.09.7-.3a.996.996 0 0 0 0-1.41v.01zM7 10.7c-2.59 0-4.7-2.11-4.7-4.7 0-2.59 2.11-4.7 4.7-4.7 2.59 0 4.7 2.11 4.7 4.7 0 2.59-2.11 4.7-4.7 4.7z",
    "sun": "M8 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM8 12a4 4 0 100-8 4 4 0 000 8zM8 0a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0V.75A.75.75 0 018 0zm0 13a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 018 13zM2.343 2.343a.75.75 0 011.061 0l1.06 1.061a.75.75 0 01-1.06 1.06l-1.06-1.06a.75.75 0 010-1.06zm9.193 9.193a.75.75 0 011.06 0l1.061 1.06a.75.75 0 01-1.06 1.061l-1.061-1.06a.75.75 0 010-1.061zM16 8a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0116 8zM3 8a.75.75 0 01-.75.75H.75a.75.75 0 010-1.5h1.5A.75.75 0 013 8zm10.657-5.657a.75.75 0 010 1.061l-1.061 1.06a.75.75 0 11-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zm-9.193 9.193a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 11-1.061-1.06l1.06-1.061a.75.75 0 011.061 0z",
}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def ordered_posts(meta):
    posts = [item for key, item in meta.items() if key != "labelColorDict" and isinstance(item, dict)]
    return sorted(posts, key=lambda item: item.get("createdDate", ""), reverse=True)


def normalize_whitespace(value):
    return re.sub(r"\s+", " ", value or "").strip()


def strip_markdown(value):
    value = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", value or "")
    value = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", value)
    value = re.sub(r"https?://\S+", "", value)
    value = re.sub(r"[#>*_`~-]", "", value)
    value = re.sub(r"^\d+\.\s*", "", value, flags=re.MULTILINE)
    return normalize_whitespace(value)


def summarize(post, max_length=34):
    labels = post.get("labels", [])
    cleaned = strip_markdown(post.get("description", ""))
    fallback = "短句、生活瞬间和一些当时的心情。" if "说说" in labels else "文章、照片和一段值得留下的时间。"
    if not cleaned:
        return fallback
    return cleaned[:max_length] + "..." if len(cleaned) > max_length else cleaned


def quote_from(post):
    lines = [
        normalize_whitespace(re.sub(r"https?://\S+", "", line))
        for line in (post.get("description") or "").splitlines()
    ]
    lines = [line for line in lines if line]
    preferred = next((line for line in lines if "夕阳" in line), None) or (lines[1] if len(lines) > 1 else "") or (lines[0] if lines else "") or post.get("postTitle", "")
    return preferred[:24] + "..." if len(preferred) > 24 else preferred


def svg(icon):
    return f'<svg class="octicon" width="16" height="16" aria-hidden="true"><path d="{ICON_PATHS.get(icon, "")}"></path></svg>'


def pill(href, text, icon):
    return f'<a class="gitiu-link-pill gitiu-link-{icon}" href="{escape(href)}">{svg(icon)}<span>{escape(text)}</span></a>'


def icon_button(href, title, icon, extra=""):
    return f'<a class="gitiu-icon-button" href="{escape(href)}" title="{escape(title)}" {extra}>{svg(icon)}</a>'


def label_kind(text):
    if text == "说说":
        return "talk"
    if text == "转载":
        return "repost"
    if text == "文章":
        return "article"
    return "neutral"


def label(text, kind):
    return f'<span class="Label gitiu-soft-label gitiu-label-{kind}">{escape(str(text))}</span>'


def post_meta(post):
    parts = []
    if post.get("commentNum"):
        parts.append(label(post["commentNum"], "count"))
    parts.extend(label(item, label_kind(item)) for item in post.get("labels", []))
    if post.get("createdDate"):
        parts.append(label(post["createdDate"], "date"))
    return '<div class="gitiu-post-meta">' + "".join(parts) + "</div>"


def post_item(post):
    title = escape(post.get("postTitle", ""))
    desc = escape(summarize(post))
    href = escape(post.get("postUrl", "#"))
    return f'''
      <a class="gitiu-post-item" href="{href}">
        <div>
          <h2>{title}</h2>
          <p>{desc}</p>
        </div>
        {post_meta(post)}
      </a>'''


def profile_card(config, posts):
    comments = sum(int(post.get("commentNum") or 0) for post in posts)
    try:
        start = datetime.strptime(config.get("startSite", "10/24/2019"), "%m/%d/%Y")
        run_days = (datetime.now() - start).days
    except ValueError:
        run_days = 0
    title = escape(config.get("title", "Gitiu's Blog"))
    avatar = escape(config.get("avatarUrl", "/cat.svg"))
    return f'''
    <article class="gitiu-card gitiu-profile-card">
      <div class="gitiu-profile-top">
        <img class="gitiu-avatar" src="{avatar}" alt="avatar">
        <div>
          <h1>{title}</h1>
          <span class="Label" style="background-color:#eef0f3;color:#4b5563">我的生活际遇</span>
        </div>
      </div>
      <p>记录生活、短句、旅途、夜晚和一些还没有被归类的瞬间。</p>
      <div class="gitiu-stat-row">
        <div class="gitiu-stat"><strong>{len(posts)}</strong><span>文章</span></div>
        <div class="gitiu-stat"><strong>{comments}</strong><span>评论</span></div>
        <div class="gitiu-stat"><strong>{run_days}</strong><span>运行天数</span></div>
      </div>
      <div class="gitiu-profile-links">
        <span class="gitiu-card-subtle">探索</span>
        <div class="gitiu-links">
          {pill("about.html", "关于", "about")}
          {pill("tag.html", "标签", "post")}
          {pill("link.html", "友链", "link")}
          {pill("rss.xml", "RSS", "rss")}
        </div>
      </div>
    </article>'''


def post_card(page_posts):
    article_posts = [post for post in page_posts if "说说" not in post.get("labels", [])][:4]
    items = "".join(post_item(post) for post in article_posts)
    return f'''
    <article class="gitiu-card gitiu-post-card">
      <div class="gitiu-card-head">
        <span>最近更新</span>
        <div class="icon-row">
          {icon_button("tag.html", "搜索", "search")}
          {icon_button("javascript:void(0)", "切换主题", "sun", 'onclick="modeSwitch(); return false;"')}
        </div>
      </div>
      <div class="gitiu-post-list">{items}</div>
      <div class="gitiu-pagination">
        <span>显示最新 {len(article_posts)} 篇</span>
        <a class="gitiu-more" href="tag.html#文章">全部文章</a>
      </div>
    </article>'''


def quote_card(posts):
    talk = next((post for post in posts if "说说" in post.get("labels", [])), posts[0])
    quote = escape(quote_from(talk))
    return f'''
    <a class="gitiu-card gitiu-quick-card" href="talk.html">
      <div class="gitiu-card-head"><span>说说看板</span><span class="Label" style="background-color:#fde8f5;color:#9d2b72">时间线</span></div>
      <p class="gitiu-quote">“{quote}”</p>
      <span class="gitiu-card-subtle gitiu-quote-more">全部动态 →</span>
    </a>'''


def home_content(config, all_posts, page_posts):
    return f'''
<div id="content">
  <section class="gitiu-bento-grid">
    {profile_card(config, all_posts)}
    {post_card(page_posts)}
    {quote_card(all_posts)}
  </section>
</div>'''


def talk_item(post):
    return f'''
      <a class="gitiu-talk-item" href="{escape(post.get("postUrl", "#"))}">
        <div class="gitiu-talk-body">
          <div class="gitiu-talk-meta">
            <h2>{escape(post.get("postTitle", "未命名说说"))}</h2>
            <time>{escape(post.get("createdDate", ""))}</time>
          </div>
          <p>{escape(summarize(post, 90))}</p>
        </div>
      </a>'''


def talk_content(posts):
    talks = [post for post in posts if "说说" in post.get("labels", [])]
    return f'''
<div id="content">
  <section class="gitiu-talk-board">
    <div class="gitiu-talk-head">
      <div>
        <span class="gitiu-card-subtle">短动态</span>
        <h1>说说时间线</h1>
      </div>
      <a class="gitiu-link-pill" href="index.html">返回首页</a>
    </div>
    <div class="gitiu-talk-list">{"".join(talk_item(post) for post in talks)}</div>
  </section>
</div>'''


def set_body_class(html, class_name):
    def replace(match):
        attrs = re.sub(r'\s+class="[^"]*"', "", match.group(1))
        return f'<body class="{class_name}"{attrs}>'

    return re.sub(r"<body([^>]*)>", replace, html, count=1)


def replace_content(html, content):
    pattern = re.compile(r'<div id="content">.*?(?=\n\s*<div id="footer">)', re.DOTALL)
    return pattern.sub(content, html, count=1)


def update_asset_versions(text):
    return re.sub(r"gitiu-bento\.(css|js)\?v=[A-Za-z0-9_-]+", rf"gitiu-bento.\1?v={BENTO_VERSION}", text)


def write_page(path, content, body_class):
    if not path.exists():
        return
    html = update_asset_versions(path.read_text(encoding="utf-8"))
    html = replace_content(html, content)
    html = set_body_class(html, body_class)
    path.write_text(html, encoding="utf-8")


def update_versions_everywhere():
    for base in [DOCS, ROOT / "static"]:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in {".html", ".js", ".css"}:
                continue
            text = path.read_text(encoding="utf-8")
            updated = update_asset_versions(text)
            if updated != text:
                path.write_text(updated, encoding="utf-8")
    for rel in ["config.json", "blogBase.json"]:
        path = ROOT / rel
        if path.exists():
            text = path.read_text(encoding="utf-8")
            updated = update_asset_versions(text)
            if updated != text:
                path.write_text(updated, encoding="utf-8")


def main():
    config = read_json(ROOT / "config.json")
    meta = read_json(DOCS / "gitiu-post-meta.json")
    posts = ordered_posts(meta)
    page_size = int(config.get("onePageListNum", 10))
    pages = [DOCS / "index.html"] + sorted(DOCS.glob("page*.html"))
    for index, page in enumerate(pages):
        page_posts = posts[index * page_size : (index + 1) * page_size]
        if page_posts:
            write_page(page, home_content(config, posts, page_posts), "gitiu-home")
    for page in [DOCS / "talk.html", DOCS / "pages" / "talk.html", ROOT / "static" / "pages" / "talk.html"]:
        write_page(page, talk_content(posts), "gitiu-talk-page")
    update_versions_everywhere()


if __name__ == "__main__":
    main()
