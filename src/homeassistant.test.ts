import { validateHaWebhookUrl, buildHomeAssistantPayload, buildTestPayload } from './homeassistant.js';
import type { BlocketListing, User } from './types/index.js';

describe('Home Assistant Integration', () => {
	describe('validateHaWebhookUrl', () => {
		it('should accept valid HTTPS webhook URLs', () => {
			expect(validateHaWebhookUrl('https://example.com/api/webhook/abc123')).toBe(true);
			expect(validateHaWebhookUrl('https://my-ha.duckdns.org/api/webhook/fyndbot')).toBe(true);
		});

		it('should reject HTTP URLs', () => {
			expect(validateHaWebhookUrl('http://example.com/api/webhook/abc123')).toBe(false);
		});

		it('should reject URLs without /api/webhook/', () => {
			expect(validateHaWebhookUrl('https://example.com/webhook/abc123')).toBe(false);
			expect(validateHaWebhookUrl('https://example.com/api/abc123')).toBe(false);
		});

		it('should reject invalid URLs', () => {
			expect(validateHaWebhookUrl('not a url')).toBe(false);
			expect(validateHaWebhookUrl('')).toBe(false);
		});
	});

	describe('buildHomeAssistantPayload', () => {
		const mockListing: BlocketListing = {
			id: '123',
			title: 'Test Listing',
			price: 1000,
			currency: 'SEK',
			url: 'https://www.blocket.se/test',
			imageUrl: 'https://images.blocket.se/test.jpg',
			publishedAt: new Date(),
			location: 'Stockholm',
			category: 'Elektronik',
			description: 'Test description',
		};

		const mockUser: User = {
			id: 1,
			telegramId: 123456,
			username: 'testuser',
			isPro: true,
			inspectCount: 0,
			inspectResetAt: new Date(),
			createdAt: new Date(),
		};

		it('should build payload with watch_id', () => {
			const payload = buildHomeAssistantPayload(mockListing, mockUser, 42);

			expect(payload.source).toBe('fyndbot');
			expect(payload.event).toBe('listing_alert');
			expect(payload.watch_id).toBe(42);
			expect(payload.follow_id).toBeUndefined();
			expect(payload.title).toBe('Test Listing');
			expect(payload.price).toBe(1000);
			expect(payload.currency).toBe('SEK');
			expect(payload.url).toBe('https://www.blocket.se/test');
			expect(payload.is_pro).toBe(true);
			expect(payload.location).toBe('Stockholm');
			expect(payload.image_url).toBe('https://images.blocket.se/test.jpg');
			expect(payload.category).toBe('Elektronik');
		});

		it('should build payload with follow_id', () => {
			const payload = buildHomeAssistantPayload(mockListing, mockUser, undefined, 99);

			expect(payload.watch_id).toBeUndefined();
			expect(payload.follow_id).toBe(99);
		});

		it('should include score if provided', () => {
			const score = { score: 7.5, reason: 'Good deal', confidence: 0.8 };
			const payload = buildHomeAssistantPayload(mockListing, mockUser, 1, undefined, score);

			expect(payload.score).toBe(7.5);
			expect(payload.score_reason).toBe('Good deal');
		});

		it('should set score to null if not provided', () => {
			const payload = buildHomeAssistantPayload(mockListing, mockUser);

			expect(payload.score).toBeNull();
			expect(payload.score_reason).toBeNull();
		});

		it('should handle null listing fields', () => {
			const minimalListing: BlocketListing = {
				...mockListing,
				price: null,
				imageUrl: null,
				location: null,
				category: null,
			};

			const payload = buildHomeAssistantPayload(minimalListing, mockUser);

			expect(payload.price).toBeNull();
			expect(payload.image_url).toBeNull();
			expect(payload.location).toBeNull();
			expect(payload.category).toBeNull();
		});
	});

	describe('buildTestPayload', () => {
		it('should build valid test payload', () => {
			const payload = buildTestPayload();

			expect(payload.source).toBe('fyndbot');
			expect(payload.event).toBe('test');
			expect(payload.title).toContain('Test');
			expect(payload.price).toBe(1234);
			expect(payload.currency).toBe('SEK');
			expect(payload.score).toBe(7.5);
			expect(payload.score_reason).toContain('test');
		});
	});
});
