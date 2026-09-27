import { Database } from 'bun:sqlite'

const db = new Database('bun.sqlite')

export const setupDatabase = () => {
    // Drop old table to recreate with new schema
    try {
        db.exec(`DROP TABLE IF EXISTS prices`);
    } catch (e) {
        console.error("Error dropping table:", e);
    }

    db.exec(`
        CREATE TABLE IF NOT EXISTS prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store TEXT,
            title TEXT,
            normalized_title TEXT,
            price REAL,
            percentage REAL,
            position INTEGER,
            link TEXT,
            image TEXT
        )
    `);
}

export default db;
