import { extractRegistrationNumber, extractSellerFromUrl } from '../blocket/fetcher.js';

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

	describe('extractSellerFromUrl', () => {
		it('should extract seller from annonsorer URLs', () => {
			const result = extractSellerFromUrl('https://www.blocket.se/annonsorer/test-seller');
			expect(result).not.toBeNull();
			expect(result?.sellerUrl).toBe('https://www.blocket.se/annonsorer/test-seller');
			expect(result?.sellerName).toBe('test seller');
		});

		it('should handle seller URLs with trailing paths', () => {
			const result = extractSellerFromUrl('https://www.blocket.se/annonsorer/my-shop/fordon');
			expect(result).not.toBeNull();
			expect(result?.sellerUrl).toBe('https://www.blocket.se/annonsorer/my-shop');
			expect(result?.sellerName).toBe('my shop');
		});

		it('should extract seller from search URLs with st_s parameter', () => {
			const result = extractSellerFromUrl('https://www.blocket.se/annonser/hela_sverige?st=s&st_s=seller123');
			expect(result).not.toBeNull();
			expect(result?.sellerName).toBe('seller123');
		});

		it('should return null for non-seller URLs', () => {
			const result = extractSellerFromUrl('https://www.blocket.se/annonser/hela_sverige/fordon');
			expect(result).toBeNull();
		});

		it('should return null for regular ad URLs', () => {
			const result = extractSellerFromUrl('https://www.blocket.se/annons/stockholm/volvo/123456');
			expect(result).toBeNull();
		});
	});
});
