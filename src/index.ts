import { config } from './config.js';
import { initDatabase, closeDatabase } from './database/index.js';
import { createBot } from './bot/handlers.js';
import { startPoller } from './bot/poller.js';

console.log('Starting Fyndbot...');

console.log('Initialising database...');
initDatabase();

console.log('Creating Telegram bot...');
const bot = createBot();

console.log('Starting watch poller...');
const pollerInterval = startPoller(bot);

console.log('✅ Fyndbot is running!');
console.log(`Poll interval: ${config.pollIntervalMinutes} minutes`);
console.log(`Pro tier: ${config.priceProMonthly} SEK/month`);

process.on('SIGINT', () => {
	console.log('\nShutting down gracefully...');
	clearInterval(pollerInterval);
	bot.stopPolling();
	closeDatabase();
	process.exit(0);
});

process.on('SIGTERM', () => {
	console.log('\nShutting down gracefully...');
	clearInterval(pollerInterval);
	bot.stopPolling();
	closeDatabase();
	process.exit(0);
});
