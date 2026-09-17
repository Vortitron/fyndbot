import type { BlocketListing } from '../types/index.js';
import { scoreListing } from './index.js';

describe('Bargain Scorer', () => {
	const baseListingFixture: BlocketListing = {
		id: '123',
		title: 'Standard Item',
		price: 1000,
		currency: 'SEK',
		url: 'https://www.blocket.se/annons/123',
		imageUrl: null,
		publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
		location: 'Stockholm',
		category: 'Fordon',
		description: 'Standard description',
	};

	describe('heuristic scoring', () => {
		it('should score brand new listings higher', async () => {
			const newListing = {
				...baseListingFixture,
				publishedAt: new Date(Date.now() - 1000 * 60 * 30),
			};

			const score = await scoreListing(newListing);
			
			expect(score.score).toBeGreaterThanOrEqual(5);
			expect(score.confidence).toBeGreaterThan(0);
			expect(score.reason).toBeDefined();
		});

		it('should boost score for new/unused items', async () => {
			const newItemListing = {
				...baseListingFixture,
				title: 'Ny och oöppnad iPhone',
			};

			const score = await scoreListing(newItemListing);
			
			expect(score.score).toBeGreaterThanOrEqual(6);
			expect(score.reason.toLowerCase()).toContain('new');
		});

		it('should boost score for motivated sellers', async () => {
			const motivatedListing = {
				...baseListingFixture,
				title: 'Säljes snabbt - prutbar',
			};

			const score = await scoreListing(motivatedListing);
			
			expect(score.score).toBeGreaterThanOrEqual(6);
		});

		it('should boost score for low prices', async () => {
			const cheapListing = {
				...baseListingFixture,
				price: 300,
			};

			const score = await scoreListing(cheapListing);
			
			expect(score.score).toBeGreaterThanOrEqual(6);
		});

		it('should give moderate score for items with images', async () => {
			const listingWithImage = {
				...baseListingFixture,
				imageUrl: 'https://example.com/image.jpg',
			};

			const score = await scoreListing(listingWithImage);
			
			expect(score.score).toBeGreaterThan(5);
		});

		it('should handle listings with no price', async () => {
			const noPriceListing = {
				...baseListingFixture,
				price: null,
			};

			const score = await scoreListing(noPriceListing);
			
			expect(score.score).toBe(5);
			expect(score.reason).toContain('not specified');
			expect(score.confidence).toBeLessThan(0.5);
		});

		it('should cap scores between 1 and 10', async () => {
			const perfectListing = {
				...baseListingFixture,
				title: 'Ny oöppnad billig prutbar',
				price: 100,
				publishedAt: new Date(Date.now() - 1000 * 60 * 10),
				imageUrl: 'https://example.com/image.jpg',
			};

			const score = await scoreListing(perfectListing);
			
			expect(score.score).toBeGreaterThanOrEqual(1);
			expect(score.score).toBeLessThanOrEqual(10);
		});

		it('should combine multiple positive factors', async () => {
			const goodDealListing = {
				...baseListingFixture,
				title: 'Ny iPhone bra skick billig',
				price: 400,
				publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
				imageUrl: 'https://example.com/image.jpg',
			};

			const score = await scoreListing(goodDealListing);
			
			expect(score.score).toBeGreaterThanOrEqual(7);
		});

		it('should return confidence value in range', async () => {
			const score = await scoreListing(baseListingFixture);
			
			expect(score.confidence).toBeGreaterThanOrEqual(0);
			expect(score.confidence).toBeLessThanOrEqual(1);
		});
	});
});
