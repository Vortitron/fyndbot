import Stripe from 'stripe';
import { config } from '../config.js';
import * as db from '../database/index.js';

let stripe: Stripe | null = null;

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

export async function createCheckoutSession(telegramId: number): Promise<string> {
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

	return session.url;
}

export function handleWebhookEvent(payload: string | Buffer, signature: string): void {
	if (!config.stripeWebhookSecret) {
		throw new Error('STRIPE_WEBHOOK_SECRET not configured');
	}

	const stripeClient = getStripe();

	let event: Stripe.Event;

	try {
		event = stripeClient.webhooks.constructEvent(
			payload,
			signature,
			config.stripeWebhookSecret
		);
	} catch (err) {
		throw new Error(`Webhook signature verification failed: ${err}`);
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
