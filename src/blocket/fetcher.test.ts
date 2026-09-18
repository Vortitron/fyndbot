import { extractRegistrationNumber, parseBlocketHTML } from '../blocket/fetcher.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Blocket Parser', () => {
	describe('extractRegistrationNumber', () => {
		it('should extract valid Swedish registration numbers', () => {
			expect(extractRegistrationNumber('Volvo V70 ABC123 2012')).toBe('ABC123');
			expect(extractRegistrationNumber('Säljer min bil XYZ456')).toBe('XYZ456');
			expect(extractRegistrationNumber('ABC 123 with space')).toBe('ABC123');
		});

		it('should handle lowercase input', () => {
			expect(extractRegistrationNumber('volvo abc123')).toBe('ABC123');
			expect(extractRegistrationNumber('xyz 456')).toBe('XYZ456');
		});

		it('should return null for invalid patterns', () => {
			expect(extractRegistrationNumber('No registration here')).toBeNull();
			expect(extractRegistrationNumber('AB123')).toBeNull();
			expect(extractRegistrationNumber('ABCD123')).toBeNull();
			expect(extractRegistrationNumber('123ABC')).toBeNull();
		});

		it('should handle mixed alphanumeric endings', () => {
			expect(extractRegistrationNumber('ABC12A valid format')).toBe('ABC12A');
			expect(extractRegistrationNumber('XYZ991 also valid')).toBe('XYZ991');
		});

		it('should extract first match when multiple patterns exist', () => {
			expect(extractRegistrationNumber('ABC123 and XYZ456')).toBe('ABC123');
		});
	});

	describe('parseBlocketHTML with JSON-LD parser', () => {
		it('should parse mobility search HTML with JSON-LD structured data', () => {
			const fixturePath = resolve(__dirname, '__fixtures__', 'mobility-search.html');
			const html = readFileSync(fixturePath, 'utf-8');
			
			const listings = parseBlocketHTML(html);
			
			expect(listings.length).toBeGreaterThan(0);
			expect(listings[0]).toHaveProperty('id');
			expect(listings[0]).toHaveProperty('title');
			expect(listings[0]).toHaveProperty('price');
			expect(listings[0]).toHaveProperty('url');
			expect(listings[0].id).toBe('26676756');
			expect(listings[0].title).toBe('Toyota RAV4');
			expect(listings[0].price).toBe(439900);
			expect(listings[0].url).toBe('https://www.blocket.se/mobility/item/26676756');
		});

		it('should throw error when HTML contains no listings', () => {
			const emptyHtml = '<html><body><h1>No results</h1></body></html>';
			
			expect(() => parseBlocketHTML(emptyHtml)).toThrow('Blocket parser failed: zero listings extracted from search page');
		});

		it('should extract multiple listings from fixture', () => {
			const fixturePath = resolve(__dirname, '__fixtures__', 'mobility-search.html');
			const html = readFileSync(fixturePath, 'utf-8');
			
			const listings = parseBlocketHTML(html);
			
			expect(listings.length).toBeGreaterThanOrEqual(10);
			
			const secondListing = listings[1];
			expect(secondListing.id).toBe('26676576');
			expect(secondListing.title).toBe('Volkswagen Polo');
			expect(secondListing.price).toBe(47000);
			expect(secondListing.imageUrl).toContain('blocketcdn.se');
		});

		it('should extract all expected fields from listings', () => {
			const fixturePath = resolve(__dirname, '__fixtures__', 'mobility-search.html');
			const html = readFileSync(fixturePath, 'utf-8');
			
			const listings = parseBlocketHTML(html);
			const firstListing = listings[0];
			
			expect(firstListing.id).toBeTruthy();
			expect(firstListing.title).toBeTruthy();
			expect(typeof firstListing.price).toBe('number');
			expect(firstListing.currency).toBe('SEK');
			expect(firstListing.url).toMatch(/^https:\/\/www\.blocket\.se/);
			expect(firstListing.imageUrl).toMatch(/blocketcdn\.se/);
			expect(firstListing.publishedAt).toBeInstanceOf(Date);
		});
	});
});
