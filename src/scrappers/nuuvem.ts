import puppeteer from 'puppeteer';
//@ts-ignore
import PCR from 'puppeteer-chromium-resolver'
import db from '../db'
import { normalizeTitle } from '../utils/normalize';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const scrapeNuuvem = async () => {
    console.log('Scrapping Nuuvem data!')
    const stats = await PCR()

    const browser = await stats.puppeteer.launch({
        headless: true,
        executablePath: stats.executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1024 });

    const prices = [];
    const store = 'Nuuvem';

    // Nuuvem PlayStation deals URL (example)
    // For specific PS pages, adjust the URL. Here we fetch the main PS catalog or general deals.
    // Assuming a search for "PlayStation" or navigating to their PS page
    const url = 'https://www.nuuvem.com/br-pt/catalog/platforms/playstation';

    try {
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Scroll slightly to trigger lazy loading if necessary
        for(let i=0; i<5; i++){
           await page.evaluate(() => window.scrollBy(0, 1000));
           await sleep(1000);
        }

        const data = await page.$$('.product-card--grid');

        for (const item of data) {
            try {
                const title = await item.$eval('.product-title', (el: Element) => el.textContent?.trim()).catch(() => '');

                const priceText = await item.$eval('.product-price--val', (el: Element) => el.textContent).catch(() => '0');
                const price = Number(priceText?.replace(/\s/g, '').replace('R$', '').replace(',', '.').trim()) || 0;

                const percentageText = await item.$eval('.product-discount', (el: Element) => el.textContent).catch(() => '0');
                const percentage = Number(percentageText?.replace('-', '').replace('%', '').trim()) || 0;

                const link = await item.$eval('.product-card--wrapper', (el: any) => el.href).catch(() => '');
                const image = await item.$eval('.product-img img', (el: any) => el.src).catch(() => '');

                const index = data.indexOf(item);

                if (title && price > 0) {
                    prices.push({ store, percentage, price, title, link, image, index })
                }
            } catch (e) {
                console.error("Error parsing Nuuvem item:", e);
            }
        }
    } catch (e) {
        console.error("Error fetching Nuuvem:", e);
    }

    await browser.close();

    const insertStmt = db.prepare('INSERT INTO prices (store, title, normalized_title, price, percentage, position, link, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const updateStmt = db.prepare('UPDATE prices SET price = ?, percentage = ?, position = ?, link = ?, image = ? WHERE store = ? AND title = ?');

    prices.forEach(({ store, title, price, percentage, link, image, index }) => {
        const normalized_title = normalizeTitle(title || '');
        const itemExists = db.prepare('SELECT * FROM prices WHERE store = ? AND title = ?').get(store, title);

        if (!itemExists) {
            insertStmt.run(store, title, normalized_title, price, percentage, index, link, image);
        } else {
            updateStmt.run(price, percentage, index, link, image, store, title);
        }
    });

    console.log(`Nuuvem data scrapped! (${prices.length} items saved)`);
    return prices;
}

if (process.argv[2] == 'scrape') {
    scrapeNuuvem().then(data => console.log(data));
}
