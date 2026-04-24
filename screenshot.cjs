#!/usr/bin/env node
/**
 * Screenshot Tool for Content Reworker
 * Usage: node screenshot.js [url] [output]
 *
 * Examples:
 *   node screenshot.js                          # Screenshots localhost:5000 to /tmp/app-screenshot.png
 *   node screenshot.js http://localhost:5000    # Same as above
 *   node screenshot.js http://localhost:5000 ./my-screenshot.png
 */

const puppeteer = require('puppeteer');
const path = require('path');

const DEFAULT_URL = 'http://localhost:5000';
const DEFAULT_OUTPUT = '/tmp/app-screenshot.png';

async function takeScreenshot(url = DEFAULT_URL, outputPath = DEFAULT_OUTPUT) {
  console.log(`Taking screenshot of ${url}...`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait a bit for any animations to settle
    await new Promise(resolve => setTimeout(resolve, 500));

    await page.screenshot({ path: outputPath, fullPage: false });
    console.log(`Screenshot saved to ${outputPath}`);

    return outputPath;
  } finally {
    await browser.close();
  }
}

// CLI execution
const args = process.argv.slice(2);
const url = args[0] || DEFAULT_URL;
const output = args[1] || DEFAULT_OUTPUT;

takeScreenshot(url, output).catch(err => {
  console.error('Screenshot failed:', err.message);
  process.exit(1);
});
