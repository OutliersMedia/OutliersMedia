const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ defaultViewport: { width: 1280, height: 800 }});
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5175', { waitUntil: 'domcontentloaded' }).catch(e => console.log(e));
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'screenshot_final.png', fullPage: true });
  await browser.close();
})();
