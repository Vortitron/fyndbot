import Database from 'better-sqlite3';
import { config } from '../config.js';
import type { User, Watch, Follow } from '../types/index.js';

let db: Database.Database;

export function initDatabase(): void {
	const isPostgres = config.databaseUrl.startsWith('postgresql://');
	
	if (isPostgres) {
		throw new Error('Postgres support not yet implemented. Use SQLite for MVP.');
	}

	db = new Database(config.databaseUrl);
	db.pragma('journal_mode = WAL');
	
	createTables();
}

function createTables(): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			telegram_id INTEGER UNIQUE NOT NULL,
			username TEXT,
			is_pro INTEGER DEFAULT 0,
			inspect_count INTEGER DEFAULT 0,
			inspect_reset_at INTEGER NOT NULL,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS watches (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			url TEXT NOT NULL,
			name TEXT,
			last_checked INTEGER NOT NULL,
			created_at INTEGER NOT NULL,
			active INTEGER DEFAULT 1,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS follows (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			seller_url TEXT NOT NULL,
			seller_name TEXT,
			last_checked INTEGER NOT NULL,
			created_at INTEGER NOT NULL,
			active INTEGER DEFAULT 1,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS seen_listings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			watch_id INTEGER NOT NULL,
			listing_id TEXT NOT NULL,
			seen_at INTEGER NOT NULL,
			FOREIGN KEY (watch_id) REFERENCES watches(id) ON DELETE CASCADE,
			UNIQUE(watch_id, listing_id)
		);

		CREATE TABLE IF NOT EXISTS follow_listings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			follow_id INTEGER NOT NULL,
			listing_id TEXT NOT NULL,
			seen_at INTEGER NOT NULL,
			disappeared_at INTEGER,
			FOREIGN KEY (follow_id) REFERENCES follows(id) ON DELETE CASCADE,
			UNIQUE(follow_id, listing_id)
		);

		CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
		CREATE INDEX IF NOT EXISTS idx_watches_user_id ON watches(user_id);
		CREATE INDEX IF NOT EXISTS idx_watches_active ON watches(active);
		CREATE INDEX IF NOT EXISTS idx_follows_user_id ON follows(user_id);
		CREATE INDEX IF NOT EXISTS idx_follows_active ON follows(active);
		CREATE INDEX IF NOT EXISTS idx_seen_listings_watch_id ON seen_listings(watch_id);
		CREATE INDEX IF NOT EXISTS idx_follow_listings_follow_id ON follow_listings(follow_id);
		CREATE INDEX IF NOT EXISTS idx_follow_listings_disappeared ON follow_listings(disappeared_at);
	`);
}

export function getOrCreateUser(telegramId: number, username: string | null): User {
	const existing = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as any;
	
	if (existing) {
		return {
			id: existing.id,
			telegramId: existing.telegram_id,
			username: existing.username,
			isPro: existing.is_pro === 1,
			inspectCount: existing.inspect_count,
			inspectResetAt: new Date(existing.inspect_reset_at),
			createdAt: new Date(existing.created_at),
		};
	}

	const now = Date.now();
	const nextWeek = now + 7 * 24 * 60 * 60 * 1000;
	
	const result = db.prepare(`
		INSERT INTO users (telegram_id, username, inspect_reset_at, created_at)
		VALUES (?, ?, ?, ?)
	`).run(telegramId, username, nextWeek, now);

	return {
		id: result.lastInsertRowid as number,
		telegramId,
		username,
		isPro: false,
		inspectCount: 0,
		inspectResetAt: new Date(nextWeek),
		createdAt: new Date(now),
	};
}

export function getUserByTelegramId(telegramId: number): User | null {
	const row = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as any;
	
	if (!row) return null;

	return {
		id: row.id,
		telegramId: row.telegram_id,
		username: row.username,
		isPro: row.is_pro === 1,
		inspectCount: row.inspect_count,
		inspectResetAt: new Date(row.inspect_reset_at),
		createdAt: new Date(row.created_at),
	};
}

export function createWatch(userId: number, url: string, name: string | null): Watch {
	const now = Date.now();
	
	const result = db.prepare(`
		INSERT INTO watches (user_id, url, name, last_checked, created_at)
		VALUES (?, ?, ?, ?, ?)
	`).run(userId, url, name, now, now);

	return {
		id: result.lastInsertRowid as number,
		userId,
		url,
		name,
		lastChecked: new Date(now),
		createdAt: new Date(now),
		active: true,
	};
}

export function getWatchesByUserId(userId: number): Watch[] {
	const rows = db.prepare('SELECT * FROM watches WHERE user_id = ? AND active = 1 ORDER BY created_at DESC').all(userId) as any[];
	
	return rows.map(row => ({
		id: row.id,
		userId: row.user_id,
		url: row.url,
		name: row.name,
		lastChecked: new Date(row.last_checked),
		createdAt: new Date(row.created_at),
		active: row.active === 1,
	}));
}

export function getAllActiveWatches(): Watch[] {
	const rows = db.prepare('SELECT * FROM watches WHERE active = 1').all() as any[];
	
	return rows.map(row => ({
		id: row.id,
		userId: row.user_id,
		url: row.url,
		name: row.name,
		lastChecked: new Date(row.last_checked),
		createdAt: new Date(row.created_at),
		active: row.active === 1,
	}));
}

export function deleteWatch(id: number, userId: number): boolean {
	const result = db.prepare('UPDATE watches SET active = 0 WHERE id = ? AND user_id = ?').run(id, userId);
	return result.changes > 0;
}

export function updateWatchLastChecked(id: number): void {
	db.prepare('UPDATE watches SET last_checked = ? WHERE id = ?').run(Date.now(), id);
}

export function isListingSeen(watchId: number, listingId: string): boolean {
	const row = db.prepare('SELECT 1 FROM seen_listings WHERE watch_id = ? AND listing_id = ?').get(watchId, listingId);
	return !!row;
}

export function markListingSeen(watchId: number, listingId: string): void {
	db.prepare('INSERT OR IGNORE INTO seen_listings (watch_id, listing_id, seen_at) VALUES (?, ?, ?)').run(watchId, listingId, Date.now());
}

export function incrementInspectCount(userId: number): void {
	db.prepare('UPDATE users SET inspect_count = inspect_count + 1 WHERE id = ?').run(userId);
}

export function resetInspectCount(userId: number): void {
	const nextWeek = Date.now() + 7 * 24 * 60 * 60 * 1000;
	db.prepare('UPDATE users SET inspect_count = 0, inspect_reset_at = ? WHERE id = ?').run(nextWeek, userId);
}

export function createFollow(userId: number, sellerUrl: string, sellerName: string | null): Follow {
	const now = Date.now();
	
	const result = db.prepare(`
		INSERT INTO follows (user_id, seller_url, seller_name, last_checked, created_at)
		VALUES (?, ?, ?, ?, ?)
	`).run(userId, sellerUrl, sellerName, now, now);

	return {
		id: result.lastInsertRowid as number,
		userId,
		sellerUrl,
		sellerName,
		lastChecked: new Date(now),
		createdAt: new Date(now),
		active: true,
	};
}

export function getFollowsByUserId(userId: number): Follow[] {
	const rows = db.prepare('SELECT * FROM follows WHERE user_id = ? AND active = 1 ORDER BY created_at DESC').all(userId) as any[];
	
	return rows.map(row => ({
		id: row.id,
		userId: row.user_id,
		sellerUrl: row.seller_url,
		sellerName: row.seller_name,
		lastChecked: new Date(row.last_checked),
		createdAt: new Date(row.created_at),
		active: row.active === 1,
	}));
}

export function getAllActiveFollows(): Follow[] {
	const rows = db.prepare('SELECT * FROM follows WHERE active = 1').all() as any[];
	
	return rows.map(row => ({
		id: row.id,
		userId: row.user_id,
		sellerUrl: row.seller_url,
		sellerName: row.seller_name,
		lastChecked: new Date(row.last_checked),
		createdAt: new Date(row.created_at),
		active: row.active === 1,
	}));
}

export function deleteFollow(id: number, userId: number): boolean {
	const result = db.prepare('UPDATE follows SET active = 0 WHERE id = ? AND user_id = ?').run(id, userId);
	return result.changes > 0;
}

export function updateFollowLastChecked(id: number): void {
	db.prepare('UPDATE follows SET last_checked = ? WHERE id = ?').run(Date.now(), id);
}

export function getFollowListings(followId: number): string[] {
	const rows = db.prepare('SELECT listing_id FROM follow_listings WHERE follow_id = ? AND disappeared_at IS NULL').all(followId) as any[];
	return rows.map(row => row.listing_id);
}

export function markFollowListingSeen(followId: number, listingId: string): void {
	db.prepare('INSERT OR IGNORE INTO follow_listings (follow_id, listing_id, seen_at) VALUES (?, ?, ?)').run(followId, listingId, Date.now());
}

export function markFollowListingDisappeared(followId: number, listingId: string): void {
	db.prepare('UPDATE follow_listings SET disappeared_at = ? WHERE follow_id = ? AND listing_id = ? AND disappeared_at IS NULL').run(Date.now(), followId, listingId);
}

export function closeDatabase(): void {
	if (db) {
		db.close();
	}
}
