import fetch from 'node-fetch';
import type { BlocketListing } from '../types/index.js';

const BLOCKET_BASE = 'https://www.blocket.se';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export async function fetchBlocketSearch(url: string): Promise<BlocketListing[]> {
	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': USER_AGENT,
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
			},
		});

		if (!response.ok) {
			throw new Error(`Blocket fetch failed: ${response.status}`);
		}

		const html = await response.text();
		
		const listings = parseBlocketHTML(html);
		
		return listings;
	} catch (error) {
		console.error('Error fetching Blocket:', error);
		return [];
	}
}

export function parseBlocketHTML(html: string): BlocketListing[] {
	const listings: BlocketListing[] = [];

	const jsonLdMatch = html.match(/<script[^>]*id="seoStructuredData"[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
	if (jsonLdMatch) {
		try {
			const data = JSON.parse(jsonLdMatch[1]);
			const itemList = data?.mainEntity?.itemListElement;
			
			if (itemList && Array.isArray(itemList)) {
				for (const listItem of itemList) {
					const product = listItem.item;
					if (product && product['@type'] === 'Product') {
						const urlMatch = product.url?.match(/\/item\/(\d+)/);
						const id = urlMatch?.[1] || '';
						
						const title = product.name || 'Untitled';
						const price = product.offers?.price ? parseInt(product.offers.price, 10) : null;
						const currency = product.offers?.priceCurrency || 'SEK';
						const url = product.url || '';
						const imageUrl = product.image || null;
						const description = product.description || null;
						
						listings.push({
							id,
							title,
							price,
							currency,
							url,
							imageUrl,
							publishedAt: new Date(),
							location: null,
							category: null,
							description,
						});
					}
				}
			}
		} catch (err) {
			console.warn('Failed to parse Blocket JSON-LD:', err);
		}
	}

	if (listings.length === 0) {
		console.error('CRITICAL: Blocket parser returned zero listings from non-empty HTML. HTML length:', html.length);
		console.error('This likely indicates a parser failure. Please investigate immediately.');
		throw new Error('Blocket parser failed: zero listings extracted from search page');
	}

	return listings;
}

export async function fetchBlocketAd(url: string): Promise<BlocketListing | null> {
	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': USER_AGENT,
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
			},
		});

		if (!response.ok) {
			return null;
		}

		const html = await response.text();
		return parseBlocketAdHTML(html, url);
	} catch (error) {
		console.error('Error fetching Blocket ad:', error);
		return null;
	}
}

function parseBlocketAdHTML(html: string, url: string): BlocketListing | null {
	const scriptMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
	
	if (scriptMatch) {
		try {
			const data = JSON.parse(scriptMatch[1]);
			const ad = data?.props?.pageProps?.ad;
			
			if (ad) {
				return {
					id: ad.ad_id?.toString() || '',
					title: ad.subject || 'Untitled',
					price: ad.price?.value || null,
					currency: ad.price?.currency || 'SEK',
					url,
					imageUrl: ad.images?.[0]?.url || null,
					publishedAt: ad.list_time ? new Date(ad.list_time) : new Date(),
					location: ad.location?.[0]?.name || null,
					category: ad.category?.name || null,
					description: ad.body || null,
				};
			}
		} catch (err) {
			console.warn('Failed to parse Blocket ad JSON:', err);
		}
	}

	const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/);
	const priceMatch = html.match(/(\d[\d\s]*)\s*kr/);
	const idMatch = url.match(/\/annons\/[^\/]+\/(\d+)/);

	if (titleMatch && idMatch) {
		return {
			id: idMatch[1],
			title: titleMatch[1].replace(/<[^>]*>/g, '').trim(),
			price: priceMatch ? parseInt(priceMatch[1].replace(/\s/g, ''), 10) : null,
			currency: 'SEK',
			url,
			imageUrl: null,
			publishedAt: new Date(),
			location: null,
			category: null,
			description: null,
		};
	}

	return null;
}

export function extractRegistrationNumber(text: string): string | null {
	const regNrPattern = /\b[A-Z]{3}\s?\d{2}[A-Z0-9]\b/i;
	const match = text.match(regNrPattern);
	return match ? match[0].replace(/\s/g, '').toUpperCase() : null;
}
