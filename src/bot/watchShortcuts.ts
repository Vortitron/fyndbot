export interface BlocketSearchParams {
	category?: string;
	subcategory?: string;
	region?: string;
}

export interface ResolvedWatch {
	url: string;
	category: string | null;
	region: string | null;
}

const CATEGORY_MAP: Record<string, { slug: string; label: string; subcategory?: string }> = {
	fordon: { slug: 'fordon', label: 'Fordon' },
	bilar: { slug: 'fordon', label: 'Fordon', subcategory: 'bilar' },
	cars: { slug: 'fordon', label: 'Fordon', subcategory: 'bilar' },
	elektronik: { slug: 'elektronik', label: 'Elektronik' },
	datorer: { slug: 'datorer_tillbehor', label: 'Datorer & Tillbehör' },
	datorer_tillbehor: { slug: 'datorer_tillbehor', label: 'Datorer & Tillbehör' },
	mobiler: { slug: 'mobiler_tillbehor', label: 'Mobiler & Tillbehör' },
	mobiler_tillbehor: { slug: 'mobiler_tillbehor', label: 'Mobiler & Tillbehör' },
	bostad: { slug: 'bostad', label: 'Bostad' },
	fritid: { slug: 'fritid_hobby', label: 'Fritid & Hobby' },
	fritid_hobby: { slug: 'fritid_hobby', label: 'Fritid & Hobby' },
	personligt: { slug: 'personligt', label: 'Personligt' },
	hem: { slug: 'home_garden', label: 'Hem & Trädgård' },
	home_garden: { slug: 'home_garden', label: 'Hem & Trädgård' },
	mobler: { slug: 'home_garden', label: 'Hem & Trädgård' },
	barn: { slug: 'barn_barnartiklar', label: 'Barn & Barnartiklar' },
	barn_barnartiklar: { slug: 'barn_barnartiklar', label: 'Barn & Barnartiklar' },
	verktyg: { slug: 'tools', label: 'Verktyg' },
	tools: { slug: 'tools', label: 'Verktyg' },
};

const REGION_MAP: Record<string, { slug: string; label: string }> = {
	hela_sverige: { slug: 'hela_sverige', label: 'Hela Sverige' },
	skane: { slug: 'skane', label: 'Skåne' },
	skåne: { slug: 'skane', label: 'Skåne' },
	stockholm: { slug: 'stockholm', label: 'Stockholm' },
	goteborg: { slug: 'vastra_gotalands_lan', label: 'Göteborg' },
	göteborg: { slug: 'vastra_gotalands_lan', label: 'Göteborg' },
	malmo: { slug: 'skane', label: 'Malmö' },
	malmö: { slug: 'skane', label: 'Malmö' },
	uppsala: { slug: 'uppsala', label: 'Uppsala' },
	halland: { slug: 'halland', label: 'Halland' },
	blekinge: { slug: 'blekinge', label: 'Blekinge' },
	kronoberg: { slug: 'kronoberg', label: 'Kronoberg' },
	kalmar: { slug: 'kalmar', label: 'Kalmar' },
	jonkoping: { slug: 'jonkoping', label: 'Jönköping' },
	jönköping: { slug: 'jonkoping', label: 'Jönköping' },
	ostergotland: { slug: 'ostergotland', label: 'Östergötland' },
	östergötland: { slug: 'ostergotland', label: 'Östergötland' },
	sodermanland: { slug: 'sodermanland', label: 'Södermanland' },
	södermanland: { slug: 'sodermanland', label: 'Södermanland' },
	vastmanland: { slug: 'vastmanland', label: 'Västmanland' },
	västmanland: { slug: 'vastmanland', label: 'Västmanland' },
	orebro: { slug: 'orebro', label: 'Örebro' },
	örebro: { slug: 'orebro', label: 'Örebro' },
	varmland: { slug: 'varmland', label: 'Värmland' },
	värmland: { slug: 'varmland', label: 'Värmland' },
	dalarna: { slug: 'dalarna', label: 'Dalarna' },
	gavleborg: { slug: 'gavleborg', label: 'Gävleborg' },
	gävleborg: { slug: 'gavleborg', label: 'Gävleborg' },
	vasternorrland: { slug: 'vasternorrland', label: 'Västernorrland' },
	västernorrland: { slug: 'vasternorrland', label: 'Västernorrland' },
	jamtland: { slug: 'jamtland', label: 'Jämtland' },
	jämtland: { slug: 'jamtland', label: 'Jämtland' },
	vasterbotten: { slug: 'vasterbotten', label: 'Västerbotten' },
	västerbotten: { slug: 'vasterbotten', label: 'Västerbotten' },
	norrbotten: { slug: 'norrbotten', label: 'Norrbotten' },
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
	
	let category: string | null = null;
	let subcategory: string | null = null;
	let region: string | null = null;

	for (const word of words) {
		const normalized = normalizeSwedish(word);
		
		if (CATEGORY_MAP[word] || CATEGORY_MAP[normalized]) {
			const cat = CATEGORY_MAP[word] || CATEGORY_MAP[normalized];
			category = cat.slug;
			if (cat.subcategory) {
				subcategory = cat.subcategory;
			}
		}
		
		if (REGION_MAP[word] || REGION_MAP[normalized]) {
			const reg = REGION_MAP[word] || REGION_MAP[normalized];
			region = reg.slug;
		}
	}

	if (!category && !region) {
		return null;
	}

	if (!category && region) {
		return null;
	}

	if (category && !region) {
		region = 'hela_sverige';
	}

	let url = `https://www.blocket.se/annonser/${region}/${category}`;
	if (subcategory) {
		url += `/${subcategory}`;
	}

	return {
		url,
		category: category || null,
		region: region || null,
	};
}

