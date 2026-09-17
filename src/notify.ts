import { config } from './config.js';
import fetch from 'node-fetch';

export async function sendTelegramMessage(telegramId: number, message: string): Promise<void> {
	try {
		const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
		
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				chat_id: telegramId,
				text: message,
				parse_mode: 'Markdown',
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Failed to send Telegram message to ${telegramId}: ${response.status} - ${errorText}`);
		} else {
			console.log(`Sent Telegram message to ${telegramId}`);
		}
	} catch (error) {
		console.error(`Error sending Telegram message to ${telegramId}:`, error);
	}
}
