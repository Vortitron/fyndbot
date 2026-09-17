export interface ResolvedWatch {
	url: string;
	category: string | null;
	region: string | null;
}

const CATEGORY_MAP: Record<string, { categoryId: string; label: string; isCar?: boolean }> = {
	bilar: { categoryId: 'car', label: 'Bilar', isCar: true },
	cars: { categoryId: 'car', label: 'Bilar', isCar: true },
	mobler: { categoryId: '0.78', label: 'Möbler' },
	möbler: { categoryId: '0.78', label: 'Möbler' },
	klader: { categoryId: '0.71', label: 'Kläder' },
	kläder: { categoryId: '0.71', label: 'Kläder' },
	elektronik: { categoryId: '0.93', label: 'Elektronik' },
	barn: { categoryId: '0.68', label: 'Barn' },
	bygg: { categoryId: '0.67', label: 'Bygg' },
	hobby: { categoryId: '0.86', label: 'Hobby' },
	sport: { categoryId: '0.69', label: 'Sport' },
	djur: { categoryId: '0.77', label: 'Djur' },
	fordon: { categoryId: '0.90', label: 'Fordonstillbehör' },
	fordonstillbehor: { categoryId: '0.90', label: 'Fordonstillbehör' },
	antikt: { categoryId: '0.76', label: 'Antikt' },
	affarr: { categoryId: '0.91', label: 'Affär' },
	affar: { categoryId: '0.91', label: 'Affär' },
};

const LOCATION_MAP: Record<string, { locationId: string; label: string }> = {
	skane: { locationId: '0.300012', label: 'Skåne' },
	skåne: { locationId: '0.300012', label: 'Skåne' },
	stockholm: { locationId: '0.300001', label: 'Stockholm' },
	vastra_gotaland: { locationId: '0.300014', label: 'Västra Götaland' },
	vastra_götaland: { locationId: '0.300014', label: 'Västra Götaland' },
	goteborg: { locationId: '0.300014', label: 'Göteborg' },
	göteborg: { locationId: '0.300014', label: 'Göteborg' },
	halland: { locationId: '0.300013', label: 'Halland' },
	blekinge: { locationId: '0.300010', label: 'Blekinge' },
	kronoberg: { locationId: '0.300007', label: 'Kronoberg' },
	kalmar: { locationId: '0.300008', label: 'Kalmar' },
	jonkoping: { locationId: '0.300006', label: 'Jönköping' },
	jönköping: { locationId: '0.300006', label: 'Jönköping' },
	ostergotland: { locationId: '0.300005', label: 'Östergötland' },
	östergötland: { locationId: '0.300005', label: 'Östergötland' },
	uppsala: { locationId: '0.300003', label: 'Uppsala' },
	sodermanland: { locationId: '0.300004', label: 'Södermanland' },
	södermanland: { locationId: '0.300004', label: 'Södermanland' },
	orebro: { locationId: '0.300018', label: 'Örebro' },
	örebro: { locationId: '0.300018', label: 'Örebro' },
	vastmanland: { locationId: '0.300019', label: 'Västmanland' },
	västmanland: { locationId: '0.300019', label: 'Västmanland' },
	varmland: { locationId: '0.300017', label: 'Värmland' },
	värmland: { locationId: '0.300017', label: 'Värmland' },
	dalarna: { locationId: '0.300020', label: 'Dalarna' },
	gavleborg: { locationId: '0.300021', label: 'Gävleborg' },
	gävleborg: { locationId: '0.300021', label: 'Gävleborg' },
	vasternorrland: { locationId: '0.300022', label: 'Västernorrland' },
	västernorrland: { locationId: '0.300022', label: 'Västernorrland' },
	jamtland: { locationId: '0.300023', label: 'Jämtland' },
	jämtland: { locationId: '0.300023', label: 'Jämtland' },
	vasterbotten: { locationId: '0.300024', label: 'Västerbotten' },
	västerbotten: { locationId: '0.300024', label: 'Västerbotten' },
	norrbotten: { locationId: '0.300025', label: 'Norrbotten' },
	gotland: { locationId: '0.300009', label: 'Gotland' },
};

function normalizeSwedish(text: string): string {
	return text
		.toLowerCase()
		.replace(/å/g, 'a')
		.replace(/ä/g, 'a')
		.replace(/ö/g, 'o')
		.trim();
}

