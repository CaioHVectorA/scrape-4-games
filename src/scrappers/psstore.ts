import puppeteer from 'puppeteer';
//@ts-ignore
import PCR from 'puppeteer-chromium-resolver'
import db from '../db'
import { normalizeTitle } from '../utils/normalize';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const scrapePSStore = async () => {
    console.log('Scrapping PS Store data!')
    const stats = await PCR()

    const browser = await stats.puppeteer.launch({
        headless: true,
        executablePath: stats.executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1024 });

    const prices = [];
    const store = 'PS Store';

    // PS Store Deals URL
    const url = 'https://store.playstation.com/pt-br/category/dc464929-edee-48a5-bcd3-1e6f5250ae80/1';

    try {
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Let page load
        await sleep(3000);

        // Fetch multiple pages
        for(let pageNum=1; pageNum<=3; pageNum++) {
            const data = await page.$$('li.psw-l-w-1\\/2\\@mobile-s');

            for (const item of data) {
                try {
                    const title = await item.$eval('.psw-t-body', (el: Element) => el.textContent?.trim()).catch(() => '');

                    const priceText = await item.$eval('.psw-m-r-3', (el: Element) => el.textContent).catch(() => '');
                    // Format: R$ 199,50
                    const price = Number(priceText?.replace(/\s/g, '').replace('R$', '').replace('.', '').replace(',', '.').trim()) || 0;

                    const percentageText = await item.$eval('.psw-c-bg-discount-badge', (el: Element) => el.textContent).catch(() => '');
                    const percentage = Number(percentageText?.replace('-', '').replace('%', '').trim()) || 0;

                    const linkPartial = await item.$eval('a', (el: any) => el.getAttribute('href')).catch(() => '');
                    const link = linkPartial ? `https://store.playstation.com${linkPartial}` : '';

                    const image = await item.$eval('img', (el: any) => el.src).catch(() => '');

                    const index = data.indexOf(item) + (pageNum-1)*24; // approx

                    if (title && price > 0) {
                        prices.push({ store, percentage, price, title, link, image, index })
                    }
                } catch (e) {
                    // Item might not have discount or standard price format
                }
            }

            // Try to go to next page
            try {
                const nextBtn = await page.$('button[data-qa="bottom-paginator-next-button"]');
                if (nextBtn) {
                    const isDisabled = await page.evaluate(btn => btn.hasAttribute('disabled'), nextBtn);
                    if(!isDisabled) {
                        await nextBtn.click();
                        await sleep(3000);
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            } catch(e) { break; }
        }
    } catch (e) {
        console.error("Error fetching PS Store:", e);
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

    console.log(`PS Store data scrapped! (${prices.length} items saved)`);
    return prices;
}

if (process.argv[2] == 'scrape') {
    scrapePSStore().then(data => console.log(data));
}
