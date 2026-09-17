import { config } from './config.js';
import fetch from 'node-fetch';
import type { BlocketListing, BargainScore, User } from './types/index.js';

export interface HomeAssistantPayload {
	source: string;
	event: string;
	watch_id?: number;
	follow_id?: number;
	title: string;
	price: number | null;
	currency: string;
	url: string;
	score: number | null;
	score_reason: string | null;
	is_pro: boolean;
	location: string | null;
	image_url: string | null;
	category: string | null;
}

export function validateHaWebhookUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== 'https:') {
			return false;
		}
		if (!parsed.pathname.includes('/api/webhook/')) {
			return false;
		}
		return true;
	} catch (err) {
		return false;
	}
}

export function buildHomeAssistantPayload(
	listing: BlocketListing,
	user: User,
	watchId?: number,
	followId?: number,
	score?: BargainScore
): HomeAssistantPayload {
	return {
		source: 'fyndbot',
		event: 'listing_alert',
		watch_id: watchId,
		follow_id: followId,
		title: listing.title,
		price: listing.price,
		currency: listing.currency,
		url: listing.url,
		score: score ? score.score : null,
		score_reason: score ? score.reason : null,
		is_pro: user.isPro,
		location: listing.location,
		image_url: listing.imageUrl,
		category: listing.category,
	};
}

export async function notifyHomeAssistant(webhookUrl: string, payload: HomeAssistantPayload): Promise<void> {
	try {
		const timeoutMs = parseInt(process.env.HA_WEBHOOK_TIMEOUT_MS || '5000', 10);
		
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);

		const response = await fetch(webhookUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
			signal: controller.signal,
		});

		clearTimeout(timeout);

		if (!response.ok) {
			console.error(`HA webhook failed: ${response.status} - ${await response.text()}`);
		} else {
			console.log(`Sent HA notification: ${payload.event} - ${payload.title}`);
		}
	} catch (error: any) {
		if (error.name === 'AbortError') {
			console.error('HA webhook timeout');
		} else {
			console.error('HA webhook error:', error.message);
		}
	}
}

export function buildTestPayload(): HomeAssistantPayload {
	return {
		source: 'fyndbot',
		event: 'test',
		title: 'Test notification from Fyndbot',
		price: 1234,
		currency: 'SEK',
		url: 'https://www.blocket.se/test',
		score: 7.5,
		score_reason: 'This is a test notification to verify your Home Assistant webhook is working correctly.',
		is_pro: true,
		location: 'Stockholm',
		image_url: null,
		category: 'Test',
	};
}
