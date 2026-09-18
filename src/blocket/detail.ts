import fetch from 'node-fetch';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export interface BlocketVehicleDetail {
	registrationNumber: string | null;
	nextInspectionDate: string | null;
	lastInspectionDate: string | null;
	monthsUntilInspection: number | null;
	make: string | null;
	model: string | null;
	year: number | null;
	mileage: number | null;
	owners: number | null;
}

export async function fetchBlocketDetail(url: string): Promise<BlocketVehicleDetail | null> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000);

		const response = await fetch(url, {
			headers: {
				'User-Agent': USER_AGENT,
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
			},
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			console.warn(`Failed to fetch Blocket detail: ${response.status}`);
			return null;
		}

		const html = await response.text();
		return parseBlocketDetailHTML(html);
	} catch (error) {
		console.error('Error fetching Blocket detail:', error);
		return null;
	}
}

export function parseBlocketDetailHTML(html: string): BlocketVehicleDetail | null {
	const result: BlocketVehicleDetail = {
		registrationNumber: null,
		nextInspectionDate: null,
		lastInspectionDate: null,
		monthsUntilInspection: null,
		make: null,
		model: null,
		year: null,
		mileage: null,
		owners: null,
	};

	// Strategy 1: Parse <dt>/<dd> pairs (most robust for HTML structure)
	const dtDdPairs = extractDtDdPairs(html);
	
	for (const [key, value] of dtDdPairs) {
		const lowerKey = key.toLowerCase();
		const trimmedValue = value.trim();

		if (lowerKey.includes('registreringsnummer')) {
			result.registrationNumber = trimmedValue.toUpperCase() || null;
		} else if (lowerKey.includes('nästa besiktningsdatum') || lowerKey.includes('nasta besiktningsdatum')) {
			result.nextInspectionDate = trimmedValue || null;
		} else if (lowerKey.includes('senaste besiktningsdatum')) {
			result.lastInspectionDate = trimmedValue || null;
		} else if ((lowerKey.includes('märke') || lowerKey.includes('marke')) && !lowerKey.includes('modell')) {
			result.make = trimmedValue || null;
		} else if (lowerKey === 'modell') {
			result.model = trimmedValue || null;
		} else if (lowerKey.includes('modellår') || lowerKey.includes('modellar')) {
			const yearMatch = trimmedValue.match(/\d{4}/);
			result.year = yearMatch ? parseInt(yearMatch[0], 10) : null;
		} else if (lowerKey.includes('miltal')) {
			const mileageMatch = trimmedValue.match(/(\d[\d\s]*)/);
			if (mileageMatch) {
				result.mileage = parseInt(mileageMatch[1].replace(/\s/g, ''), 10);
			}
		} else if (lowerKey.includes('antal ägare') || lowerKey.includes('antal agare')) {
			const ownersMatch = trimmedValue.match(/\d+/);
			result.owners = ownersMatch ? parseInt(ownersMatch[0], 10) : null;
		}
	}

	// Strategy 2: Parse JSON attributes (backup for structured data)
	const jsonAttributes = extractJsonAttributes(html);
	
	for (const attr of jsonAttributes) {
		const key = attr.key?.toLowerCase() || '';
		const value = Array.isArray(attr.value) && attr.value.length > 0 ? attr.value[0] : null;

		if (key === 'registration_number' && value && !result.registrationNumber) {
			result.registrationNumber = value.toUpperCase();
		} else if ((key === 'next_inspection_date' || key.includes('nasta_besiktning')) && value && !result.nextInspectionDate) {
			result.nextInspectionDate = value;
		} else if ((key === 'last_inspection_date' || key.includes('senaste_besiktning')) && value && !result.lastInspectionDate) {
			result.lastInspectionDate = value;
		} else if (key === 'make' && value && !result.make) {
			result.make = value;
		} else if (key === 'model' && value && !result.model) {
			result.model = value;
		} else if ((key === 'model_year' || key === 'year') && value && !result.year) {
			const yearMatch = value.match(/\d{4}/);
			result.year = yearMatch ? parseInt(yearMatch[0], 10) : null;
		} else if (key === 'mileage' && value && !result.mileage) {
			const mileageMatch = value.match(/\d+/);
			result.mileage = mileageMatch ? parseInt(mileageMatch[0], 10) : null;
		} else if (key === 'owners' && value && !result.owners) {
			const ownersMatch = value.match(/\d+/);
			result.owners = ownersMatch ? parseInt(ownersMatch[0], 10) : null;
		}
	}

	// Calculate months until inspection if we have the date
	if (result.nextInspectionDate) {
		result.monthsUntilInspection = calculateMonthsUntilDate(result.nextInspectionDate);
	}

	// Return null if we got nothing useful
	if (!result.registrationNumber && !result.nextInspectionDate && !result.make) {
		return null;
	}

	return result;
}

function extractDtDdPairs(html: string): Array<[string, string]> {
	const pairs: Array<[string, string]> = [];
	
	// Match <dt>key</dt> followed by <dd>value</dd>
	const dtDdPattern = /<dt[^>]*>(.*?)<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/gis;
	let match;
	
	while ((match = dtDdPattern.exec(html)) !== null) {
		const key = stripHtmlTags(match[1]).trim();
		const value = stripHtmlTags(match[2]).trim();
		if (key && value) {
			pairs.push([key, value]);
		}
	}
	
	return pairs;
}

function extractJsonAttributes(html: string): Array<{ key: string; value: string[] }> {
	const attributes: Array<{ key: string; value: string[] }> = [];
	
	// Look for JSON patterns like {"key":"registration_number","value":["YPR567"]}
	const jsonPattern = /\{\s*"key"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*\[([^\]]*)\]\s*\}/g;
	let match;
	
	while ((match = jsonPattern.exec(html)) !== null) {
		const key = match[1];
		const valuesStr = match[2];
		
		// Parse the array values
		const valueMatches = valuesStr.matchAll(/"([^"]*)"/g);
		const values = Array.from(valueMatches, m => m[1]);
		
		attributes.push({ key, value: values });
	}
	
	return attributes;
}

function stripHtmlTags(html: string): string {
	return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

export function calculateMonthsUntilDate(dateStr: string): number | null {
	// Expected format: YYYY-MM-DD
	const dateMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
	if (!dateMatch) {
		return null;
	}

	const targetDate = new Date(dateStr);
	if (isNaN(targetDate.getTime())) {
		return null;
	}

	const now = new Date();
	const diffMs = targetDate.getTime() - now.getTime();
	const diffDays = diffMs / (1000 * 60 * 60 * 24);
	const diffMonths = Math.round(diffDays / 30.44); // Average days per month

	return diffMonths;
}
