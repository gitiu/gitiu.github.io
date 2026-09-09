async page => {
  await page.goto('http://127.0.0.1:4173/tag.html');
  await page.locator('.gitiu-archive-year').first().waitFor();
  const results = [];
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900});
    await page.locator('input[type=search]').fill('看海');
    await page.getByRole('button',{name:'搜索',exact:true}).click();
    const matches = await page.locator('.lists:visible .listTitle').allTextContents();
    if (JSON.stringify(matches) !== JSON.stringify(['看海'])) throw Error('Click failed: '+matches);
    await page.locator('input[type=search]').fill('星河');
    await page.locator('input[type=search]').press('Enter');
    if (await page.locator('.lists:visible').count() !== 1) throw Error('Enter failed');
    await page.locator('input[type=search]').fill('不存在xyz');
    await page.getByRole('button',{name:'搜索',exact:true}).click();
    if (await page.locator('.lists:visible').count() || !await page.locator('.notFind').isVisible()) throw Error('Empty failed');
    await page.locator('#taglabel button').filter({hasText:'文章'}).click();
    if (await page.locator('.lists:visible').count() !== 5) throw Error('Filter failed');
    await page.locator('#taglabel button').filter({hasText:'全部'}).click();
    if (await page.locator('.lists:visible').count() !== 14) throw Error('Reset failed');
    const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
    if(overflow > 1) throw Error('Overflow '+width);
    await page.screenshot({path:`output/playwright/archive-${width}.png`,fullPage:true});
    results.push({width,click:true,enter:true,empty:true,filter:true,overflow});
  }
  await page.evaluate(()=>document.documentElement.dataset.colorMode='dark');
  await page.screenshot({path:'output/playwright/archive-dark.png',fullPage:true});
  return results;
}
