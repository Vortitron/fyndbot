describe('Follow Listing Tracking', () => {
	describe('disappeared ad detection', () => {
		it('should identify listings that are no longer present', () => {
			const previousListingIds = ['123', '456', '789'];
			const currentListingIds = new Set(['123', '789']);

			const disappeared = previousListingIds.filter(id => !currentListingIds.has(id));

			expect(disappeared).toEqual(['456']);
		});

		it('should handle all listings disappeared', () => {
			const previousListingIds = ['123', '456', '789'];
			const currentListingIds = new Set<string>([]);

			const disappeared = previousListingIds.filter(id => !currentListingIds.has(id));

			expect(disappeared).toEqual(['123', '456', '789']);
		});

		it('should handle no listings disappeared', () => {
			const previousListingIds = ['123', '456', '789'];
			const currentListingIds = new Set(['123', '456', '789']);

			const disappeared = previousListingIds.filter(id => !currentListingIds.has(id));

			expect(disappeared).toEqual([]);
		});

		it('should identify new listings', () => {
			const previousListingIds = ['123', '456'];
			const currentListings = [
				{ id: '123' },
				{ id: '456' },
				{ id: '789' },
			];

			const newListings = currentListings.filter(l => !previousListingIds.includes(l.id));

			expect(newListings.map(l => l.id)).toEqual(['789']);
		});

		it('should handle both new and disappeared in same poll', () => {
			const previousListingIds = ['123', '456', '789'];
			const currentListingIds = new Set(['123', '999', '888']);

			const disappeared = previousListingIds.filter(id => !currentListingIds.has(id));
			const allCurrent = Array.from(currentListingIds);
			const newIds = allCurrent.filter(id => !previousListingIds.includes(id));

			expect(disappeared).toEqual(['456', '789']);
			expect(newIds).toEqual(['999', '888']);
		});

		it('should handle empty previous state (first poll)', () => {
			const previousListingIds: string[] = [];
			const currentListingIds = new Set(['123', '456']);

			const disappeared = previousListingIds.filter(id => !currentListingIds.has(id));

			expect(disappeared).toEqual([]);
		});
	});

	describe('listing age filtering', () => {
		it('should only alert on fresh listings (< 24 hours)', () => {
			const now = Date.now();
			const listings = [
				{ id: '1', publishedAt: new Date(now - 1000 * 60 * 60) },
				{ id: '2', publishedAt: new Date(now - 1000 * 60 * 60 * 12) },
				{ id: '3', publishedAt: new Date(now - 1000 * 60 * 60 * 25) },
			];

			const fresh = listings.filter(l => {
				const age = now - l.publishedAt.getTime();
				const ageHours = age / (1000 * 60 * 60);
				return ageHours < 24;
			});

			expect(fresh.map(l => l.id)).toEqual(['1', '2']);
		});

		it('should alert on very fresh listings (< 1 hour)', () => {
			const now = Date.now();
			const listings = [
				{ id: '1', publishedAt: new Date(now - 1000 * 60 * 30) },
				{ id: '2', publishedAt: new Date(now - 1000 * 60 * 90) },
			];

			const veryFresh = listings.filter(l => {
				const age = now - l.publishedAt.getTime();
				const ageHours = age / (1000 * 60 * 60);
				return ageHours < 1;
			});

			expect(veryFresh.map(l => l.id)).toEqual(['1']);
		});
	});
});
