import type { BlocketListing, BargainScore } from '../types/index.js';
import { config } from '../config.js';
import fetch from 'node-fetch';

export async function scoreListing(listing: BlocketListing): Promise<BargainScore> {
	if (config.llmApiKey && config.llmApiUrl) {
		try {
			return await scoreWithLLM(listing);
		} catch (error) {
			console.warn('LLM scoring failed, falling back to heuristic:', error);
		}
	}

	return scoreWithHeuristic(listing);
}

async function scoreWithLLM(listing: BlocketListing): Promise<BargainScore> {
	const prompt = `You are a Swedish bargain-hunting expert. Rate this Blocket listing from 1-10 (10=amazing deal, 1=overpriced).

Title: ${listing.title}
Price: ${listing.price ? listing.price + ' ' + listing.currency : 'Not specified'}
Category: ${listing.category || 'Unknown'}
Location: ${listing.location || 'Unknown'}
Description: ${listing.description || 'No description'}

Respond with JSON only:
{
  "score": <number 1-10>,
  "reason": "<one line explanation in English>",
  "confidence": <0.0-1.0>
}`;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${config.llmApiKey}`,
	};

	if (config.llmApiUrl?.includes('openrouter.ai')) {
		headers['HTTP-Referer'] = 'https://fynd.vome.io';
		headers['X-Title'] = 'Fyndbot';
	}

	const response = await fetch(`${config.llmApiUrl}/chat/completions`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			model: config.llmModel,
			messages: [
				{ role: 'system', content: 'You are a helpful assistant that responds only with valid JSON.' },
				{ role: 'user', content: prompt },
			],
			temperature: 0.7,
			max_tokens: 150,
		}),
	});

	if (!response.ok) {
		throw new Error(`LLM API failed: ${response.status}`);
	}

	const data = await response.json() as any;
	const content = data.choices?.[0]?.message?.content;
	
	if (!content) {
		throw new Error('No content in LLM response');
	}

	const parsed = JSON.parse(content.trim());
	
	return {
		score: Math.max(1, Math.min(10, parsed.score)),
		reason: parsed.reason || 'No reason provided',
		confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
	};
}

function scoreWithHeuristic(listing: BlocketListing): BargainScore {
	let score = 5.0;
	let reasons: string[] = [];

	if (listing.price === null || listing.price === 0) {
		return {
			score: 5,
			reason: 'Price not specified',
			confidence: 0.3,
		};
	}

	const age = Date.now() - listing.publishedAt.getTime();
	const ageHours = age / (1000 * 60 * 60);

	if (ageHours < 1) {
		score += 2;
		reasons.push('brand new listing');
	} else if (ageHours < 6) {
		score += 1;
		reasons.push('fresh listing');
	}

	const titleLower = listing.title.toLowerCase();
	
	if (titleLower.includes('ny') || titleLower.includes('oöppnad') || titleLower.includes('oanvänd')) {
		score += 1.5;
		reasons.push('new/unused condition');
	}

	if (titleLower.includes('bra skick') || titleLower.includes('fint skick')) {
		score += 0.5;
		reasons.push('good condition');
	}

	if (titleLower.includes('billig') || titleLower.includes('prutbar') || titleLower.includes('säljes snabbt')) {
		score += 1;
		reasons.push('motivated seller');
	}

	if (listing.price < 500) {
		score += 1;
		reasons.push('very affordable');
	} else if (listing.price < 2000) {
		score += 0.5;
	}

	if (listing.imageUrl) {
		score += 0.5;
		reasons.push('has photos');
	}

	score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));

	const reason = reasons.length > 0 
		? reasons.slice(0, 2).join(', ')
		: 'standard listing';

	return {
		score,
		reason: reason.charAt(0).toUpperCase() + reason.slice(1),
		confidence: 0.6,
	};
}
