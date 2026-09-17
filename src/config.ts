import dotenv from 'dotenv';
import type { Config } from './types/index.js';

dotenv.config();

function getEnvVar(key: string, defaultValue?: string): string {
	const value = process.env[key];
	if (!value && defaultValue === undefined) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value || defaultValue!;
}

function getEnvNumber(key: string, defaultValue: number): number {
	const value = process.env[key];
	if (!value) return defaultValue;
	const parsed = parseInt(value, 10);
	if (isNaN(parsed)) {
		throw new Error(`Invalid number for ${key}: ${value}`);
	}
	return parsed;
}

function parseCommaSeparatedNumbers(value: string | undefined): number[] {
	if (!value || !value.trim()) return [];
	return value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}

function parseCommaSeparatedStrings(value: string | undefined): string[] {
	if (!value || !value.trim()) return [];
	return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

export const config: Config = {
	telegramBotToken: getEnvVar('TELEGRAM_BOT_TOKEN'),
	databaseUrl: getEnvVar('DATABASE_URL', './data/fyndbot.db'),
	llmApiKey: process.env.LLM_API_KEY || null,
	llmApiUrl: process.env.LLM_API_URL || null,
	llmModel: getEnvVar('LLM_MODEL', 'openai/gpt-4.1-mini'),
	stripeSecretKey: process.env.STRIPE_SECRET_KEY || null,
	stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
	stripePriceFyndbotPro: process.env.STRIPE_PRICE_FYNDBOT_PRO || null,
	stripeTestSecretKey: process.env.STRIPE_TEST_SECRET_KEY || null,
	stripeTestWebhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET || null,
	stripeTestPriceFyndbotPro: process.env.STRIPE_TEST_PRICE_FYNDBOT_PRO || null,
	stripeSandboxTelegramIds: parseCommaSeparatedNumbers(process.env.STRIPE_SANDBOX_TELEGRAM_IDS),
	stripeSandboxUsernames: parseCommaSeparatedStrings(process.env.STRIPE_SANDBOX_USERNAMES),
	publicBaseUrl: getEnvVar('PUBLIC_BASE_URL', 'https://fynd.vome.io'),
	pollIntervalMinutes: getEnvNumber('POLL_INTERVAL_MINUTES', 2),
	freeInspectWeeklyLimit: getEnvNumber('FREE_INSPECT_WEEKLY_LIMIT', 3),
	priceFree: getEnvNumber('PRICE_FREE', 0),
	priceProMonthly: getEnvNumber('PRICE_PRO_MONTHLY', 79),
	priceInspect: getEnvNumber('PRICE_INSPECT', 19),
	nodeEnv: getEnvVar('NODE_ENV', 'development'),
	logLevel: getEnvVar('LOG_LEVEL', 'info'),
};
