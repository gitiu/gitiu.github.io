async page => {
  // Simulate missing favicons: the local SVG must always remain visible.
  await page.route('**/favicon.ico', route => route.abort());
  await page.goto('http://127.0.0.1:4173/link.html');
  await page.locator('.friend-card').first().waitFor();
  if (await page.locator('.friend-card').count() !== 6) throw Error('Missing friend');
  const results = [];
  for (const width of [320,390,768,1024,1440,2560]) {
    await page.setViewportSize({width,height:900});
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const sample = await page.evaluate(() => ({
      width: innerWidth,
      overflow: Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),
      fallbacks: [...document.querySelectorAll('.friend-emblem > svg')].filter(el => getComputedStyle(el).visibility !== 'hidden').length,
      gap: document.querySelector('#footer').getBoundingClientRect().top-document.querySelector('#content').getBoundingClientRect().bottom
    }));
    if (sample.overflow || sample.fallbacks !== 6 || sample.gap > 28) throw Error(JSON.stringify(sample));
    results.push(sample);
    if ([390,1440].includes(width)) await page.screenshot({path:`output/playwright/friends-${width}.png`,fullPage:true});
  }
  await page.locator('.friend-application summary').click();
  if (!await page.locator('.friend-rules').isVisible()) throw Error('Application hidden');
  if (!await page.locator('.friend-rules').textContent().then(t => t.includes('建站半年以上'))) throw Error('Lost rules');
  await page.setViewportSize({width:390,height:844});
  if (await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)) throw Error('Expanded overflow');
  await page.locator('.friend-application summary').click();
  await page.evaluate(()=>document.documentElement.dataset.colorMode='dark');
  await page.screenshot({path:'output/playwright/friends-dark-390.png',fullPage:true});
  await page.unroute('**/favicon.ico');
  return results;
}
