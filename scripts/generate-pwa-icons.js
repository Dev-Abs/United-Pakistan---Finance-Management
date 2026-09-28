const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  });
  const page = await browser.newPage();
  const svg = fs.readFileSync(path.join('public', 'icon.svg')).toString('base64');

  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}img{display:block;width:100%;height:100%}</style><img src="data:image/svg+xml;base64,${svg}">`);
    await page.locator('img').screenshot({
      path: path.join('public', `icon-${size}.png`),
      omitBackground: true,
    });
  }

  await browser.close();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
