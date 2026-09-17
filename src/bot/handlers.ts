import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config.js';
import * as db from '../database/index.js';
import { fetchBlocketSearch, fetchBlocketAd, extractRegistrationNumber, extractSellerFromUrl } from '../blocket/fetcher.js';
import { scoreListing } from '../scorer/index.js';
import { enrichVehicleData } from '../enrichment/transportstyrelsen.js';
import { createCheckoutSession } from '../stripe/index.js';
import { parseWatchShortcut, getCategoryButtons, getRegionButtons, buildWatchUrl } from './watchShortcuts.js';
import { validateHaWebhookUrl, buildHomeAssistantPayload, notifyHomeAssistant, buildTestPayload } from '../homeassistant.js';
import type { BlocketListing, BargainScore } from '../types/index.js';

interface WizardState {
	category?: string;
	timestamp: number;
}

const wizardState = new Map<number, WizardState>();
const WIZARD_TTL_MS = 10 * 60 * 1000;

export function createBot(): TelegramBot {
	const bot = new TelegramBot(config.telegramBotToken, { polling: true });

	bot.on('callback_query', async (query) => {
		const chatId = query.message?.chat.id;
		const telegramId = query.from.id;
		const data = query.data;

		if (!chatId || !data) {
			return;
		}

		try {
			await bot.answerCallbackQuery(query.id);

			if (data.startsWith('wcat:')) {
				const category = data.substring(5);
				cleanupExpiredWizards();
				wizardState.set(telegramId, { category, timestamp: Date.now() });

				const regionButtons = getRegionButtons();
				const keyboard = [];
				for (let i = 0; i < regionButtons.length; i += 3) {
					const row = [
						{ text: regionButtons[i].text, callback_data: regionButtons[i].callbackData }
					];
					if (regionButtons[i + 1]) {
						row.push({ text: regionButtons[i + 1].text, callback_data: regionButtons[i + 1].callbackData });
					}
					if (regionButtons[i + 2]) {
						row.push({ text: regionButtons[i + 2].text, callback_data: regionButtons[i + 2].callbackData });
					}
					keyboard.push(row);
				}

				await bot.editMessageText('📍 *Choose a region:*', {
					chat_id: chatId,
					message_id: query.message?.message_id,
					parse_mode: 'Markdown',
					reply_markup: {
						inline_keyboard: keyboard
					}
				});
			} else if (data.startsWith('wreg:')) {
				const region = data.substring(5);
				const state = wizardState.get(telegramId);

				if (!state || !state.category) {
					await bot.editMessageText('❌ Session expired. Please start again with /watch', {
						chat_id: chatId,
						message_id: query.message?.message_id
					});
					wizardState.delete(telegramId);
					return;
				}

				const user = db.getOrCreateUser(telegramId, query.from.username || null);
				const existingWatches = db.getWatchesByUserId(user.id);

				if (existingWatches.length >= 10) {
					await bot.editMessageText('❌ You have reached the maximum of 10 watches. Use /unwatch to remove one first.', {
						chat_id: chatId,
						message_id: query.message?.message_id
					});
					wizardState.delete(telegramId);
					return;
				}

				const watchUrl = buildWatchUrl(state.category, region);
				const watch = db.createWatch(user.id, watchUrl, null);

				await bot.editMessageText(
					`✅ *Now watching:*\n${watchUrl}\n\nWatch ID: W${watch.id}\n\nYou'll get alerts when new listings appear!`,
					{
						chat_id: chatId,
						message_id: query.message?.message_id,
						parse_mode: 'Markdown'
					}
				);

				wizardState.delete(telegramId);
			}
		} catch (error) {
			console.error('Error handling callback query:', error);
		}
	});

	bot.onText(/\/start/, async (msg) => {
		const chatId = msg.chat.id;
		const telegramId = msg.from!.id;
		const username = msg.from!.username || null;

		db.getOrCreateUser(telegramId, username);

		await bot.sendMessage(chatId, 
`Välkommen till Fyndbot! 🇸🇪

I help you find bargains on Blocket.se with instant alerts.

*Commands:*
/watch — Interactive wizard or /watch <url> or shortcuts like "/watch fordon skåne"
/follow <url> — Follow a Blocket seller
/list — Show your watches and follows
/unwatch <id> — Stop watching
/unfollow <id> — Stop following
/inspect <url> — Analyse a listing (Pro feature)
/pro — View subscription status
/ha — Home Assistant integration
/help — Show this help

*Examples:*
\`/watch fordon stockholm\`
\`/watch\` (interactive buttons)
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

/watch — Interactive wizard with buttons
/watch <shortcut> — Quick watch (e.g., "fordon skåne", "bilar stockholm")
/watch <url> — Watch a full Blocket URL
/follow <url> — Follow a Blocket seller
/list — List all your active watches and follows
/unwatch <id> — Stop watching (use ID from /list)
/unfollow <id> — Stop following (use ID from /list)
/inspect <url> — Deep analysis of a listing
/pro — View Pro subscription details
/ha — Home Assistant integration (automate alerts)
/help — Show this message

*Examples:*
\`/watch fordon göteborg\` — Cars in Göteborg
\`/watch elektronik\` — Electronics nationwide
\`/watch\` — Interactive category/region picker

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

		const input = match?.[1]?.trim();

		if (!input) {
			cleanupExpiredWizards();
			wizardState.set(telegramId, { timestamp: Date.now() });

			const categoryButtons = getCategoryButtons();
			const keyboard = [];
			for (let i = 0; i < categoryButtons.length; i += 2) {
				const row = [
					{ text: categoryButtons[i].text, callback_data: categoryButtons[i].callbackData }
				];
				if (categoryButtons[i + 1]) {
					row.push({ text: categoryButtons[i + 1].text, callback_data: categoryButtons[i + 1].callbackData });
				}
				keyboard.push(row);
			}

			await bot.sendMessage(chatId, '🔍 *Choose a category:*', {
				parse_mode: 'Markdown',
				reply_markup: {
					inline_keyboard: keyboard
				}
			});
			return;
		}

		const user = db.getOrCreateUser(telegramId, username);
		const existingWatches = db.getWatchesByUserId(user.id);

		if (existingWatches.length >= 10) {
			await bot.sendMessage(chatId, 'You have reached the maximum of 10 watches. Use /unwatch to remove one first.');
			return;
		}

		let watchUrl = input;
		let resolvedInfo = '';

		if (!input.includes('blocket.se')) {
			const resolved = parseWatchShortcut(input);
			if (resolved) {
				watchUrl = resolved.url;
				resolvedInfo = ` (resolved from shortcut)`;
			} else {
				await bot.sendMessage(chatId, '❌ Could not parse shortcut. Try:\n• `/watch fordon skåne`\n• `/watch bilar stockholm`\n• `/watch` for interactive wizard\n• Full Blocket URL', { parse_mode: 'Markdown' });
				return;
			}
		}

		const watch = db.createWatch(user.id, watchUrl, null);

		await bot.sendMessage(chatId, `✅ Now watching${resolvedInfo}:\n${watchUrl}\n\nWatch ID: W${watch.id}\n\nYou'll get alerts when new listings appear!`);
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
		const username = msg.from!.username || null;

		const user = db.getUserByTelegramId(telegramId);

		if (!user) {
			await bot.sendMessage(chatId, 'Use /start first to register.');
			return;
		}

		if (user.isPro) {
			await bot.sendMessage(chatId, 
				`✨ *You're already Pro!*\n\n• AI bargain scores on alerts\n• Unlimited inspections\n• Vehicle data enrichment\n\nThank you for your support!`,
				{ parse_mode: 'Markdown' }
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

				const checkout = await createCheckoutSession(telegramId, username);

				let message = `*Fyndbot Pro* ✨\n\n` +
					`*Benefits:*\n` +
					`• AI bargain score (1-10) on every alert\n` +
					`• Unlimited /inspect commands\n` +
					`• Vehicle besiktning/tax data\n` +
					`• Priority support\n\n` +
					`*Price:* ${config.priceProMonthly} SEK/month\n\n`;

				if (checkout.isTest) {
					message += `🧪 *TEST MODE*: This is a sandbox checkout.\n` +
						`Use test card: \`4242 4242 4242 4242\`\n` +
						`Any expiry/CVC. No real charges.\n\n`;
				}

				message += `Click below to subscribe:`;

				await bot.sendMessage(chatId, message,
					{ 
						parse_mode: 'Markdown',
						reply_markup: {
							inline_keyboard: [[
								{ text: checkout.isTest ? '🧪 Test Checkout' : '💳 Subscribe to Pro', url: checkout.url }
							]]
						}
					}
				);
			} catch (error) {
				console.error('Error creating checkout session:', error);
				const errorMsg = error instanceof Error ? error.message : 'Unknown error';
				await bot.sendMessage(chatId, `❌ Error creating checkout session: ${errorMsg}`);
			}
		}
	});

	bot.onText(/\/ha(?:\s+(.*))?/, async (msg, match) => {
		const chatId = msg.chat.id;
		const telegramId = msg.from!.id;
		const args = match?.[1]?.trim();

		const user = db.getUserByTelegramId(telegramId);
		if (!user) {
			await bot.sendMessage(chatId, 'Use /start first to register.');
			return;
		}

		if (!args) {
			const currentUrl = db.getUserHaWebhookUrl(telegramId);
			if (currentUrl) {
				await bot.sendMessage(chatId,
					`🏠 *Home Assistant Integration*\n\n` +
					`Status: ✅ Connected\n` +
					`Webhook: \`${currentUrl.substring(0, 40)}...\`\n\n` +
					`Commands:\n` +
					`/ha test — Test connection\n` +
					`/ha clear — Remove webhook\n\n` +
					`Your listing alerts will be sent to Home Assistant automatically.`,
					{ parse_mode: 'Markdown' }
				);
			} else {
				await bot.sendMessage(chatId,
					`🏠 *Home Assistant Integration*\n\n` +
					`Status: ❌ Not configured\n\n` +
					`To connect:\n` +
					`1. Create webhook in HA (Settings → Automations → +)\n` +
					`2. Use webhook trigger, copy URL\n` +
					`3. Send: \`/ha set <URL>\`\n\n` +
					`See HA_SETUP.md for detailed guide.`,
					{ parse_mode: 'Markdown' }
				);
			}
			return;
		}

		const parts = args.split(/\s+/);
		const command = parts[0].toLowerCase();

		if (command === 'set') {
			const url = parts.slice(1).join(' ');
			if (!url) {
				await bot.sendMessage(chatId, '❌ Please provide a webhook URL.\n\nExample:\n`/ha set https://your-ha.com/api/webhook/XXXXX`', { parse_mode: 'Markdown' });
				return;
			}

			if (!validateHaWebhookUrl(url)) {
				await bot.sendMessage(chatId, '❌ Invalid webhook URL.\n\nMust be:\n• HTTPS\n• Contain `/api/webhook/`\n\nExample:\n`https://your-ha.com/api/webhook/XXXXX`', { parse_mode: 'Markdown' });
				return;
			}

			db.setUserHaWebhookUrl(telegramId, url);
			await bot.sendMessage(chatId, `✅ Home Assistant webhook saved!\n\nUse \`/ha test\` to verify it's working.`, { parse_mode: 'Markdown' });
		} else if (command === 'clear') {
			db.setUserHaWebhookUrl(telegramId, null);
			await bot.sendMessage(chatId, '✅ Home Assistant webhook removed.');
		} else if (command === 'test') {
			const webhookUrl = db.getUserHaWebhookUrl(telegramId);
			if (!webhookUrl) {
				await bot.sendMessage(chatId, '❌ No webhook configured. Use `/ha set <URL>` first.', { parse_mode: 'Markdown' });
				return;
			}

			await bot.sendMessage(chatId, '🧪 Sending test notification to Home Assistant...');

			const testPayload = buildTestPayload();
			try {
				await notifyHomeAssistant(webhookUrl, testPayload);
				await bot.sendMessage(chatId, '✅ Test notification sent! Check your Home Assistant.');
			} catch (error) {
				await bot.sendMessage(chatId, '❌ Failed to send test notification. Check your webhook URL.');
			}
		} else {
			await bot.sendMessage(chatId, '❌ Unknown command. Use:\n• `/ha` — Show status\n• `/ha set <URL>`\n• `/ha clear`\n• `/ha test`', { parse_mode: 'Markdown' });
		}
	});

	bot.on('polling_error', (error) => {
		console.error('Telegram polling error:', error);
	});

	return bot;
}

export async function sendAlert(bot: TelegramBot, userId: number, listing: BlocketListing, isPro: boolean, watchId?: number): Promise<void> {
	try {
		const user = await db.getUserByTelegramId(userId);
		if (!user) return;

		let score: BargainScore | undefined;

		let message = `🔔 *New Listing!*\n\n`;
		message += `📋 ${listing.title}\n`;
		message += `💰 ${listing.price ? listing.price + ' ' + listing.currency : 'Price not specified'}\n`;
		
		if (listing.location) {
			message += `📍 ${listing.location}\n`;
		}

		if (isPro) {
			score = await scoreListing(listing);
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

		const haWebhookUrl = db.getUserHaWebhookUrl(user.telegramId);
		if (haWebhookUrl) {
			const haPayload = buildHomeAssistantPayload(listing, user, watchId, undefined, score);
			notifyHomeAssistant(haWebhookUrl, haPayload).catch(err => {
				console.error('HA notification failed (non-blocking):', err);
			});
		}
	} catch (error) {
		console.error('Error sending alert:', error);
	}
}

export async function sendFollowNewAlert(bot: TelegramBot, userId: number, listing: BlocketListing, sellerName: string | null, isPro: boolean, followId?: number): Promise<void> {
	try {
		const user = await db.getUserByTelegramId(userId);
		if (!user) return;

		let score: BargainScore | undefined;

		const seller = sellerName || 'Seller';
		let message = `👤 *${seller} posted new ad!*\n\n`;
		message += `📋 ${listing.title}\n`;
		message += `💰 ${listing.price ? listing.price + ' ' + listing.currency : 'Price not specified'}\n`;
		
		if (listing.location) {
			message += `📍 ${listing.location}\n`;
		}

		if (isPro) {
			score = await scoreListing(listing);
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

		const haWebhookUrl = db.getUserHaWebhookUrl(user.telegramId);
		if (haWebhookUrl) {
			const haPayload = buildHomeAssistantPayload(listing, user, undefined, followId, score);
			notifyHomeAssistant(haWebhookUrl, haPayload).catch(err => {
				console.error('HA notification failed (non-blocking):', err);
			});
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

function cleanupExpiredWizards(): void {
	const now = Date.now();
	for (const [telegramId, state] of wizardState.entries()) {
		if (now - state.timestamp > WIZARD_TTL_MS) {
			wizardState.delete(telegramId);
		}
	}
}
