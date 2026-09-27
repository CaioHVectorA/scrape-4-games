import puppeteer from 'puppeteer';
//@ts-ignore
import PCR from 'puppeteer-chromium-resolver'
import db from '../db'
import { normalizeTitle } from '../utils/normalize';

//@ts-ignore
const runPromisesInSeries = (ps: (() => Promise<any>)[]) => ps.reduce((p, next) => p.then(next), Promise.resolve());
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const scrape = async () => {
    console.log('Scrapping MK Games data!')
    const stats = await PCR()

    // Launch the browser and open a new blank page
    const browser = await stats.puppeteer.launch({
        headless: true,
        executablePath: stats.executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    // Navigate the page to a URL.
    await page.goto('https://mkgames2.lojavirtualnuvem.com.br/playstation-4/');
    const clickBtn = async () => {
        try {
            await page.waitForSelector('.js-load-more-btn', { timeout: 2000 });
            await page.click('.js-load-more-btn');
            await sleep(500)
        } catch (e) {
            // Button might not exist anymore
        }
    }
    // Set screen size.
    await page.setViewport({ width: 1080, height: 1024 });
    try {
        await runPromisesInSeries(Array(10).fill(clickBtn));
    } catch (e) { console.log(e) }

    const data = await page.$$('[data-product-id] .item')
    const prices = []
    const store = 'MK Games'

    for (const item of data) {
        try {
            const percentageText = await item.$eval('.js-offer-percentage', (el: Element) => el.textContent).catch(() => '0');
            const percentage = Number(percentageText?.replace(/\s/g, '')) || 0;

            const priceText = await item.$eval('.js-price-display', (el: Element) => el.textContent).catch(() => '0');
            const price = Number(priceText?.replace(/\s/g, '').replace('R$', '').replace(',', '.').trim()) || 0;

            const title = await item.$eval('.js-item-name', (el: Element) => el.textContent).catch(() => '');

            let link = '';
            try {
                link = await item.$eval('a', (el: any) => el.href);
            } catch (e) {}

            let image = '';
            try {
                image = await item.$eval('img', (el: any) => el.src || el.getAttribute('data-src'));
            } catch (e) {}

            const index = data.indexOf(item)

            if (title && price > 0) {
                prices.push({ store, percentage, price, title, link, image, index })
            }
        } catch (e) {
            console.error("Error parsing item in MK Games:", e);
        }
    }
    await browser.close()

    const filteredPrices = prices.filter(({ percentage, price }) => (percentage > 40 || price < 60)).sort((a, b) => {
        const sum_scales_a = ((a.percentage / 100)) * a.price - ((-Math.floor(data.length / 12) + Math.floor(a.index / 12)) * 1.5)
        const sum_scales_b = ((b.percentage / 100)) * b.price - ((-Math.floor(data.length / 12) + Math.floor(b.index / 12)) * 1.5)
        return sum_scales_b - sum_scales_a
    })

    const insertStmt = db.prepare('INSERT INTO prices (store, title, normalized_title, price, percentage, position, link, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const updateStmt = db.prepare('UPDATE prices SET price = ?, percentage = ?, position = ?, link = ?, image = ? WHERE store = ? AND title = ?');

    filteredPrices.forEach(({ store, title, price, percentage, link, image, index }) => {
        const normalized_title = normalizeTitle(title || '');
        const itemExists = db.prepare('SELECT * FROM prices WHERE store = ? AND title = ?').get(store, title);

        if (!itemExists) {
            insertStmt.run(store, title, normalized_title, price, percentage, index, link, image);
        } else {
            updateStmt.run(price, percentage, index, link, image, store, title);
        }
    })

    console.log(`MK Games data scrapped! (${filteredPrices.length} items saved)`)
    return filteredPrices
}

if (process.argv[2] == 'scrape') {
    scrape().then(data => console.log(data));
}
