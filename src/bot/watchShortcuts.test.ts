import { parseWatchShortcut, buildWatchUrl } from './watchShortcuts.js';

describe('Watch Shortcuts', () => {
	describe('parseWatchShortcut', () => {
		it('should parse category + region', () => {
			const result = parseWatchShortcut('fordon skåne');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/annonser/skane/fordon');
			expect(result?.category).toBe('fordon');
			expect(result?.region).toBe('skane');
		});

		it('should parse region + category (order flexible)', () => {
			const result = parseWatchShortcut('stockholm elektronik');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/annonser/stockholm/elektronik');
		});

		it('should parse subcategory (bilar)', () => {
			const result = parseWatchShortcut('bilar göteborg');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/annonser/vastra_gotalands_lan/fordon/bilar');
		});

		it('should normalize Swedish characters', () => {
			const result = parseWatchShortcut('fordon skåne');
			expect(result).not.toBeNull();
			expect(result?.region).toBe('skane');
		});

		it('should default to hela_sverige when only category', () => {
			const result = parseWatchShortcut('elektronik');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/annonser/hela_sverige/elektronik');
			expect(result?.region).toBe('hela_sverige');
		});

		it('should return null when only region (ambiguous)', () => {
			const result = parseWatchShortcut('stockholm');
			expect(result).toBeNull();
		});

		it('should return null for full Blocket URLs', () => {
			const result = parseWatchShortcut('https://www.blocket.se/annonser/stockholm/bostad');
			expect(result).toBeNull();
		});

		it('should return null for unrecognized input', () => {
			const result = parseWatchShortcut('random gibberish');
			expect(result).toBeNull();
		});

		it('should handle multiple spaces', () => {
			const result = parseWatchShortcut('fordon    stockholm');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/annonser/stockholm/fordon');
		});

		it('should be case insensitive', () => {
			const result = parseWatchShortcut('FORDON SKÅNE');
			expect(result).not.toBeNull();
			expect(result?.category).toBe('fordon');
		});

		it('should handle region aliases (göteborg)', () => {
			const result = parseWatchShortcut('fordon göteborg');
			expect(result).not.toBeNull();
			expect(result?.region).toBe('vastra_gotalands_lan');
		});

		it('should handle category aliases (cars → bilar)', () => {
			const result = parseWatchShortcut('cars stockholm');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/annonser/stockholm/fordon/bilar');
		});

		it('should handle barn_barnartiklar', () => {
			const result = parseWatchShortcut('barn uppsala');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/annonser/uppsala/barn_barnartiklar');
		});

		it('should handle home_garden', () => {
			const result = parseWatchShortcut('hem halland');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/annonser/halland/home_garden');
		});
	});

	describe('buildWatchUrl', () => {
		it('should build simple category/region URL', () => {
			const url = buildWatchUrl('elektronik', 'stockholm');
			expect(url).toBe('https://www.blocket.se/annonser/stockholm/elektronik');
		});

		it('should build URL with subcategory', () => {
			const url = buildWatchUrl('fordon/bilar', 'skane');
			expect(url).toBe('https://www.blocket.se/annonser/skane/fordon/bilar');
		});

		it('should handle hela_sverige', () => {
			const url = buildWatchUrl('datorer_tillbehor', 'hela_sverige');
			expect(url).toBe('https://www.blocket.se/annonser/hela_sverige/datorer_tillbehor');
		});
	});
});
