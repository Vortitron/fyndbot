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

export const config: Config = {
	telegramBotToken: getEnvVar('TELEGRAM_BOT_TOKEN'),
	databaseUrl: getEnvVar('DATABASE_URL', './data/fyndbot.db'),
	llmApiKey: process.env.LLM_API_KEY || null,
	llmApiUrl: process.env.LLM_API_URL || null,
	stripeSecretKey: process.env.STRIPE_SECRET_KEY || null,
	stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
	pollIntervalMinutes: getEnvNumber('POLL_INTERVAL_MINUTES', 2),
	freeInspectWeeklyLimit: getEnvNumber('FREE_INSPECT_WEEKLY_LIMIT', 3),
	priceFree: getEnvNumber('PRICE_FREE', 0),
	priceProMonthly: getEnvNumber('PRICE_PRO_MONTHLY', 79),
	priceInspect: getEnvNumber('PRICE_INSPECT', 19),
	nodeEnv: getEnvVar('NODE_ENV', 'development'),
	logLevel: getEnvVar('LOG_LEVEL', 'info'),
};
