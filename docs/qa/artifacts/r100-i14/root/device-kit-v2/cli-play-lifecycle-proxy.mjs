/** Test-only transparent Playwright observer; the exported CLI remains byte unchanged. */
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium: actual} = await import(pathToFileURL(path.join(process.env.I14_CLI_KIT, '.i14-runtime/node_modules/playwright/index.mjs')));
const report = {scope: 'Original --play CLI, real Chrome, formal MainMenu, then programmatic close of its only page. No departure, no human play, no native title-bar click.', events: []};
const save = () => fs.writeFileSync(process.env.I14_CLI_OBSERVATION, JSON.stringify(report, null, 2) + '\n');
const event = (type, detail = {}) => {report.events.push({type, at: new Date().toISOString(), ...detail}); save();};
export const chromium = {async launch(options) {
  const browser = await actual.launch(options);
  event('launched', {version: browser.version()});
  browser.on('disconnected', () => event('disconnected'));
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...args) => {
    const context = await newContext(...args);
    const newPage = context.newPage.bind(context);
    context.newPage = async (...pageArgs) => {
      const page = await newPage(...pageArgs);
      page.on('pageerror', error => event('pageerror', {message: String(error)}));
      void (async () => {
        try {
          await page.waitForFunction(() => Boolean(window.__game?.scene.getScene('MainMenuScene')), null, {timeout: 20000});
          await page.waitForTimeout(1000);
          if (await page.evaluate(() => window.__game.scene.isPaused('MainMenuScene'))) await page.keyboard.press('Enter');
          await page.waitForFunction(() => window.__game.scene.getScene('MainMenuScene').interactive());
          event('menu', {url: page.url(), state: await page.evaluate(() => ({interactive: window.__game.scene.getScene('MainMenuScene').interactive(), currentSave: localStorage.getItem('coh-save-v1'), webgl: Boolean(window.__game.renderer.gl)}))});
          await page.close();
          event('only-page-closed');
        } catch (error) {event('observer-error', {message: String(error.stack ?? error)});}
      })();
      return page;
    };
    return context;
  };
  return browser;
}};
