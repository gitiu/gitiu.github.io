import hashlib
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from html import escape
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
CACHE_DIR = DOCS / "assets" / "img-cache" / "v1"
MANIFEST_PATH = CACHE_DIR / "manifest.json"
POST_DIR = DOCS / "post"

VARIANT_WIDTHS = (800, 1600)
WEBP_QUALITY = 88
MAX_DOWNLOAD_BYTES = 32 * 1024 * 1024
REQUEST_TIMEOUT = 30
IMAGE_SIZES = "(max-width: 760px) calc(100vw - 36px), 900px"
VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}


class PostImageParser(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=False)
        self.html = html
        self.line_offsets = self._line_offsets(html)
        self.post_depth = 0
        self.images = []

    @staticmethod
    def _line_offsets(html):
        offsets = [0]
        for index, char in enumerate(html):
            if char == "\n":
                offsets.append(index + 1)
        return offsets

    def _absolute_pos(self):
        line, offset = self.getpos()
        return self.line_offsets[line - 1] + offset

    @staticmethod
    def _attr_dict(attrs):
        return {name.lower(): value for name, value in attrs if name}

    def _handle_open_tag(self, tag, attrs, is_self_closing=False):
        tag = tag.lower()
        attr_dict = self._attr_dict(attrs)
        in_post = self.post_depth > 0

        if tag == "div" and attr_dict.get("id") == "postBody" and not in_post:
            self.post_depth = 1
            return

        if in_post and tag == "img":
            raw = self.get_starttag_text()
            if raw:
                start = self._absolute_pos()
                self.images.append(
                    {
                        "start": start,
                        "end": start + len(raw),
                        "attrs": attrs,
                    }
                )

        if in_post and tag not in VOID_TAGS and not is_self_closing:
            self.post_depth += 1

    def handle_starttag(self, tag, attrs):
        self._handle_open_tag(tag, attrs, is_self_closing=False)

    def handle_startendtag(self, tag, attrs):
        self._handle_open_tag(tag, attrs, is_self_closing=True)

    def handle_endtag(self, tag):
        if self.post_depth > 0 and tag.lower() not in VOID_TAGS:
            self.post_depth -= 1


def read_manifest():
    if not MANIFEST_PATH.exists():
        return {}
    try:
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def write_manifest(manifest):
    for entry in manifest.values():
        if isinstance(entry, dict):
            entry.pop("updatedAt", None)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def is_github_image_url(url):
    try:
        parsed = urllib.parse.urlparse(url)
    except ValueError:
        return False
    if parsed.scheme not in {"http", "https"}:
        return False
    host = parsed.netloc.lower()
    if host == "github.com" and parsed.path.startswith("/user-attachments/assets/"):
        return True
    if host == "user-images.githubusercontent.com":
        return True
    if host == "raw.githubusercontent.com":
        return True
    return False


def cache_key(url):
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:18]


def cached_entry(manifest, url):
    entry = manifest.get(url)
    if not entry:
        return None
    variants = entry.get("variants") or []
    if not variants:
        return None
    for variant in variants:
        path = DOCS / variant.get("path", "").lstrip("/")
        if not path.exists():
            return None
    return entry


def download_image(url):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Gitiu image optimizer",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        content_type = response.headers.get("content-type", "")
        data = response.read(MAX_DOWNLOAD_BYTES + 1)
    if len(data) > MAX_DOWNLOAD_BYTES:
        raise ValueError("image is larger than the download limit")
    if "svg" in content_type.lower():
        raise ValueError("svg images are kept as original")
    return data, content_type


def resample_filter():
    return getattr(getattr(Image, "Resampling", Image), "LANCZOS")


def normalize_image(data):
    image = Image.open(BytesIO(data))
    if getattr(image, "is_animated", False):
        raise ValueError("animated images are kept as original")
    image = ImageOps.exif_transpose(image)
    has_alpha = image.mode in {"RGBA", "LA"} or "transparency" in image.info
    if has_alpha:
        image = image.convert("RGBA")
    else:
        image = image.convert("RGB")
    return image, has_alpha


def variant_widths(original_width):
    widths = [width for width in VARIANT_WIDTHS if width < original_width]
    widths.append(original_width if original_width < VARIANT_WIDTHS[-1] else VARIANT_WIDTHS[-1])
    return sorted(set(widths))


def save_webp(image, output_path, width, has_alpha):
    if width < image.width:
        height = round(image.height * width / image.width)
        resized = image.resize((width, height), resample_filter())
    else:
        resized = image.copy()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if has_alpha:
        resized.save(output_path, "WEBP", lossless=True, method=6)
    else:
        resized.save(output_path, "WEBP", quality=WEBP_QUALITY, method=6)
    return resized.width, resized.height, output_path.stat().st_size


