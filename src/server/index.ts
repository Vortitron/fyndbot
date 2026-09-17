import http from 'http';
import { handleWebhookEvent } from '../stripe/index.js';

const SUCCESS_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Success — Fyndbot Pro</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			min-height: 100vh;
			display: flex;
			align-items: centre;
			justify-content: centre;
			padding: 20px;
		}
		.container {
			background: white;
			border-radius: 20px;
			padding: 60px 40px;
			max-width: 600px;
			text-align: centre;
			box-shadow: 0 20px 60px rgba(0,0,0,0.3);
		}
		h1 { font-size: 2.5em; color: #667eea; margin-bottom: 20px; }
		p { font-size: 1.2em; color: #666; line-height: 1.6; margin-bottom: 15px; }
		.emoji { font-size: 3em; margin-bottom: 20px; }
		.button {
			display: inline-block;
			background: #667eea;
			color: white;
			padding: 15px 40px;
			border-radius: 50px;
			text-decoration: none;
			font-size: 1.1em;
			margin-top: 20px;
			transition: all 0.3s;
		}
		.button:hover {
			background: #764ba2;
			transform: translateY(-2px);
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="emoji">✨🎉</div>
		<h1>Welcome to Fyndbot Pro!</h1>
		<p>Your subscription is now active.</p>
		<p>Head back to Telegram and enjoy:</p>
		<ul style="text-align: left; margin: 20px 0; padding-left: 40px;">
			<li>AI bargain scores on every alert</li>
			<li>Unlimited /inspect commands</li>
			<li>Vehicle data enrichment</li>
		</ul>
		<p style="margin-top: 30px; font-size: 0.9em; color: #999;">
			You can close this page and return to Telegram.
		</p>
	</div>
</body>
</html>
`;

const CANCEL_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Cancelled — Fyndbot</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			min-height: 100vh;
			display: flex;
			align-items: centre;
			justify-content: centre;
			padding: 20px;
		}
		.container {
			background: white;
			border-radius: 20px;
			padding: 60px 40px;
			max-width: 600px;
			text-align: centre;
			box-shadow: 0 20px 60px rgba(0,0,0,0.3);
		}
		h1 { font-size: 2.5em; color: #667eea; margin-bottom: 20px; }
		p { font-size: 1.2em; color: #666; line-height: 1.6; margin-bottom: 15px; }
		.emoji { font-size: 3em; margin-bottom: 20px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="emoji">👋</div>
		<h1>Payment Cancelled</h1>
		<p>No worries! You can upgrade to Pro anytime.</p>
		<p>Head back to Telegram and use <code>/pro</code> when you're ready.</p>
		<p style="margin-top: 30px; font-size: 0.9em; color: #999;">
			You can close this page and return to Telegram.
		</p>
	</div>
</body>
</html>
`;

export function startWebServer(): http.Server {
	const server = http.createServer(async (req, res) => {
		const url = new URL(req.url || '', `http://${req.headers.host}`);

		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');

		if (req.method === 'OPTIONS') {
			res.writeHead(200);
			res.end();
			return;
		}

		if (url.pathname === '/api/stripe/webhook' && req.method === 'POST') {
			let body = '';

			req.on('data', chunk => {
				body += chunk.toString();
			});

			req.on('end', () => {
				try {
					const signature = req.headers['stripe-signature'] as string;

					if (!signature) {
						res.writeHead(400);
						res.end('No signature');
						return;
					}

					handleWebhookEvent(body, signature);

					res.writeHead(200);
					res.end('OK');
				} catch (error) {
					console.error('Webhook error:', error);
					res.writeHead(400);
					res.end(`Webhook error: ${error}`);
				}
			});

			return;
		}

		if (url.pathname === '/success' && req.method === 'GET') {
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end(SUCCESS_HTML);
			return;
		}

		if (url.pathname === '/cancel' && req.method === 'GET') {
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end(CANCEL_HTML);
			return;
		}

		if (url.pathname === '/health' && req.method === 'GET') {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ status: 'ok' }));
			return;
		}

		res.writeHead(404);
		res.end('Not found');
	});

	const port = 3847;
	server.listen(port, '127.0.0.1', () => {
		console.log(`Stripe webhook server listening on 127.0.0.1:${port}`);
	});

	return server;
}