export function parseWatchShortcut(text: string): ResolvedWatch | null {
	if (text.includes('blocket.se')) {
		return null;
	}

	const words = text.toLowerCase().split(/\s+/);
	
	let category: { categoryId: string; label: string; isCar?: boolean } | null = null;
	let location: string | null = null;

	for (const word of words) {
		const normalized = normalizeSwedish(word);
		
		if (CATEGORY_MAP[word] || CATEGORY_MAP[normalized]) {
			category = CATEGORY_MAP[word] || CATEGORY_MAP[normalized];
		}
		
		if (LOCATION_MAP[word] || LOCATION_MAP[normalized]) {
			const loc = LOCATION_MAP[word] || LOCATION_MAP[normalized];
			location = loc.locationId;
		}
	}

	if (!category) {
		return null;
	}

	let url: string;
	if (category.isCar) {
		url = 'https://www.blocket.se/mobility/search/car';
		if (location) {
			url += `?location=${location}`;
		}
	} else {
		url = `https://www.blocket.se/recommerce/forsale/search?category=${category.categoryId}`;
		if (location) {
			url += `&location=${location}`;
		}
	}

	return {
		url,
		category: category.categoryId,
		region: location,
	};
}

export function getCategoryButtons(): Array<{ text: string; callbackData: string }> {
	return [
		{ text: '🚙 Bilar', callbackData: 'wcat:car' },
		{ text: '🔧 Fordonstillbehör', callbackData: 'wcat:0.90' },
		{ text: '💻 Elektronik', callbackData: 'wcat:0.93' },
		{ text: '🪑 Möbler', callbackData: 'wcat:0.78' },
		{ text: '👕 Kläder', callbackData: 'wcat:0.71' },
		{ text: '👶 Barn', callbackData: 'wcat:0.68' },
		{ text: '🏗️ Bygg', callbackData: 'wcat:0.67' },
		{ text: '🎨 Hobby', callbackData: 'wcat:0.86' },
		{ text: '⚽ Sport', callbackData: 'wcat:0.69' },
		{ text: '🐕 Djur', callbackData: 'wcat:0.77' },
		{ text: '🏛️ Antikt', callbackData: 'wcat:0.76' },
		{ text: '🏢 Affär', callbackData: 'wcat:0.91' },
	];
}

export function getRegionButtons(): Array<{ text: string; callbackData: string }> {
	return [
		{ text: '🇸🇪 Hela Sverige', callbackData: 'wreg:' },
		{ text: 'Stockholm', callbackData: 'wreg:0.300001' },
		{ text: 'Skåne', callbackData: 'wreg:0.300012' },
		{ text: 'Västra Götaland', callbackData: 'wreg:0.300014' },
		{ text: 'Uppsala', callbackData: 'wreg:0.300003' },
		{ text: 'Halland', callbackData: 'wreg:0.300013' },
		{ text: 'Blekinge', callbackData: 'wreg:0.300010' },
		{ text: 'Kronoberg', callbackData: 'wreg:0.300007' },
		{ text: 'Kalmar', callbackData: 'wreg:0.300008' },
		{ text: 'Jönköping', callbackData: 'wreg:0.300006' },
		{ text: 'Östergötland', callbackData: 'wreg:0.300005' },
		{ text: 'Södermanland', callbackData: 'wreg:0.300004' },
		{ text: 'Västmanland', callbackData: 'wreg:0.300019' },
		{ text: 'Örebro', callbackData: 'wreg:0.300018' },
		{ text: 'Värmland', callbackData: 'wreg:0.300017' },
		{ text: 'Dalarna', callbackData: 'wreg:0.300020' },
		{ text: 'Gävleborg', callbackData: 'wreg:0.300021' },
		{ text: 'Västernorrland', callbackData: 'wreg:0.300022' },
		{ text: 'Jämtland', callbackData: 'wreg:0.300023' },
		{ text: 'Västerbotten', callbackData: 'wreg:0.300024' },
		{ text: 'Norrbotten', callbackData: 'wreg:0.300025' },
		{ text: 'Gotland', callbackData: 'wreg:0.300009' },
	];
}

export function buildWatchUrl(category: string, region: string): string {
	if (category === 'car') {
		let url = 'https://www.blocket.se/mobility/search/car';
		if (region) {
			url += `?location=${region}`;
		}
		return url;
	}

	let url = `https://www.blocket.se/recommerce/forsale/search?category=${category}`;
	if (region) {
		url += `&location=${region}`;
	}
	return url;
}
