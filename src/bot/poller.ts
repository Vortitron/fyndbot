import TelegramBot from 'node-telegram-bot-api';
import * as db from '../database/index.js';
import { fetchBlocketSearch } from '../blocket/fetcher.js';
import { sendAlert } from './handlers.js';
import { config } from '../config.js';

export function startPoller(bot: TelegramBot): NodeJS.Timeout {
	const intervalMs = config.pollIntervalMinutes * 60 * 1000;

	console.log(`Starting poller with ${config.pollIntervalMinutes} minute intervals...`);

	const interval = setInterval(async () => {
		await pollAllWatches(bot);
	}, intervalMs);

	setTimeout(() => pollAllWatches(bot), 5000);

	return interval;
}

async function pollAllWatches(bot: TelegramBot): Promise<void> {
	try {
		const watches = db.getAllActiveWatches();

		console.log(`Polling ${watches.length} active watches...`);

		for (const watch of watches) {
			try {
				const user = await db.getUserByTelegramId(watch.userId);
				if (!user) continue;

				const listings = await fetchBlocketSearch(watch.url);

				let newCount = 0;
				for (const listing of listings) {
					if (!db.isListingSeen(watch.id, listing.id)) {
						db.markListingSeen(watch.id, listing.id);
						
						const age = Date.now() - listing.publishedAt.getTime();
						const ageHours = age / (1000 * 60 * 60);
						
						if (ageHours < 24) {
							await sendAlert(bot, user.telegramId, listing, user.isPro);
							newCount++;
							
							await new Promise(resolve => setTimeout(resolve, 1000));
						}
					}
				}

				db.updateWatchLastChecked(watch.id);

				if (newCount > 0) {
					console.log(`Watch ${watch.id}: Found ${newCount} new listings`);
				}

				await new Promise(resolve => setTimeout(resolve, 2000));

			} catch (error) {
				console.error(`Error polling watch ${watch.id}:`, error);
			}
		}
	} catch (error) {
		console.error('Error in pollAllWatches:', error);
	}
}
