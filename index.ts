import { scrape } from './src/scrappers/shopmk'
import { scrapeNuuvem } from './src/scrappers/nuuvem'
import { scrapePSStore } from './src/scrappers/psstore'
import { setupDatabase } from './src/db'
import db from './src/db'
import Elysia from 'elysia'
import { cors } from '@elysiajs/cors'
import { staticPlugin } from '@elysiajs/static'

// Grouping query: Returns each normalized title and a JSON array of all offers
const getGroupedGames = (searchQuery?: string, storeFilter?: string) => {
    let baseQuery = `
        SELECT
            normalized_title,
            json_group_array(
                json_object(
                    'id', id,
                    'store', store,
                    'title', title,
                    'price', price,
                    'percentage', percentage,
                    'link', link,
                    'image', image
                )
            ) as offers
        FROM prices
        WHERE 1=1
    `;

    const params: any[] = [];

    if (searchQuery) {
        const { normalizeTitle } = require('./src/utils/normalize');
        baseQuery += ` AND normalized_title LIKE ?`;
        params.push(`%${normalizeTitle(searchQuery)}%`);
    }

    if (storeFilter) {
        baseQuery += ` AND store = ?`;
        params.push(storeFilter);
    }

    baseQuery += ` GROUP BY normalized_title`;

    const results = db.prepare(baseQuery).all(...params) as any[];

    // Parse JSON arrays and find best price
    return results.map(row => {
        const offers = JSON.parse(row.offers);

        // Sort offers by price (lowest first)
        offers.sort((a: any, b: any) => a.price - b.price);

        return {
            normalized_title: row.normalized_title,
            best_price: offers[0].price,
            best_offer: offers[0],
            all_offers: offers,
            // Find the best image (first non-empty one)
            image: offers.find((o: any) => o.image)?.image || ''
        };
    }).sort((a, b) => a.best_price - b.best_price); // Sort all games by their best price
};

new Elysia()
.use(cors())
.use(staticPlugin({
    assets: 'frontend/dist',
    prefix: '/'
}))
.onStart(async () => {
    setupDatabase();

    // Helper to drop old entries
    const cleanOldEntries = () => {
        try {
            // Keep entries newer than 24h, though we'll just drop for simplicity since we re-scrape everything
            db.exec('DELETE FROM prices');
        } catch(e) {}
    };

    // Initial Scraping
    console.log("Starting initial scraping jobs...");
    await scrape().catch(e => console.error("MK Scrape Error", e));
    await scrapeNuuvem().catch(e => console.error("Nuuvem Scrape Error", e));
    await scrapePSStore().catch(e => console.error("PS Scrape Error", e));
    console.log("Initial scraping finished.");

    // Scrape every 12 hours
    setInterval(async () => {
        console.log("Running scheduled scraping jobs...");
        cleanOldEntries();
        await scrape().catch(e => console.error("MK Scrape Error", e));
        await scrapeNuuvem().catch(e => console.error("Nuuvem Scrape Error", e));
        await scrapePSStore().catch(e => console.error("PS Scrape Error", e));
    }, 12 * 60 * 60 * 1000);
})
.get('/api/games', ({ query }) => {
    return getGroupedGames(query?.search as string, query?.store as string);
})
.get('/api/stores', () => {
    const stores = db.prepare('SELECT DISTINCT store FROM prices').all() as {store: string}[];
    return stores.map(s => s.store);
})
.listen({ port: 3000 }, (server) => {
    console.log(`Server is running at ${server?.hostname}:${server?.port}`)
});
