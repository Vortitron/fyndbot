import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config.js';
import * as db from '../database/index.js';
import { fetchBlocketSearch, fetchBlocketAd, extractRegistrationNumber } from '../blocket/fetcher.js';
import { scoreListing } from '../scorer/index.js';
import { enrichVehicleData } from '../enrichment/transportstyrelsen.js';
import type { BlocketListing } from '../types/index.js';

export function createBot(): TelegramBot {
	const bot = new TelegramBot(config.telegramBotToken, { polling: true });

	bot.onText(/\/start/, async (msg) => {
		const chatId = msg.chat.id;
		const telegramId = msg.from!.id;
		const username = msg.from!.username || null;

		db.getOrCreateUser(telegramId, username);

		await bot.sendMessage(chatId, 
`Välkommen till Fyndbot! 🇸🇪

I help you find bargains on Blocket.se with instant alerts.

*Commands:*
/watch <url> — Watch a Blocket search
/list — Show your watches
/unwatch <id> — Stop watching
/inspect <url> — Analyse a listing (Pro feature)
/pro — View subscription status
/help — Show this help

*Example:*
\`/watch https://www.blocket.se/annonser/hela_sverige/fordon/bilar\`

Start watching now!`, 
			{ parse_mode: 'Markdown' }
		);
	});

	bot.onText(/\/help/, async (msg) => {
		const chatId = msg.chat.id;
		
		await bot.sendMessage(chatId,
`*Fyndbot Commands*

/watch <url> — Start watching a Blocket search
/list — List all your active watches
/unwatch <id> — Stop watching (use ID from /list)
/inspect <url> — Deep analysis of a listing
/pro — View Pro subscription details
/help — Show this message

*Pro Features:*
• AI bargain scoring on every alert
• Unlimited inspections
• Vehicle besiktning/tax data
• 79 SEK/month

Free tier: 3 inspections per week`,
			{ parse_mode: 'Markdown' }
		);
	});

	bot.onText(/\/watch(?:\s+(.+))?/, async (msg, match) => {
		const chatId = msg.chat.id;
		const telegramId = msg.from!.id;
		const username = msg.from!.username || null;

		if (msg.text === '/watch') {
			await bot.sendMessage(chatId, 'Usage: `/watch <blocket_url>`\n\nExample:\n`/watch https://www.blocket.se/annonser/stockholm/bostad`', { parse_mode: 'Markdown' });
			return;
		}

		const url = match?.[1]?.trim();
		
		if (!url) {
			await bot.sendMessage(chatId, 'Please provide a Blocket URL.');
			return;
		}

		if (!url.includes('blocket.se')) {
			await bot.sendMessage(chatId, 'Please provide a valid Blocket.se URL.');
			return;
		}

		const user = db.getOrCreateUser(telegramId, username);
		const existingWatches = db.getWatchesByUserId(user.id);

		if (existingWatches.length >= 10) {
			await bot.sendMessage(chatId, 'You have reached the maximum of 10 watches. Use /unwatch to remove one first.');
			return;
		}

		const watch = db.createWatch(user.id, url, null);

		await bot.sendMessage(chatId, 
			`✅ Now watching!\n\nWatch ID: ${watch.id}\n\nYou'll be notified when new listings appear.\n\nUse /list to see all watches.`
		);
	});

	bot.onText(/\/list/, async (msg) => {
		const chatId = msg.chat.id;
		const telegramId = msg.from!.id;

		const user = db.getUserByTelegramId(telegramId);
		
		if (!user) {
			await bot.sendMessage(chatId, 'Use /start first to register.');
			return;
		}

		const watches = db.getWatchesByUserId(user.id);

		if (watches.length === 0) {
			await bot.sendMessage(chatId, 'No active watches. Use /watch <url> to add one!');
			return;
		}

		let message = '*Your watches:*\n\n';
		for (const watch of watches) {
			const shortUrl = watch.url.length > 50 
				? watch.url.substring(0, 47) + '...'
				: watch.url;
			message += `${watch.id}. ${shortUrl}\n`;
		}
		message += `\nUse \`/unwatch <id>\` to stop watching.`;

		await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
	});

	bot.onText(/\/unwatch(?:\s+(\d+))?/, async (msg, match) => {
		const chatId = msg.chat.id;
		const telegramId = msg.from!.id;

		if (msg.text === '/unwatch') {
			await bot.sendMessage(chatId, 'Usage: `/unwatch <id>`\n\nGet IDs from /list', { parse_mode: 'Markdown' });
			return;
		}

		const watchIdStr = match?.[1];
		
		if (!watchIdStr) {
			await bot.sendMessage(chatId, 'Please provide a watch ID. Use /list to see your watches.');
			return;
		}

		const watchId = parseInt(watchIdStr, 10);
		const user = db.getUserByTelegramId(telegramId);

		if (!user) {
			await bot.sendMessage(chatId, 'User not found. Use /start first.');
			return;
		}

		const deleted = db.deleteWatch(watchId, user.id);

		if (deleted) {
			await bot.sendMessage(chatId, `✅ Watch ${watchId} removed.`);
		} else {
			await bot.sendMessage(chatId, `Watch ${watchId} not found or doesn't belong to you.`);
		}
	});

	bot.onText(/\/inspect(?:\s+(.+))?/, async (msg, match) => {
		const chatId = msg.chat.id;
		const telegramId = msg.from!.id;
		const username = msg.from!.username || null;

		if (msg.text === '/inspect') {
			await bot.sendMessage(chatId, 'Usage: `/inspect <blocket_ad_url>`', { parse_mode: 'Markdown' });
			return;
		}

		const url = match?.[1]?.trim();
		
		if (!url || !url.includes('blocket.se/annons/')) {
			await bot.sendMessage(chatId, 'Please provide a valid Blocket ad URL.');
			return;
		}

		const user = db.getOrCreateUser(telegramId, username);

		if (Date.now() > user.inspectResetAt.getTime()) {
			db.resetInspectCount(user.id);
			user.inspectCount = 0;
		}

		if (!user.isPro && user.inspectCount >= config.freeInspectWeeklyLimit) {
			await bot.sendMessage(chatId, 
				`You've used all ${config.freeInspectWeeklyLimit} free inspections this week.\n\nUpgrade to Pro for unlimited inspections!\n\nUse /pro for details.`
			);
			return;
		}

		await bot.sendMessage(chatId, '🔍 Inspecting listing...');

		const listing = await fetchBlocketAd(url);

		if (!listing) {
			await bot.sendMessage(chatId, '❌ Could not fetch listing. Check the URL and try again.');
			return;
		}

		db.incrementInspectCount(user.id);

		const score = await scoreListing(listing);

		let message = `*Inspection Report*\n\n`;
		message += `📋 ${listing.title}\n`;
		message += `💰 ${listing.price ? listing.price + ' ' + listing.currency : 'Price not specified'}\n`;
		message += `📍 ${listing.location || 'Location unknown'}\n`;
		message += `\n*Bargain Score:* ${score.score}/10\n`;
		message += `💡 ${score.reason}\n`;

		const regNr = extractRegistrationNumber(listing.title + ' ' + (listing.description || ''));
		if (regNr) {
			const vehicleData = await enrichVehicleData(regNr);
			if (vehicleData) {
				message += `\n*Vehicle Info (${regNr}):*\n`;
				if (vehicleData.make && vehicleData.model) {
					message += `🚗 ${vehicleData.make} ${vehicleData.model} (${vehicleData.year})\n`;
				}
				if (vehicleData.monthsUntilInspection !== null) {
					message += `🔧 Besiktning: ${vehicleData.monthsUntilInspection} months\n`;
				}
				if (vehicleData.monthsUntilTax !== null) {
					message += `💳 Tax: ${vehicleData.monthsUntilTax} months\n`;
				}
			}
		}

		message += `\n🔗 ${listing.url}`;

		const remaining = user.isPro ? '∞' : (config.freeInspectWeeklyLimit - user.inspectCount - 1).toString();
		message += `\n\n_Inspections remaining: ${remaining}_`;

		await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
	});

	bot.onText(/\/pro/, async (msg) => {
		const chatId = msg.chat.id;
		const telegramId = msg.from!.id;

		const user = db.getUserByTelegramId(telegramId);

		if (!user) {
			await bot.sendMessage(chatId, 'Use /start first to register.');
			return;
		}

		if (user.isPro) {
			await bot.sendMessage(chatId, 
				`✨ You're a Pro subscriber!\n\n• AI bargain scores on alerts\n• Unlimited inspections\n• Vehicle data enrichment\n\nThank you for your support!`
			);
		} else {
			await bot.sendMessage(chatId,
				`*Fyndbot Pro* ✨\n\n` +
				`*Benefits:*\n` +
				`• AI bargain score (1-10) on every alert\n` +
				`• Unlimited /inspect commands\n` +
				`• Vehicle besiktning/tax data\n` +
				`• Priority support\n\n` +
				`*Price:* ${config.priceProMonthly} SEK/month\n\n` +
				`_Payment integration coming soon. Contact @vome_io for early access._`,
				{ parse_mode: 'Markdown' }
			);
		}
	});

	bot.on('polling_error', (error) => {
		console.error('Telegram polling error:', error);
	});

	return bot;
}

export async function sendAlert(bot: TelegramBot, userId: number, listing: BlocketListing, isPro: boolean): Promise<void> {
	try {
		const user = await db.getUserByTelegramId(userId);
		if (!user) return;

		let message = `🔔 *New Listing!*\n\n`;
		message += `📋 ${listing.title}\n`;
		message += `💰 ${listing.price ? listing.price + ' ' + listing.currency : 'Price not specified'}\n`;
		
		if (listing.location) {
			message += `📍 ${listing.location}\n`;
		}

		if (isPro) {
			const score = await scoreListing(listing);
			message += `\n⭐ *Bargain Score:* ${score.score}/10\n`;
			message += `💡 ${score.reason}\n`;
		}

		message += `\n🔗 ${listing.url}`;

		if (listing.imageUrl) {
			await bot.sendPhoto(user.telegramId, listing.imageUrl, {
				caption: message,
				parse_mode: 'Markdown',
			});
		} else {
			await bot.sendMessage(user.telegramId, message, { parse_mode: 'Markdown' });
		}
	} catch (error) {
		console.error('Error sending alert:', error);
	}
}
