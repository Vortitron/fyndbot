import { config } from './config.js';
import { initDatabase, closeDatabase } from './database/index.js';
import { createBot } from './bot/handlers.js';
import { startPoller } from './bot/poller.js';
import { startWebServer } from './server/index.js';

console.log('Starting Fyndbot...');

console.log('Initialising database...');
initDatabase();

console.log('Creating Telegram bot...');
const bot = createBot();

console.log('Starting watch poller...');
const pollerInterval = startPoller(bot);

let webServer = null;
if (config.stripeSecretKey && config.stripeWebhookSecret) {
	console.log('Starting Stripe webhook server...');
	webServer = startWebServer();
} else {
	console.log('Stripe not configured, skipping webhook server');
}

console.log('✅ Fyndbot is running!');
console.log(`Poll interval: ${config.pollIntervalMinutes} minutes`);
console.log(`Pro tier: ${config.priceProMonthly} SEK/month`);

process.on('SIGINT', () => {
	console.log('\nShutting down gracefully...');
	clearInterval(pollerInterval);
	bot.stopPolling();
	if (webServer) webServer.close();
	closeDatabase();
	process.exit(0);
});

process.on('SIGTERM', () => {
	console.log('\nShutting down gracefully...');
	clearInterval(pollerInterval);
	bot.stopPolling();
	if (webServer) webServer.close();
	closeDatabase();
	process.exit(0);
});
