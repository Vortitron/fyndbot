export interface BlocketListing {
	id: string;
	title: string;
	price: number | null;
	currency: string;
	url: string;
	imageUrl: string | null;
	publishedAt: Date;
	location: string | null;
	category: string | null;
	description: string | null;
}

export interface Watch {
	id: number;
	userId: number;
	url: string;
	name: string | null;
	lastChecked: Date;
	createdAt: Date;
	active: boolean;
}

export interface User {
	id: number;
	telegramId: number;
	username: string | null;
	isPro: boolean;
	inspectCount: number;
	inspectResetAt: Date;
	createdAt: Date;
}

export interface BargainScore {
	score: number;
	reason: string;
	confidence: number;
}

export interface VehicleEnrichment {
	registrationNumber: string;
	monthsUntilInspection: number | null;
	monthsUntilTax: number | null;
	monthsInTraffic: number | null;
	make: string | null;
	model: string | null;
	year: number | null;
}

export interface Config {
	telegramBotToken: string;
	databaseUrl: string;
	llmApiKey: string | null;
	llmApiUrl: string | null;
	stripeSecretKey: string | null;
	stripeWebhookSecret: string | null;
	pollIntervalMinutes: number;
	freeInspectWeeklyLimit: number;
	priceFree: number;
	priceProMonthly: number;
	priceInspect: number;
	nodeEnv: string;
	logLevel: string;
}
