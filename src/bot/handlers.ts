import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config.js';
import * as db from '../database/index.js';
import { fetchBlocketSearch, fetchBlocketAd, extractRegistrationNumber, extractSellerFromUrl } from '../blocket/fetcher.js';
import { scoreListing } from '../scorer/index.js';
import { enrichVehicleData } from '../enrichment/transportstyrelsen.js';
import { createCheckoutSession } from '../stripe/index.js';
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
/follow <url> — Follow a Blocket seller
/list — Show your watches and follows
/unwatch <id> — Stop watching
/unfollow <id> — Stop following
/inspect <url> — Analyse a listing (Pro feature)
/pro — View subscription status
/help — Show this help

*Example:*
\`/watch https://www.blocket.se/annonser/hela_sverige/fordon/bilar\`
\`/follow https://www.blocket.se/annonsorer/seller-name\`

Start watching now!`, 
			{ parse_mode: 'Markdown' }
		);
	});

	bot.onText(/\/help/, async (msg) => {
		const chatId = msg.chat.id;
		
		await bot.sendMessage(chatId,
`*Fyndbot Commands*

/watch <url> — Start watching a Blocket search
/follow <url> — Follow a Blocket seller
/list — List all your active watches and follows
/unwatch <id> — Stop watching (use ID from /list)
/unfollow <id> — Stop following (use ID from /list)
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
		const follows = db.getFollowsByUserId(user.id);

		if (watches.length === 0 && follows.length === 0) {
			await bot.sendMessage(chatId, 'No active watches or follows.\n\nUse /watch <url> to watch searches.\nUse /follow <url> to follow sellers.');
			return;
		}

		let message = '';

		if (watches.length > 0) {
			message += '*Watches:*\n';
			for (const watch of watches) {
				const shortUrl = watch.url.length > 50 
					? watch.url.substring(0, 47) + '...'
					: watch.url;
				message += `W${watch.id}. ${shortUrl}\n`;
			}
			message += '\n';
		}

		if (follows.length > 0) {
			message += '*Follows:*\n';
			for (const follow of follows) {
				const displayName = follow.sellerName || 'Unknown seller';
				message += `F${follow.id}. ${displayName}\n`;
			}
			message += '\n';
		}

		message += 'Use `/unwatch W<id>` or `/unfollow F<id>` to stop.';

		await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
	});

	bot.onText(/\/unwatch(?:\s+(.+))?/, async (msg, match) => {
		const chatId = msg.chat.id;
		const telegramId = msg.from!.id;

		if (msg.text === '/unwatch') {
			await bot.sendMessage(chatId, 'Usage: `/unwatch W<id>`\n\nGet IDs from /list', { parse_mode: 'Markdown' });
			return;
		}

		const watchIdStr = match?.[1]?.trim();
		
		if (!watchIdStr) {
			await bot.sendMessage(chatId, 'Please provide a watch ID. Use /list to see your watches.');
			return;
		}

		const cleanId = watchIdStr.replace(/^W/i, '');
		const watchId = parseInt(cleanId, 10);

		if (isNaN(watchId)) {
			await bot.sendMessage(chatId, 'Invalid watch ID. Use format W<number> (e.g., W1).');
			return;
		}

		const user = db.getUserByTelegramId(telegramId);

		if (!user) {
			await bot.sendMessage(chatId, 'User not found. Use /start first.');
			return;
		}

		const deleted = db.deleteWatch(watchId, user.id);

		if (deleted) {
			await bot.sendMessage(chatId, `✅ Watch W${watchId} removed.`);
		} else {
			await bot.sendMessage(chatId, `Watch W${watchId} not found or doesn't belong to you.`);
		}
	});

	bot.onText(/\/follow(?:\s+(.+))?/, async (msg, match) => {
		const chatId = msg.chat.id;
		const telegramId = msg.from!.id;
		const username = msg.from!.username || null;

		if (msg.text === '/follow') {
			await bot.sendMessage(chatId, 'Usage: `/follow <blocket_seller_url>`\n\nExample:\n`/follow https://www.blocket.se/annonsorer/seller-name`', { parse_mode: 'Markdown' });
			return;
		}

		const url = match?.[1]?.trim();
		
		if (!url) {
			await bot.sendMessage(chatId, 'Please provide a Blocket seller URL.');
			return;
		}

		if (!url.includes('blocket.se')) {
			await bot.sendMessage(chatId, 'Please provide a valid Blocket.se URL.');
			return;
		}

		const sellerInfo = extractSellerFromUrl(url);

		if (!sellerInfo) {
			await bot.sendMessage(chatId, 'Could not identify seller from URL.\n\nValid formats:\n• https://www.blocket.se/annonsorer/seller-name\n• Search URL with seller filter (st=s&st_s=...)');
			return;
		}

		const user = db.getOrCreateUser(telegramId, username);
		const existingFollows = db.getFollowsByUserId(user.id);

		if (existingFollows.length >= 10) {
			await bot.sendMessage(chatId, 'You have reached the maximum of 10 follows. Use /unfollow to remove one first.');
			return;
		}

		const existingFollow = existingFollows.find(f => f.sellerUrl === sellerInfo.sellerUrl);
		if (existingFollow) {
			await bot.sendMessage(chatId, `You're already following this seller (F${existingFollow.id}).`);
			return;
		}

		const follow = db.createFollow(user.id, sellerInfo.sellerUrl, sellerInfo.sellerName);

		await bot.sendMessage(chatId, 
			`✅ Now following ${sellerInfo.sellerName || 'seller'}!\n\nFollow ID: F${follow.id}\n\nYou'll be notified when they post new ads or remove existing ones.\n\nUse /list to see all follows.`
		);
	});

	bot.onText(/\/unfollow(?:\s+(.+))?/, async (msg, match) => {
		const chatId = msg.chat.id;
		const telegramId = msg.from!.id;

		if (msg.text === '/unfollow') {
			await bot.sendMessage(chatId, 'Usage: `/unfollow F<id>`\n\nGet IDs from /list', { parse_mode: 'Markdown' });
			return;
		}

		const followIdStr = match?.[1]?.trim();
		
		if (!followIdStr) {
			await bot.sendMessage(chatId, 'Please provide a follow ID. Use /list to see your follows.');
			return;
		}

		const cleanId = followIdStr.replace(/^F/i, '');
		const followId = parseInt(cleanId, 10);

		if (isNaN(followId)) {
			await bot.sendMessage(chatId, 'Invalid follow ID. Use format F<number> (e.g., F1).');
			return;
		}

		const user = db.getUserByTelegramId(telegramId);

		if (!user) {
			await bot.sendMessage(chatId, 'User not found. Use /start first.');
			return;
		}

		const deleted = db.deleteFollow(followId, user.id);

		if (deleted) {
			await bot.sendMessage(chatId, `✅ Follow F${followId} removed.`);
		} else {
			await bot.sendMessage(chatId, `Follow F${followId} not found or doesn't belong to you.`);
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
			try {
				if (!config.stripeSecretKey || !config.stripePriceFyndbotPro) {
					await bot.sendMessage(chatId,
						`*Fyndbot Pro* ✨\n\n` +
						`*Benefits:*\n` +
						`• AI bargain score (1-10) on every alert\n` +
						`• Unlimited /inspect commands\n` +
						`• Vehicle besiktning/tax data\n` +
						`• Priority support\n\n` +
						`*Price:* ${config.priceProMonthly} SEK/month\n\n` +
						`_Payment integration not configured. Contact admin._`,
						{ parse_mode: 'Markdown' }
					);
					return;
				}

				const checkoutUrl = await createCheckoutSession(telegramId);

				await bot.sendMessage(chatId,
					`*Fyndbot Pro* ✨\n\n` +
					`*Benefits:*\n` +
					`• AI bargain score (1-10) on every alert\n` +
					`• Unlimited /inspect commands\n` +
					`• Vehicle besiktning/tax data\n` +
					`• Priority support\n\n` +
					`*Price:* ${config.priceProMonthly} SEK/month\n\n` +
					`Click below to subscribe:`,
					{ 
						parse_mode: 'Markdown',
						reply_markup: {
							inline_keyboard: [[
								{ text: '💳 Subscribe to Pro', url: checkoutUrl }
							]]
						}
					}
				);
			} catch (error) {
				console.error('Error creating checkout session:', error);
				await bot.sendMessage(chatId, '❌ Error creating checkout session. Please try again later.');
			}
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

export async function sendFollowNewAlert(bot: TelegramBot, userId: number, listing: BlocketListing, sellerName: string | null, isPro: boolean): Promise<void> {
	try {
		const user = await db.getUserByTelegramId(userId);
		if (!user) return;

		const seller = sellerName || 'Seller';
		let message = `👤 *${seller} posted new ad!*\n\n`;
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
		console.error('Error sending follow new alert:', error);
	}
}

export async function sendFollowDisappearedAlert(bot: TelegramBot, userId: number, listing: BlocketListing, sellerName: string | null): Promise<void> {
	try {
		const user = await db.getUserByTelegramId(userId);
		if (!user) return;

		const seller = sellerName || 'Seller';
		let message = `📤 *${seller}'s ad no longer listed*\n\n`;
		message += `📋 ${listing.title}\n`;
		message += `💰 ${listing.price ? listing.price + ' ' + listing.currency : 'Price not specified'}\n`;
		
		if (listing.location) {
			message += `📍 ${listing.location}\n`;
		}

		message += `\n_This ad has been removed, sold, or expired._`;

		await bot.sendMessage(user.telegramId, message, { parse_mode: 'Markdown' });
	} catch (error) {
		console.error('Error sending follow disappeared alert:', error);
	}
}
