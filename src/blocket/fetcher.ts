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
		if (error instanceof Error && error.message.includes('Blocket parser failed')) {
			throw error;
		}
		return [];
	}
}

function parseBlocketHTML(html: string): BlocketListing[] {
	const listings: BlocketListing[] = [];

	// Blocket (2026-09+) embeds search results as JSON-LD ItemList in seoStructuredData.
	const jsonLdMatch = html.match(/<script[^>]*id="seoStructuredData"[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s)
		|| html.match(/<script[^>]*type="application\/ld\+json"[^>]*id="seoStructuredData"[^>]*>(.*?)<\/script>/s);
	if (jsonLdMatch) {
		try {
			const data = JSON.parse(jsonLdMatch[1]);
			const itemList = data?.mainEntity?.itemListElement;
			if (Array.isArray(itemList)) {
				for (const listItem of itemList) {
					const product = listItem?.item;
					if (!product || product['@type'] !== 'Product') continue;
					const url: string = product.url || '';
					const idMatch = url.match(/\/(?:item|annons)\/[^/]*\/(\d+)/) || url.match(/\/(\d+)(?:\?|$)/);
					const id = idMatch?.[1] || '';
					if (!id) continue;
					const priceRaw = product.offers?.price;
					const price = priceRaw != null ? parseInt(String(priceRaw).replace(/\s/g, ''), 10) : null;
					listings.push({
						id,
						title: product.name || 'Untitled',
						price: Number.isFinite(price as number) ? price : null,
						currency: product.offers?.priceCurrency || 'SEK',
						url: url.startsWith('http') ? url : `${BLOCKET_BASE}${url}`,
						imageUrl: product.image || null,
						publishedAt: new Date(),
						location: null,
						category: null,
						description: product.description || null,
					});
				}
			}
		} catch (err) {
			console.warn('Failed to parse Blocket JSON-LD:', err);
		}
	}

	// Legacy fallback: __NEXT_DATA__ (pre-2026-09)
	if (listings.length === 0) {
		const scriptMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
		if (scriptMatch) {
			try {
				const data = JSON.parse(scriptMatch[1]);
				const searchData = data?.props?.pageProps?.initialData?.data;
				if (searchData && Array.isArray(searchData)) {
					for (const item of searchData) {
						if (item.type === 'ad') {
							const ad = item.ad;
							listings.push({
								id: ad.ad_id?.toString() || '',
								title: ad.subject || 'Untitled',
								price: ad.price?.value || null,
								currency: ad.price?.currency || 'SEK',
								url: `${BLOCKET_BASE}${ad.url || ''}`,
								imageUrl: ad.images?.[0]?.url || null,
								publishedAt: ad.list_time ? new Date(ad.list_time) : new Date(),
								location: ad.location?.[0]?.name || null,
								category: ad.category?.name || null,
								description: ad.body || null,
							});
						}
					}
				}
			} catch (err) {
				console.warn('Failed to parse Blocket __NEXT_DATA__:', err);
			}
		}
	}

	if (html.length > 1000 && listings.length === 0) {
		console.error('CRITICAL: Blocket parser returned zero listings from non-empty HTML. HTML length:', html.length);
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

export function extractSellerFromUrl(url: string): { sellerUrl: string; sellerName: string | null } | null {
	const sellerPattern = /blocket\.se\/annonsorer\/([^\/\?]+)/;
	const match = url.match(sellerPattern);
	
	if (match) {
		const sellerSlug = match[1];
		return {
			sellerUrl: `https://www.blocket.se/annonsorer/${sellerSlug}`,
			sellerName: sellerSlug.replace(/[-_]/g, ' '),
		};
	}

	const storePattern = /st=s&st_s=([^&]+)/;
	const storeMatch = url.match(storePattern);
	
	if (storeMatch) {
		const storeId = decodeURIComponent(storeMatch[1]);
		return {
			sellerUrl: url,
			sellerName: storeId,
		};
	}

	return null;
}