def optimize_url(manifest, url):
    existing = cached_entry(manifest, url)
    if existing:
        return existing

    data, content_type = download_image(url)
    image, has_alpha = normalize_image(data)
    key = cache_key(url)
    variants = []

    for width in variant_widths(image.width):
        output_path = CACHE_DIR / f"{key}-{width}.webp"
        actual_width, actual_height, byte_size = save_webp(image, output_path, width, has_alpha)
        variants.append(
            {
                "path": "/" + output_path.relative_to(DOCS).as_posix(),
                "width": actual_width,
                "height": actual_height,
                "bytes": byte_size,
            }
        )

    entry = {
        "source": url,
        "sourceBytes": len(data),
        "sourceContentType": content_type,
        "sourceWidth": image.width,
        "sourceHeight": image.height,
        "lossless": has_alpha,
        "quality": "lossless" if has_alpha else WEBP_QUALITY,
        "variants": variants,
    }
    manifest[url] = entry
    return entry


def attr_map(attrs):
    return {name.lower(): value for name, value in attrs if name}


def ordered_attrs(attrs):
    current = attr_map(attrs)
    order = ["src", "alt", "style", "srcset", "sizes", "width", "height", "loading", "decoding", "fetchpriority", "data-full-src"]
    seen = set()
    result = []
    for name in order:
        if name in current and current[name] is not None:
            result.append((name, current[name]))
            seen.add(name)
    for name, value in attrs:
        lower = name.lower()
        if lower not in seen and value is not None:
            result.append((lower, value))
            seen.add(lower)
    return result


def render_img(attrs):
    rendered = []
    for name, value in ordered_attrs(attrs):
        rendered.append(f'{name}="{escape(str(value), quote=True)}"')
    return "<img " + " ".join(rendered) + ">"


def update_attrs(attrs, entry, original_url, image_index, is_optimizable):
    current = attr_map(attrs)
    next_attrs = [(name.lower(), value) for name, value in attrs if name]

    def set_attr(name, value):
        lower = name.lower()
        for index, (item_name, _) in enumerate(next_attrs):
            if item_name == lower:
                next_attrs[index] = (lower, value)
                return
        next_attrs.append((lower, value))

    def remove_attr(name):
        lower = name.lower()
        next_attrs[:] = [(item_name, value) for item_name, value in next_attrs if item_name != lower]

    if entry:
        variants = sorted(entry["variants"], key=lambda item: item["width"])
        largest = variants[-1]
        set_attr("src", largest["path"])
        set_attr("srcset", ", ".join(f'{item["path"]} {item["width"]}w' for item in variants))
        set_attr("sizes", IMAGE_SIZES)
        set_attr("width", largest["width"])
        set_attr("height", largest["height"])
        set_attr("data-full-src", original_url)
    elif is_optimizable:
        set_attr("src", original_url)
        remove_attr("srcset")
        remove_attr("sizes")
        remove_attr("width")
        remove_attr("height")
        remove_attr("data-full-src")

    set_attr("decoding", "async")
    if image_index == 0:
        set_attr("loading", "eager")
        set_attr("fetchpriority", "high")
    else:
        set_attr("loading", "lazy")
        remove_attr("fetchpriority")

    if "alt" not in current:
        set_attr("alt", "")

    return next_attrs


def optimize_page(path, manifest):
    html = path.read_text(encoding="utf-8")
    parser = PostImageParser(html)
    parser.feed(html)
    if not parser.images:
        return 0, 0

    replacements = []
    optimized = 0
    touched = 0

    for index, image in enumerate(parser.images):
        attrs = image["attrs"]
        current = attr_map(attrs)
        original_url = current.get("data-full-src") or current.get("src") or ""
        entry = None
        is_optimizable = is_github_image_url(original_url)

        if is_optimizable:
            try:
                entry = optimize_url(manifest, original_url)
                optimized += 1
            except (OSError, ValueError, urllib.error.URLError, UnidentifiedImageError) as exc:
                print(f"[image-optimize] keep original: {original_url} ({exc})")

        next_attrs = update_attrs(attrs, entry, original_url, index, is_optimizable)
        replacements.append((image["start"], image["end"], render_img(next_attrs)))
        touched += 1

    for start, end, replacement in reversed(replacements):
        html = html[:start] + replacement + html[end:]
    path.write_text(html, encoding="utf-8")
    return touched, optimized


def main():
    if not POST_DIR.exists():
        print("[image-optimize] no post directory found")
        return 0

    manifest = read_manifest()
    total_images = 0
    optimized_images = 0

    for path in sorted(POST_DIR.glob("*.html")):
        touched, optimized = optimize_page(path, manifest)
        total_images += touched
        optimized_images += optimized

    write_manifest(manifest)
    print(f"[image-optimize] processed {total_images} post images, optimized {optimized_images}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