export function getCategoryButtons(): Array<{ text: string; callbackData: string }> {
	return [
		{ text: '🚗 Fordon', callbackData: 'wcat:fordon' },
		{ text: '🚙 Bilar', callbackData: 'wcat:fordon/bilar' },
		{ text: '💻 Elektronik', callbackData: 'wcat:elektronik' },
		{ text: '🖥️ Datorer', callbackData: 'wcat:datorer_tillbehor' },
		{ text: '📱 Mobiler', callbackData: 'wcat:mobiler_tillbehor' },
		{ text: '🏠 Bostad', callbackData: 'wcat:bostad' },
		{ text: '⚽ Fritid', callbackData: 'wcat:fritid_hobby' },
		{ text: '🪑 Hem & Trädgård', callbackData: 'wcat:home_garden' },
		{ text: '👶 Barn', callbackData: 'wcat:barn_barnartiklar' },
		{ text: '🔧 Verktyg', callbackData: 'wcat:tools' },
	];
}

export function getRegionButtons(): Array<{ text: string; callbackData: string }> {
	return [
		{ text: '🇸🇪 Hela Sverige', callbackData: 'wreg:hela_sverige' },
		{ text: 'Stockholm', callbackData: 'wreg:stockholm' },
		{ text: 'Skåne', callbackData: 'wreg:skane' },
		{ text: 'Göteborg', callbackData: 'wreg:vastra_gotalands_lan' },
		{ text: 'Uppsala', callbackData: 'wreg:uppsala' },
		{ text: 'Halland', callbackData: 'wreg:halland' },
		{ text: 'Blekinge', callbackData: 'wreg:blekinge' },
		{ text: 'Kronoberg', callbackData: 'wreg:kronoberg' },
		{ text: 'Kalmar', callbackData: 'wreg:kalmar' },
		{ text: 'Jönköping', callbackData: 'wreg:jonkoping' },
		{ text: 'Östergötland', callbackData: 'wreg:ostergotland' },
		{ text: 'Södermanland', callbackData: 'wreg:sodermanland' },
		{ text: 'Västmanland', callbackData: 'wreg:vastmanland' },
		{ text: 'Örebro', callbackData: 'wreg:orebro' },
		{ text: 'Värmland', callbackData: 'wreg:varmland' },
		{ text: 'Dalarna', callbackData: 'wreg:dalarna' },
		{ text: 'Gävleborg', callbackData: 'wreg:gavleborg' },
		{ text: 'Västernorrland', callbackData: 'wreg:vasternorrland' },
		{ text: 'Jämtland', callbackData: 'wreg:jamtland' },
		{ text: 'Västerbotten', callbackData: 'wreg:vasterbotten' },
		{ text: 'Norrbotten', callbackData: 'wreg:norrbotten' },
	];
}

export function buildWatchUrl(category: string, region: string): string {
	const parts = category.split('/');
	let url = `https://www.blocket.se/annonser/${region}/${parts[0]}`;
	if (parts[1]) {
		url += `/${parts[1]}`;
	}
	return url;
}
