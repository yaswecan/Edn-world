import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
const systemChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({
 testDir:'./tests/visual',fullyParallel:false,workers:1,timeout:60000,
 outputDir:'test-results/lesson-visual',reporter:[['list'],['html',{outputFolder:'test-results/lesson-report',open:'never'}]],
 snapshotPathTemplate:'{testDir}/baselines/{platform}/{projectName}/{arg}{ext}',
 expect:{timeout:15000,toHaveScreenshot:{animations:'disabled',caret:'hide',scale:'css',maxDiffPixelRatio:0.002,threshold:0.15}},
 use:{baseURL:'http://127.0.0.1:4178',locale:'fr-FR',timezoneId:'Europe/Paris',colorScheme:'light',reducedMotion:'reduce',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||(existsSync(systemChrome)?systemChrome:undefined)}},
 projects:[{name:'desktop',use:{viewport:{width:1440,height:1050},deviceScaleFactor:1}},{name:'mobile',use:{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}}],
 webServer:{command:'node scripts/lesson-preview-server.mjs',url:'http://127.0.0.1:4178/lesson-demo.html',reuseExistingServer:false,timeout:15000}
});
