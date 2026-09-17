import { parseWatchShortcut, buildWatchUrl } from './watchShortcuts.js';

describe('Watch Shortcuts', () => {
	describe('parseWatchShortcut', () => {
		it('should parse bilar (cars) + region', () => {
			const result = parseWatchShortcut('bilar skåne');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/mobility/search/car?location=0.300012');
			expect(result?.category).toBe('car');
			expect(result?.region).toBe('0.300012');
		});

		it('should parse fordon (accessories) + region', () => {
			const result = parseWatchShortcut('fordon stockholm');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/recommerce/forsale/search?category=0.90&location=0.300001');
			expect(result?.category).toBe('0.90');
		});

		it('should parse region + category (order flexible)', () => {
			const result = parseWatchShortcut('stockholm elektronik');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/recommerce/forsale/search?category=0.93&location=0.300001');
		});

		it('should normalize Swedish characters', () => {
			const result = parseWatchShortcut('fordon skåne');
			expect(result).not.toBeNull();
			expect(result?.region).toBe('0.300012');
		});

		it('should build hela sverige URL when only category', () => {
			const result = parseWatchShortcut('elektronik');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/recommerce/forsale/search?category=0.93');
			expect(result?.region).toBeNull();
		});

		it('should return null when only region (ambiguous)', () => {
			const result = parseWatchShortcut('stockholm');
			expect(result).toBeNull();
		});

		it('should return null for full Blocket URLs', () => {
			const result = parseWatchShortcut('https://www.blocket.se/recommerce/forsale/search');
			expect(result).toBeNull();
		});

		it('should return null for unrecognized input', () => {
			const result = parseWatchShortcut('random gibberish');
			expect(result).toBeNull();
		});

		it('should handle multiple spaces', () => {
			const result = parseWatchShortcut('fordon    stockholm');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/recommerce/forsale/search?category=0.90&location=0.300001');
		});

		it('should be case insensitive', () => {
			const result = parseWatchShortcut('FORDON SKÅNE');
			expect(result).not.toBeNull();
			expect(result?.category).toBe('0.90');
		});

		it('should handle location aliases (göteborg)', () => {
			const result = parseWatchShortcut('fordon göteborg');
			expect(result).not.toBeNull();
			expect(result?.region).toBe('0.300014');
		});

		it('should handle category alias (cars → bilar)', () => {
			const result = parseWatchShortcut('cars stockholm');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/mobility/search/car?location=0.300001');
		});

		it('should handle barn category', () => {
			const result = parseWatchShortcut('barn uppsala');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/recommerce/forsale/search?category=0.68&location=0.300003');
		});

		it('should handle möbler category', () => {
			const result = parseWatchShortcut('möbler halland');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/recommerce/forsale/search?category=0.78&location=0.300013');
		});

		it('should handle bilar without location', () => {
			const result = parseWatchShortcut('bilar');
			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://www.blocket.se/mobility/search/car');
			expect(result?.region).toBeNull();
		});
	});

	describe('buildWatchUrl', () => {
		it('should build car URL without location', () => {
			const url = buildWatchUrl('car', '');
			expect(url).toBe('https://www.blocket.se/mobility/search/car');
		});

		it('should build car URL with location', () => {
			const url = buildWatchUrl('car', '0.300012');
			expect(url).toBe('https://www.blocket.se/mobility/search/car?location=0.300012');
		});

		it('should build torget URL without location', () => {
			const url = buildWatchUrl('0.93', '');
			expect(url).toBe('https://www.blocket.se/recommerce/forsale/search?category=0.93');
		});

		it('should build torget URL with location', () => {
			const url = buildWatchUrl('0.93', '0.300001');
			expect(url).toBe('https://www.blocket.se/recommerce/forsale/search?category=0.93&location=0.300001');
		});
	});
});
