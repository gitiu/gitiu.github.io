(function () {
  const icons = {
    close: 'm5 5 14 14M19 5 5 19', prev: 'm15 5-7 7 7 7', next: 'm9 5 7 7-7 7',
    minus: 'M5 12h14', plus: 'M5 12h14M12 5v14', external: 'M14 3h7v7M21 3 11 13M10 5H5v14h14v-5'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[name]}"/></svg>`;
  class Lightbox {
    constructor() {
      this.index = 0;
      this.scale = 1;
      this.x = this.y = 0;
      this.sequence = 0;
      this.pointers = new Map();
      this.dialog = document.createElement('dialog');
      this.dialog.className = 'gitiu-viewer';
      this.dialog.setAttribute('aria-label', '照片查看器');
      this.dialog.innerHTML = `<header class="gv-header"><div class="gv-heading"><strong class="gv-title"></strong><span class="gv-counter" aria-live="polite"></span></div><div class="gv-tools"><button type="button" data-action="minus" aria-label="缩小" title="缩小">${icon('minus')}</button><button type="button" data-action="fit" title="恢复适应窗口" aria-label="适应窗口">适应</button><button type="button" data-action="plus" aria-label="放大" title="放大">${icon('plus')}</button><a class="gv-original" target="_blank" rel="noopener noreferrer" aria-label="打开原图" title="打开原图">${icon('external')}</a><button type="button" data-action="close" class="gv-close" aria-label="关闭图片" title="关闭 · Esc">${icon('close')}</button></div></header><div class="gv-stage"><div class="gv-canvas"><img class="gv-image" alt="" draggable="false" hidden></div><div class="gv-status" role="status"><span></span><button type="button" data-action="retry" hidden>重新加载</button></div><button type="button" class="gv-prev" data-action="prev" aria-label="上一张图片">${icon('prev')}</button><button type="button" class="gv-next" data-action="next" aria-label="下一张图片">${icon('next')}</button></div><footer class="gv-footer"><div class="gv-thumbs" role="group" aria-label="图片列表"></div><div class="gv-meta"><span class="gv-caption"></span><span class="gv-help">滚轮缩放 · 拖动查看 · ← → 切换</span><span class="gv-scale">1.0×</span></div></footer>`;
      document.body.append(this.dialog);
      this.image = this.dialog.querySelector('.gv-image');
      this.canvas = this.dialog.querySelector('.gv-canvas');
      this.status = this.dialog.querySelector('.gv-status');
      this.dialog.addEventListener('click', event => {
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (action === 'close') this.close();
        if (action === 'prev') this.select(this.index - 1);
        if (action === 'next') this.select(this.index + 1);
        if (action === 'plus') this.zoom(this.scale * 1.5);
        if (action === 'minus') this.zoom(this.scale / 1.5);
        if (action === 'fit') this.zoom(1);
        if (action === 'retry') this.select(this.index);
        const thumb = event.target.closest('[data-image-index]');
        if (thumb) this.select(Number(thumb.dataset.imageIndex));
      });
      this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
      this.dialog.addEventListener('close', () => this.restore());
      this.dialog.addEventListener('keydown', event => {
        if (['ArrowLeft', 'ArrowRight', '+', '=', '-', '0', 'Escape'].includes(event.key)) event.preventDefault();
        if (event.key === 'Escape') this.close();
        if (event.key === 'ArrowLeft') this.select(this.index - 1);
        if (event.key === 'ArrowRight') this.select(this.index + 1);
        if (event.key === '+' || event.key === '=') this.zoom(this.scale * 1.5);
        if (event.key === '-') this.zoom(this.scale / 1.5);
        if (event.key === '0') this.zoom(1);
        if (event.key === 'Tab') {
          const controls = [...this.dialog.querySelectorAll('button:not(:disabled),a[href]')].filter(el => el.getClientRects().length);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      });
      this.canvas.addEventListener('wheel', event => { event.preventDefault(); this.zoom(this.scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15), event); }, {passive: false});
      this.canvas.addEventListener('dblclick', event => this.zoom(this.scale > 1 ? 1 : 2, event));
      this.canvas.addEventListener('pointerdown', event => this.pointerDown(event));
      this.canvas.addEventListener('pointermove', event => this.pointerMove(event));
      this.canvas.addEventListener('pointerup', event => this.pointerUp(event));
      this.canvas.addEventListener('pointercancel', event => { this.pointers.delete(event.pointerId); this.start = null; });
      new ResizeObserver(() => { if (this.dialog.open && this.naturalWidth) this.fit(); }).observe(this.canvas);
      document.addEventListener('click', event => {
        if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || this.dialog.open) return;
        const target = event.target.closest('img') || event.target.closest('a')?.querySelector('img');
        if (!this.eligible(target)) return;
        event.preventDefault();
        this.open(target);
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Enter' && this.eligible(event.target) && !this.dialog.open) { event.preventDefault(); this.open(event.target); }
      });
      this.collect().forEach(img => {
        if (!img.closest('a')) { img.tabIndex = 0; img.setAttribute('role', 'button'); img.setAttribute('aria-label', '查看照片'); }
        img.style.cursor = 'zoom-in';
      });
    }
    eligible(img) {
      return img instanceof HTMLImageElement && !!img.closest('#postBody') && !img.closest('.friend-card, .friend-own, .toc, .gitiu-viewer') && !img.matches('.friend-avatar,.friend-site-icon,.emoji,.octicon') && !img.closest('mjx-container');
    }
    collect() { return [...document.querySelectorAll('#postBody img')].filter(img => this.eligible(img)); }
    url(value) {
      try { const url = new URL(value, location.href); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch (_) { return ''; }
    }
    open(target) {
      this.items = this.collect();
      if (!this.items.length) return;
      this.returnFocus = target.closest('a') || target;
      this.previousOverflow = document.documentElement.style.overflow;
      this.scrollPosition = {x: scrollX, y: scrollY};
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.classList.add('gitiu-viewing');
      this.dialog.querySelector('.gv-title').textContent = document.querySelector('.postTitle')?.textContent.trim() || '照片';
      const thumbs = this.dialog.querySelector('.gv-thumbs');
      thumbs.replaceChildren();
      thumbs.hidden = this.items.length < 2;
      this.items.forEach((img, index) => {
        const button = document.createElement('button');
        button.type = 'button'; button.dataset.imageIndex = index;
        button.setAttribute('aria-label', `查看第 ${index + 1} 张图片`);
        const preview = document.createElement('img'); preview.alt = ''; preview.src = img.currentSrc || img.src; preview.draggable = false;
        preview.onerror = () => { preview.remove(); button.textContent = String(index + 1); };
        button.append(preview); thumbs.append(button);
      });
      this.dialog.showModal();
      this.select(this.items.indexOf(target));
      this.dialog.querySelector('[data-action="close"]').focus({preventScroll: true});
    }
    select(index) {
      if (index < 0 || index >= this.items.length) return;
      this.index = index; const sequence = ++this.sequence;
      this.scale = 1; this.x = this.y = 0; this.naturalWidth = 0;
      this.image.hidden = true; this.dialog.classList.remove('gv-zoomed');
      this.status.hidden = false; this.status.querySelector('span').textContent = '正在加载照片…';
      this.status.querySelector('button').hidden = true;
      const source = this.items[index];
      const preview = this.url(source.getAttribute('src') || source.currentSrc);
      const original = this.url(source.dataset.fullSrc || source.src);
      this.dialog.querySelector('.gv-original').href = original || preview;
      const description = source.alt.trim();
      this.image.alt = description;
      this.dialog.querySelector('.gv-caption').textContent = /^(image|img|图片|照片)?$/i.test(description) ? `照片 ${String(index + 1).padStart(2, '0')}` : description;
      this.dialog.querySelector('.gv-counter').textContent = `${index + 1} / ${this.items.length}`;
      this.dialog.querySelector('[data-action="prev"]').disabled = index === 0;
      this.dialog.querySelector('[data-action="next"]').disabled = index === this.items.length - 1;
      this.dialog.querySelectorAll('[data-image-index]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.imageIndex) === index)));
      this.dialog.querySelector(`[data-image-index="${index}"]`)?.scrollIntoView({block: 'nearest', inline: 'nearest'});
      this.paint();
      const load = (url, fallback) => {
        const incoming = new Image();
        incoming.onload = () => {
          if (sequence !== this.sequence || !this.dialog.open) return;
          this.naturalWidth = incoming.naturalWidth; this.naturalHeight = incoming.naturalHeight;
          this.image.src = incoming.src; this.image.hidden = false; this.status.hidden = true; this.fit();
        };
        incoming.onerror = () => {
          if (sequence !== this.sequence || !this.dialog.open) return;
          if (fallback && fallback !== url) { load(fallback, ''); return; }
          this.status.querySelector('span').textContent = '照片暂时无法加载';
          this.status.querySelector('button').hidden = false;
        };
        incoming.src = url;
      };
      load(preview, original);
    }
    fit() {
      if (!this.naturalWidth) return;
      const factor = Math.min((this.canvas.clientWidth - 32) / this.naturalWidth, (this.canvas.clientHeight - 24) / this.naturalHeight, 1);
      this.fitWidth = this.naturalWidth * factor; this.fitHeight = this.naturalHeight * factor;
      this.image.style.width = `${this.fitWidth}px`; this.image.style.height = `${this.fitHeight}px`; this.paint();
    }
    zoom(value, point) {
      if (!this.naturalWidth) return;
      const next = Math.max(1, Math.min(4, value));
      if (point) {
        const rect = this.canvas.getBoundingClientRect(), ratio = next / this.scale;
        this.x = this.x * ratio + (point.clientX - rect.left - rect.width / 2) * (1 - ratio);
        this.y = this.y * ratio + (point.clientY - rect.top - rect.height / 2) * (1 - ratio);
      }
      this.scale = next; this.paint();
    }
    paint() {
      const limitX = Math.max(0, ((this.fitWidth || 0) * this.scale - this.canvas.clientWidth) / 2 + 16);
      const limitY = Math.max(0, ((this.fitHeight || 0) * this.scale - this.canvas.clientHeight) / 2 + 12);
      this.x = this.scale === 1 ? 0 : Math.max(-limitX, Math.min(limitX, this.x));
      this.y = this.scale === 1 ? 0 : Math.max(-limitY, Math.min(limitY, this.y));
      this.image.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;
      this.dialog.classList.toggle('gv-zoomed', this.scale > 1);
      this.dialog.querySelector('.gv-scale').textContent = `${this.scale.toFixed(1)}×`;
      this.dialog.querySelector('[data-action="minus"]').disabled = !this.naturalWidth || this.scale <= 1;
      this.dialog.querySelector('[data-action="plus"]').disabled = !this.naturalWidth || this.scale >= 4;
      this.dialog.querySelector('[data-action="fit"]').disabled = !this.naturalWidth;
    }
    pointerDown(event) {
      if (event.button && event.pointerType !== 'touch') return;
      this.canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
      if (this.pointers.size === 1) { this.pinching = false; this.start = {x: event.clientX, y: event.clientY, panX: this.x, panY: this.y, blank: event.target === this.canvas}; }
      if (this.pointers.size === 2) {
        this.pinching = true; const [a, b] = [...this.pointers.values()];
        this.pinch = {distance: Math.hypot(a.x - b.x, a.y - b.y), scale: this.scale};
      }
    }
    pointerMove(event) {
      if (!this.pointers.has(event.pointerId)) return;
      this.pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.zoom(this.pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, this.pinch.distance));
      } else if (this.start && this.scale > 1 && !this.pinching) {
        this.x = this.start.panX + event.clientX - this.start.x; this.y = this.start.panY + event.clientY - this.start.y; this.paint();
      }
    }
    pointerUp(event) {
      this.pointers.delete(event.pointerId);
      if (this.pointers.size || !this.start) return;
      const dx = event.clientX - this.start.x, dy = event.clientY - this.start.y;
      if (!this.pinching && this.scale === 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3) this.select(this.index + (dx < 0 ? 1 : -1));
      else if (!this.pinching && this.start.blank && Math.hypot(dx, dy) < 4) this.close();
      this.start = null;
    }
    close() { if (this.dialog.open) this.dialog.close(); }
    restore() {
      ++this.sequence; this.pointers.clear(); this.start = null;
      document.documentElement.style.overflow = this.previousOverflow;
      document.documentElement.classList.remove('gitiu-viewing');
      if (this.scrollPosition) window.scrollTo(this.scrollPosition.x, this.scrollPosition.y);
      this.returnFocus?.focus({preventScroll: true});
    }
  }
  window.Lightbox = Lightbox;
  const boot = () => { if (!window.gitiuLightbox) window.gitiuLightbox = new Lightbox(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
