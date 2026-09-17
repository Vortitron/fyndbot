import { extractRegistrationNumber } from '../blocket/fetcher.js';

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
});
