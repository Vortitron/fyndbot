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
	const prompt = `You are a sharp Swedish Blocket deal analyst. Rate this listing 1-10 (10=amazing deal, 1=overpriced). Be calibrated: most listings 4-6; reserve 8+ for clear underpricing or rare urgency; 9-10 rare.

Title: ${listing.title}
Price: ${listing.price ? listing.price + ' ' + listing.currency : 'Not specified'}
Category: ${listing.category || 'Unknown'}
Location: ${listing.location || 'Unknown'}
Description: ${listing.description || 'No description'}

Return JSON with:
- score: 1-10 number (one decimal ok)
- reason: ONE punchy sentence in English citing concrete signals (price vs category, condition words like "ny"/"oöppnad", urgency like "snabbt"/"prutbar", location, photo presence) — no fluff
- confidence: 0.0-1.0`;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${config.llmApiKey}`,
	};

	if (config.llmApiUrl?.includes('openrouter.ai')) {
		headers['HTTP-Referer'] = 'https://fynd.vome.io';
		headers['X-Title'] = 'Fyndbot';
	}

	const requestBody: any = {
		model: config.llmModel,
		messages: [
			{ role: 'user', content: prompt },
		],
		temperature: 0.3,
		max_tokens: 120,
	};

	if (!config.llmApiUrl?.includes('openrouter.ai')) {
		requestBody.response_format = { type: 'json_object' };
	}

	const response = await fetch(`${config.llmApiUrl}/chat/completions`, {
		method: 'POST',
		headers,
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`LLM API failed: ${response.status} - ${errorText}`);
	}

	const data = await response.json() as any;
	const content = data.choices?.[0]?.message?.content;
	
	if (!content) {
		throw new Error('No content in LLM response');
	}

	let parsed: any;
	try {
		parsed = JSON.parse(content.trim());
	} catch (err) {
		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			parsed = JSON.parse(jsonMatch[0]);
		} else {
			throw new Error(`Failed to parse LLM response as JSON: ${content}`);
		}
	}
	
	return {
		score: Math.max(1, Math.min(10, Math.round((parsed.score || 5) * 10) / 10)),
		reason: (parsed.reason || 'No reason provided').trim(),
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
