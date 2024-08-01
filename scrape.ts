import puppeteer from 'puppeteer';
import { Database } from 'bun:sqlite'
const db = new Database('bun.sqlite')
//@ts-ignore
const runPromisesInSeries = (ps: (() => Promise<any>)[]) => ps.reduce((p, next) => p.then(next), Promise.resolve());
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Or import puppeteer from 'puppeteer-core';
export const scrape = async () => {
    console.log('Scrapping data!')
    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    // Navigate the page to a URL.
    await page.goto('https://mkgames2.lojavirtualnuvem.com.br/playstation-4/');
    const clickBtn = async () => {
        await page.waitForSelector('.js-load-more-btn');
        await page.click('.js-load-more-btn');
        await sleep(500)
    }
    // Set screen size.
    await page.setViewport({ width: 1080, height: 1024 });
    try {
        await runPromisesInSeries(Array(10).fill(clickBtn));
    } catch (e) { console.log(e) }

    const data = await page.$$('[data-product-id] .item .p-relative .item-info-container .item-info a')
    const prices = []
    for (const item of data) {
        const percentage = Number((await item.$eval('.js-offer-percentage', el => el.textContent))?.replace(/\s/g, ''))
        const price = Number((await item.$eval('.js-price-display', el => el.textContent))?.replace(/\s/g, '').replace('R$', '').replace(',', '.').trim())
        const title = await item.$eval('.js-item-name', el => el.textContent)
        const index = data.indexOf(item)
        prices.push({ percentage, price, title, index })
    }
    await browser.close()
    const filteredPrices = prices.filter(({ percentage, price }) => (percentage > 40 || price < 60)).sort((a, b) => {
        const sum_scales_a = ((a.percentage / 100)) * a.price - ((-Math.floor(data.length / 12) + Math.floor(a.index / 12)) * 1.5)
        const sum_scales_b = ((b.percentage / 100)) * b.price - ((-Math.floor(data.length / 12) + Math.floor(b.index / 12)) * 1.5)
        console.log({ sum_scales_a, sum_scales_b }, a.title, b.title)
        return sum_scales_b - sum_scales_a
    })

    db.exec('CREATE TABLE IF NOT EXISTS prices (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, price REAL, percentage REAL, position INTEGER)')
    filteredPrices.forEach(({ title, price, percentage, index }) => {
        const itemExists = db.prepare('SELECT * FROM prices WHERE title = ?').get(title)
        if (!itemExists) {
            db.prepare('INSERT INTO prices (title, price, percentage, position) VALUES (?, ?, ?, ?)').run(title, price, percentage, index)
        } else {
            db.prepare('UPDATE prices SET price = ?, percentage = ?, position = ? WHERE title = ?').run(price, percentage, index, title)
        } 
    })
}
if (process.argv[2] == 'scrape') {
    console.log(scrape())
}