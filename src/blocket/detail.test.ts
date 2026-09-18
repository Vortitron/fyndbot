import { parseBlocketDetailHTML, calculateMonthsUntilDate, type BlocketVehicleDetail } from './detail.js';

describe('Blocket Detail Parser', () => {
	describe('parseBlocketDetailHTML', () => {
		it('should parse vehicle details from dt/dd pairs', () => {
			const html = `
				<html>
					<body>
						<dl>
							<dt>Registreringsnummer</dt>
							<dd>YPR567</dd>
							<dt>Märke</dt>
							<dd>Kia</dd>
							<dt>Modell</dt>
							<dd>Rio</dd>
							<dt>Modellår</dt>
							<dd>2017</dd>
							<dt>Senaste besiktningsdatum</dt>
							<dd>2025-08-15</dd>
							<dt>Nästa besiktningsdatum</dt>
							<dd>2027-08-15</dd>
							<dt>Miltal</dt>
							<dd>125 000 mil</dd>
							<dt>Antal ägare</dt>
							<dd>2</dd>
						</dl>
					</body>
				</html>
			`;

			const result = parseBlocketDetailHTML(html);

			expect(result).not.toBeNull();
			expect(result?.registrationNumber).toBe('YPR567');
			expect(result?.make).toBe('Kia');
			expect(result?.model).toBe('Rio');
			expect(result?.year).toBe(2017);
			expect(result?.nextInspectionDate).toBe('2027-08-15');
			expect(result?.lastInspectionDate).toBe('2025-08-15');
			expect(result?.mileage).toBe(125000);
			expect(result?.owners).toBe(2);
			expect(result?.monthsUntilInspection).not.toBeNull();
		});

		it('should parse registration number from JSON attributes', () => {
			const html = `
				<html>
					<body>
						<script>
							var attributes = [
								{"key":"registration_number","value":["ABC123"]},
								{"key":"make","value":["Volvo"]},
								{"key":"model","value":["V70"]},
								{"key":"model_year","value":["2015"]}
							];
						</script>
					</body>
				</html>
			`;

			const result = parseBlocketDetailHTML(html);

			expect(result).not.toBeNull();
			expect(result?.registrationNumber).toBe('ABC123');
			expect(result?.make).toBe('Volvo');
			expect(result?.model).toBe('V70');
			expect(result?.year).toBe(2015);
		});

		it('should handle missing registration number gracefully', () => {
			const html = `
				<html>
					<body>
						<dl>
							<dt>Märke</dt>
							<dd>Volkswagen</dd>
							<dt>Modell</dt>
							<dd>Golf</dd>
							<dt>Nästa besiktningsdatum</dt>
							<dd>2028-03-20</dd>
						</dl>
					</body>
				</html>
			`;

			const result = parseBlocketDetailHTML(html);

			expect(result).not.toBeNull();
			expect(result?.registrationNumber).toBeNull();
			expect(result?.make).toBe('Volkswagen');
			expect(result?.model).toBe('Golf');
			expect(result?.nextInspectionDate).toBe('2028-03-20');
		});

		it('should handle missing inspection dates gracefully', () => {
			const html = `
				<html>
					<body>
						<dl>
							<dt>Registreringsnummer</dt>
							<dd>XYZ789</dd>
							<dt>Märke</dt>
							<dd>Toyota</dd>
						</dl>
					</body>
				</html>
			`;

			const result = parseBlocketDetailHTML(html);

			expect(result).not.toBeNull();
			expect(result?.registrationNumber).toBe('XYZ789');
			expect(result?.nextInspectionDate).toBeNull();
			expect(result?.lastInspectionDate).toBeNull();
			expect(result?.monthsUntilInspection).toBeNull();
		});

		it('should return null when no useful data is found', () => {
			const html = `
				<html>
					<body>
						<p>This is just a regular page with no vehicle data.</p>
					</body>
				</html>
			`;

			const result = parseBlocketDetailHTML(html);

			expect(result).toBeNull();
		});

		it('should handle HTML entities and formatting in values', () => {
			const html = `
				<html>
					<body>
						<dl>
							<dt>Registreringsnummer</dt>
							<dd><span>ABC&nbsp;123</span></dd>
							<dt>Märke</dt>
							<dd><strong>Ford</strong></dd>
							<dt>Miltal</dt>
							<dd>85&nbsp;000 mil</dd>
						</dl>
					</body>
				</html>
			`;

			const result = parseBlocketDetailHTML(html);

			expect(result).not.toBeNull();
			expect(result?.registrationNumber).toBe('ABC 123');
			expect(result?.make).toBe('Ford');
			expect(result?.mileage).toBe(85000);
		});

		it('should prefer dt/dd over JSON when both exist', () => {
			const html = `
				<html>
					<body>
						<dl>
							<dt>Registreringsnummer</dt>
							<dd>DDD111</dd>
						</dl>
						<script>
							var attrs = [{"key":"registration_number","value":["EEE222"]}];
						</script>
					</body>
				</html>
			`;

			const result = parseBlocketDetailHTML(html);

			expect(result).not.toBeNull();
			expect(result?.registrationNumber).toBe('DDD111');
		});

		it('should handle Swedish characters in keys', () => {
			const html = `
				<html>
					<body>
						<dl>
							<dt>Märke</dt>
							<dd>Škoda</dd>
							<dt>Modellår</dt>
							<dd>2019</dd>
							<dt>Antal ägare</dt>
							<dd>1</dd>
						</dl>
					</body>
				</html>
			`;

			const result = parseBlocketDetailHTML(html);

			expect(result).not.toBeNull();
			expect(result?.make).toBe('Škoda');
			expect(result?.year).toBe(2019);
			expect(result?.owners).toBe(1);
		});

		it('should extract year from modellår with extra text', () => {
			const html = `
				<html>
					<body>
						<dl>
							<dt>Märke</dt>
							<dd>BMW</dd>
							<dt>Modellår</dt>
							<dd>Årsmodell 2018</dd>
						</dl>
					</body>
				</html>
			`;

			const result = parseBlocketDetailHTML(html);

			expect(result).not.toBeNull();
			expect(result?.make).toBe('BMW');
			expect(result?.year).toBe(2018);
		});
	});

	describe('calculateMonthsUntilDate', () => {
		it('should calculate months correctly for future dates', () => {
			const now = new Date();
			const futureDate = new Date(now);
			futureDate.setMonth(futureDate.getMonth() + 14);
			
			const dateStr = futureDate.toISOString().split('T')[0];
			const months = calculateMonthsUntilDate(dateStr);

			expect(months).toBeGreaterThanOrEqual(13);
			expect(months).toBeLessThanOrEqual(15);
		});

		it('should return negative months for past dates', () => {
			const now = new Date();
			const pastDate = new Date(now);
			pastDate.setMonth(pastDate.getMonth() - 6);
			
			const dateStr = pastDate.toISOString().split('T')[0];
			const months = calculateMonthsUntilDate(dateStr);

			expect(months).toBeLessThan(0);
			expect(months).toBeGreaterThanOrEqual(-7);
			expect(months).toBeLessThanOrEqual(-5);
		});

		it('should handle dates around current month', () => {
			const now = new Date();
			const dateStr = now.toISOString().split('T')[0];
			const months = calculateMonthsUntilDate(dateStr);

			expect(months).toBeGreaterThanOrEqual(-1);
			expect(months).toBeLessThanOrEqual(1);
		});

		it('should return null for invalid date formats', () => {
			expect(calculateMonthsUntilDate('invalid')).toBeNull();
			expect(calculateMonthsUntilDate('2027-13-45')).toBeNull();
			expect(calculateMonthsUntilDate('not-a-date')).toBeNull();
		});

		it('should parse standard YYYY-MM-DD format', () => {
			const months = calculateMonthsUntilDate('2027-08-15');
			
			expect(months).not.toBeNull();
			expect(typeof months).toBe('number');
		});
	});
});
