async originalPage => {
  const page=await originalPage.context().newPage();
  await page.goto('http://127.0.0.1:4173/');
  await page.addInitScript(()=>{
    window.themePaint=[];
    const sample=()=>{
      if(document.documentElement){
        const color=getComputedStyle(document.documentElement).backgroundColor;
        if(window.themePaint.at(-1)!==color)window.themePaint.push(color);
      }
      if(performance.now()<3000)requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  // Deliberately delay the main script, exposing a wrong first-paint theme.
  await page.route('**/gitiu-bento.js*',async route=>{await page.waitForTimeout(700);await route.continue();});
  const results=[];
  for(const [mode,system] of [['light','light'],['dark','dark'],['auto','dark'],['auto','light']]){
    await page.evaluate(mode=>localStorage.setItem('meek_theme',mode),mode);
    await page.emulateMedia({colorScheme:system});
    await page.goto('http://127.0.0.1:4173/talk.html');
    for(const step of ['timeline','article','home']){
      if(step==='article')await page.locator('.gitiu-talk-item').first().click();
      if(step==='home')await page.locator('#buttonHome').click();
      await page.waitForFunction(()=>document.querySelector('.gitiu-control'));
      await page.waitForFunction(()=>window.themePaint.length>0);
      const colors=await page.evaluate(()=>window.themePaint);
      const expected=mode==='dark'||(mode==='auto'&&system==='dark')?'rgb(28, 30, 34)':'rgb(246, 245, 241)';
      if(colors.some(color=>color!==expected))throw Error(JSON.stringify({mode,system,step,colors,expected}));
      results.push({mode,system,step,colors});
    }
  }
  await page.close();
  return results;
}
