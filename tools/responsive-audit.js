// Playwright CLI snippet. Open the locally served docs/ site, then pass this file
// to `playwright-cli run-code`. Returns a JSON report and saves representative PNGs.
async (page) => {
  const origin = await page.evaluate(() => location.origin);
  const routes = ["/", "/page2.html", "/tag.html", "/talk.html", "/about.html", "/link.html", "/post/18.html", "/post/13.html", "/post/12.html"];
  const sizes = [[320, 568], [360, 800], [390, 844], [430, 932], [600, 900], [768, 1024], [820, 1180], [860, 900], [861, 900], [1024, 768], [1280, 720], [1440, 900], [1920, 1080], [2560, 1440]];
  const results = [];
  const failures = [];
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/gitiu-bento.css*", route => route.continue());
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  const settle = () => page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  for (const route of routes) {
    await page.goto(origin + route);
    await page.waitForFunction(() => !!window.__gitiuBentoReady && document.body.className.includes("gitiu-"));
    if (route === "/tag.html") await page.locator(".SideNav-item").first().waitFor();
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await settle();
      const sample = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
        const root = document.documentElement;
        const content = rect("#content");
        const footer = rect("#footer");
        const body = rect("body");
        const outside = [...document.querySelectorAll(".gitiu-card, .gitiu-talk-item, .friend-card, #postBody, #header, #footer")].filter(el => {
          const r = el.getBoundingClientRect();
          return r.width && (r.left < -1 || r.right > root.clientWidth + 1);
        }).map(el => el.id || el.className);
        return {
          route: location.pathname, viewport: [innerWidth, innerHeight],
          overflow: Math.max(0, root.scrollWidth - root.clientWidth), outside,
          footerGap: Math.round((footer.top - content.bottom) * 100) / 100,
          footerWidthDifference: Math.round(Math.abs(footer.width - content.width)),
          bodyHeight: Math.round(body.height),
          readingPage: document.body.matches('.gitiu-post-page:not(.gitiu-link-page)'),
          footerBottom: footer.bottom,
          bottomPadding: parseFloat(getComputedStyle(document.body).paddingBottom),
          cards: [...document.querySelectorAll(".gitiu-bento-grid > *")].map(el => Math.round(el.getBoundingClientRect().height))
        };
      });
      results.push(sample);
      if (sample.overflow > 1 || sample.outside.length || sample.footerGap < 0 || (!sample.readingPage && sample.footerGap > 28) || (sample.readingPage && sample.footerBottom + sample.bottomPadding < sample.viewport[1] - 1) || sample.footerWidthDifference > 1) failures.push(sample);
      if ([390, 1440].includes(width) && ["/", "/talk.html", "/link.html", "/post/18.html", "/tag.html"].includes(route)) {
        const name = route === "/" ? "home" : route.slice(1).replaceAll("/", "-").replace(".html", "");
        await page.screenshot({ path: `output/playwright/${name}-${width}.png`, fullPage: true });
      }
    }
  }
  // The original regression depended on viewport height, even at a fixed width.
  const heights = [];
  await page.goto(origin + "/");
  await page.waitForFunction(() => !!window.__gitiuBentoReady);
  for (const height of [600, 819, 820, 900, 1440, 2160]) {
    await page.setViewportSize({ width: 1440, height });
    await settle();
    heights.push(await page.evaluate(() => Math.round(document.querySelector(".gitiu-bento-grid").getBoundingClientRect().height)));
  }
  if (new Set(heights).size !== 1) failures.push({ reason: "Homepage height changes with viewport height", heights });
  return { cases: results.length, errors, failures, heightInvariant: heights, results };
}
