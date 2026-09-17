import Stripe from 'stripe';
import { config } from '../config.js';
import * as db from '../database/index.js';

let stripe: Stripe | null = null;
let stripeTest: Stripe | null = null;

export function getStripe(): Stripe {
	if (!config.stripeSecretKey) {
		throw new Error('STRIPE_SECRET_KEY not configured');
	}

	if (!stripe) {
		stripe = new Stripe(config.stripeSecretKey, {
			apiVersion: '2025-02-24.acacia',
		});
	}

	return stripe;
}

function getStripeTest(): Stripe {
	if (!config.stripeTestSecretKey) {
		throw new Error('STRIPE_TEST_SECRET_KEY not configured');
	}

	if (!stripeTest) {
		stripeTest = new Stripe(config.stripeTestSecretKey, {
			apiVersion: '2025-02-24.acacia',
		});
	}

	return stripeTest;
}

function isUserInSandbox(telegramId: number, username: string | null): boolean {
	if (config.stripeSandboxTelegramIds.includes(telegramId)) {
		return true;
	}

	if (username && config.stripeSandboxUsernames.length > 0) {
		const usernameLower = username.toLowerCase();
		return config.stripeSandboxUsernames.some(allowed => allowed.toLowerCase() === usernameLower);
	}

	return false;
}

export async function createCheckoutSession(telegramId: number, username: string | null = null): Promise<{ url: string; isTest: boolean }> {
	const useSandbox = isUserInSandbox(telegramId, username);

	if (useSandbox) {
		if (!config.stripeTestSecretKey || !config.stripeTestPriceFyndbotPro) {
			throw new Error('User is in sandbox but STRIPE_TEST_SECRET_KEY or STRIPE_TEST_PRICE_FYNDBOT_PRO not configured');
		}

		const stripeClient = getStripeTest();

		const session = await stripeClient.checkout.sessions.create({
			mode: 'subscription',
			line_items: [
				{
					price: config.stripeTestPriceFyndbotPro,
					quantity: 1,
				},
			],
			success_url: `${config.publicBaseUrl}/success`,
			cancel_url: `${config.publicBaseUrl}/cancel`,
			client_reference_id: telegramId.toString(),
			metadata: {
				telegram_id: telegramId.toString(),
				stripe_mode: 'test',
			},
		});

		if (!session.url) {
			throw new Error('No checkout URL returned from Stripe');
		}

		console.log(`Created TEST Checkout session for user ${telegramId}`);
		return { url: session.url, isTest: true };
	}

	if (!config.stripePriceFyndbotPro) {
		throw new Error('STRIPE_PRICE_FYNDBOT_PRO not configured');
	}

	const stripeClient = getStripe();

	const session = await stripeClient.checkout.sessions.create({
		mode: 'subscription',
		line_items: [
			{
				price: config.stripePriceFyndbotPro,
				quantity: 1,
			},
		],
		success_url: `${config.publicBaseUrl}/success`,
		cancel_url: `${config.publicBaseUrl}/cancel`,
		client_reference_id: telegramId.toString(),
		metadata: {
			telegram_id: telegramId.toString(),
		},
	});

	if (!session.url) {
		throw new Error('No checkout URL returned from Stripe');
	}

	return { url: session.url, isTest: false };
}

export function handleWebhookEvent(payload: string | Buffer, signature: string): void {
	let event: Stripe.Event | null = null;
	let usedTestMode = false;

	if (config.stripeWebhookSecret) {
		try {
			const stripeClient = getStripe();
			event = stripeClient.webhooks.constructEvent(
				payload,
				signature,
				config.stripeWebhookSecret
			);
		} catch (err) {
			console.log('Live webhook signature verification failed, trying test mode...');
		}
	}

	if (!event && config.stripeTestWebhookSecret) {
		try {
			const stripeClient = config.stripeTestSecretKey ? getStripeTest() : getStripe();
			event = stripeClient.webhooks.constructEvent(
				payload,
				signature,
				config.stripeTestWebhookSecret
			);
			usedTestMode = true;
		} catch (err) {
			throw new Error(`Webhook signature verification failed (both live and test): ${err}`);
		}
	}

	if (!event) {
		throw new Error('Webhook signature verification failed and no test webhook secret configured');
	}

	if (usedTestMode) {
		console.log(`Processing TEST mode webhook event: ${event.type}`);
	}

	switch (event.type) {
		case 'checkout.session.completed':
			handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
			break;

		case 'customer.subscription.updated':
			handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
			break;

		case 'customer.subscription.deleted':
			handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
			break;

		default:
			console.log(`Unhandled Stripe event: ${event.type}`);
	}
}

function handleCheckoutCompleted(session: Stripe.Checkout.Session): void {
	const telegramId = parseInt(session.client_reference_id || session.metadata?.telegram_id || '0', 10);

	if (!telegramId) {
		console.error('No telegram_id in checkout session:', session.id);
		return;
	}

	const customerId = session.customer as string;
	const subscriptionId = session.subscription as string;

	db.setUserPro(telegramId, true, customerId, subscriptionId);

	console.log(`User ${telegramId} upgraded to Pro via checkout ${session.id}`);
}

function handleSubscriptionUpdated(subscription: Stripe.Subscription): void {
	const customerId = subscription.customer as string;
	const user = db.getUserByStripeCustomerId(customerId);

	if (!user) {
		console.warn(`User not found for Stripe customer ${customerId}`);
		return;
	}

	const isActive = subscription.status === 'active' || subscription.status === 'trialing';

	db.setUserPro(user.telegramId, isActive, customerId, subscription.id);

	console.log(`Subscription ${subscription.id} updated: ${subscription.status} (user ${user.telegramId})`);
}

function handleSubscriptionDeleted(subscription: Stripe.Subscription): void {
	const customerId = subscription.customer as string;
	const user = db.getUserByStripeCustomerId(customerId);

	if (!user) {
		console.warn(`User not found for Stripe customer ${customerId}`);
		return;
	}

	db.setUserPro(user.telegramId, false);

	console.log(`Subscription ${subscription.id} deleted (user ${user.telegramId})`);
}
