import puppeteer from 'puppeteer'
import { scrape } from './scrape'
import { Database } from 'bun:sqlite'
import Elysia from 'elysia'
const db = new Database('bun.sqlite')

new Elysia()
.onStart(async () => {
    db.exec(`DROP TABLE prices`)
    db.exec('CREATE TABLE IF NOT EXISTS prices (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, price REAL, percentage REAL, position INTEGER)')
    await scrape()
})
.get('/', async () => {
    return db.prepare('SELECT * FROM prices').all()
})
.listen({ port: 3000 })