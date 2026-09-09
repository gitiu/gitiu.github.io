async page => {
  const results=[];
  await page.evaluate(()=>localStorage.setItem('meek_theme','light'));
  await page.route('**/favicon.ico',route=>route.abort());
  for (const route of ['index.html','tag.html','talk.html','link.html','about.html','post/1.html','post/12.html']) {
    await page.goto('http://127.0.0.1:4173/'+route);
    await page.locator('.gitiu-control:visible').first().waitFor();
    if(route==='tag.html') await page.locator('#taglabel .gitiu-control').first().waitFor();
    for (const width of [320,390,1440]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const sample=await page.locator('.gitiu-control').evaluateAll(els=>els.filter(el=>el.getBoundingClientRect().width && !el.closest('.lb-lightbox-overlay:not(.active)') && !el.closest('details:not([open])') && getComputedStyle(el).visibility!=='hidden').map(el=>({name:el.getAttribute('aria-label')||el.textContent.trim(),height:el.getBoundingClientRect().height,radius:getComputedStyle(el).borderRadius})));
      if(sample.some(el=>el.height<44 || el.radius!=='11px')) throw Error(JSON.stringify({route,width,sample}));
      if(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1)) throw Error('Overflow '+route+width);
      if([390,1440].includes(width) && !route.startsWith('post/')) await page.screenshot({path:`output/playwright/buttons-${route.replace('.html','')}-${width}.png`,fullPage:true});
      results.push({route,width,controls:sample.length});
    }
    if(route==='post/1.html') {
      const toc=page.locator('.toc-icon');
      await toc.focus(); await page.keyboard.press('Enter');
      await page.getByRole('button',{name:'收起目录',exact:true}).waitFor();
      if(await toc.getAttribute('aria-expanded')!=='true') throw Error('TOC not expanded');
      await page.keyboard.press('Escape');
      if(await page.getByRole('button',{name:'文章目录',exact:true}).getAttribute('aria-expanded')!=='false') throw Error('TOC not closed');
      await page.evaluate(()=>document.execCommand=()=>true);
      await page.getByRole('button',{name:'复制代码',exact:true}).first().focus();
      await page.keyboard.press('Enter');
      if(!await page.locator('.copy-feedback').first().isVisible()) throw Error('Code copy keyboard failed');
    }
    if(route==='post/12.html') {
      await page.locator('#postBody img').first().click();
      await page.getByRole('button',{name:'关闭图片',exact:true}).click();
      if(await page.locator('.gitiu-viewer').getAttribute('open') !== null) throw Error('Viewer not closed');
    }
  }
  await page.goto('http://127.0.0.1:4173/index.html');
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'切换主题',exact:true}).focus();
  await page.keyboard.press('Space');
  if(await page.evaluate(()=>document.documentElement.dataset.colorMode)!=='dark') throw Error('Theme keyboard failed');
  await page.screenshot({path:'output/playwright/buttons-dark-focus.png',fullPage:true});
  await page.unroute('**/favicon.ico');
  return {results,tocKeyboard:true,copyKeyboard:true,viewerClose:true,themeKeyboard:true};
}
