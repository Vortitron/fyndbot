import TelegramBot from 'node-telegram-bot-api';
import * as db from '../database/index.js';
import { fetchBlocketSearch } from '../blocket/fetcher.js';
import { sendAlert, sendFollowNewAlert, sendFollowDisappearedAlert } from './handlers.js';
import { config } from '../config.js';
import type { BlocketListing } from '../types/index.js';

export function startPoller(bot: TelegramBot): NodeJS.Timeout {
	const intervalMs = config.pollIntervalMinutes * 60 * 1000;

	console.log(`Starting poller with ${config.pollIntervalMinutes} minute intervals...`);

	const interval = setInterval(async () => {
		await pollAllWatches(bot);
		await pollAllFollows(bot);
	}, intervalMs);

	setTimeout(() => {
		pollAllWatches(bot);
		pollAllFollows(bot);
	}, 5000);

	return interval;
}

async function pollAllWatches(bot: TelegramBot): Promise<void> {
	try {
		const watches = db.getAllActiveWatches();

		console.log(`Polling ${watches.length} active watches...`);

		for (const watch of watches) {
			try {
				const user = db.getUserById(watch.userId);
				if (!user) continue;

				const listings = await fetchBlocketSearch(watch.url);
				const previousListingIds = db.getSeenListings(watch.id);
				const isFirstPoll = previousListingIds.length === 0;

				let newCount = 0;
				for (const listing of listings) {
					if (!db.isListingSeen(watch.id, listing.id)) {
						db.markListingSeen(watch.id, listing.id);
						
						if (!isFirstPoll) {
							await sendAlert(bot, user.telegramId, listing, user.isPro);
							newCount++;
							
							await new Promise(resolve => setTimeout(resolve, 1000));
						}
					}
				}

				db.updateWatchLastChecked(watch.id);

				if (isFirstPoll) {
					console.log(`Watch ${watch.id}: Seed mode - marked ${listings.length} listings as seen`);
				} else if (newCount > 0) {
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

async function pollAllFollows(bot: TelegramBot): Promise<void> {
	try {
		const follows = db.getAllActiveFollows();

		console.log(`Polling ${follows.length} active follows...`);

		for (const follow of follows) {
			try {
				const user = db.getUserById(follow.userId);
				if (!user) continue;

				const listings = await fetchBlocketSearch(follow.sellerUrl);

				const currentListingIds = new Set(listings.map(l => l.id));
				const previousListingIds = db.getFollowListings(follow.id);
				const isFirstPoll = previousListingIds.length === 0;

				const listingMap = new Map<string, BlocketListing>();
				for (const listing of listings) {
					listingMap.set(listing.id, listing);
				}

				let newCount = 0;
				for (const listing of listings) {
					if (!previousListingIds.includes(listing.id)) {
						db.markFollowListingSeen(follow.id, listing.id);
						
						if (!isFirstPoll) {
							await sendFollowNewAlert(bot, user.telegramId, listing, follow.sellerName, user.isPro);
							newCount++;
							
							await new Promise(resolve => setTimeout(resolve, 1000));
						}
					}
				}

				let disappearedCount = 0;
				if (!isFirstPoll) {
					for (const previousId of previousListingIds) {
						if (!currentListingIds.has(previousId)) {
							db.markFollowListingDisappeared(follow.id, previousId);
							
							const listing = await getCachedListingInfo(previousId, follow.id);
							if (listing) {
								await sendFollowDisappearedAlert(bot, user.telegramId, listing, follow.sellerName);
								disappearedCount++;
								
								await new Promise(resolve => setTimeout(resolve, 1000));
							}
						}
					}
				}

				db.updateFollowLastChecked(follow.id);

				if (isFirstPoll) {
					console.log(`Follow ${follow.id}: Seed mode - marked ${listings.length} listings as seen`);
				} else if (newCount > 0 || disappearedCount > 0) {
					console.log(`Follow ${follow.id}: ${newCount} new, ${disappearedCount} disappeared`);
				}

				await new Promise(resolve => setTimeout(resolve, 2000));

			} catch (error) {
				console.error(`Error polling follow ${follow.id}:`, error);
			}
		}
	} catch (error) {
		console.error('Error in pollAllFollows:', error);
	}
}

async function getCachedListingInfo(listingId: string, followId: number): Promise<BlocketListing | null> {
	return {
		id: listingId,
		title: 'Ad (details not cached)',
		price: null,
		currency: 'SEK',
		url: `https://www.blocket.se/annons/${listingId}`,
		imageUrl: null,
		publishedAt: new Date(),
		location: null,
		category: null,
		description: null,
	};
}
