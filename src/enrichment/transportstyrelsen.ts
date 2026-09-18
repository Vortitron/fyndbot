import type { VehicleEnrichment } from '../types/index.js';
import { fetchBlocketDetail } from '../blocket/detail.js';

export interface TransportstyrelsenProvider {
	enrichVehicle(registrationNumber: string): Promise<VehicleEnrichment | null>;
}

export class MockTransportstyrelsenProvider implements TransportstyrelsenProvider {
	async enrichVehicle(registrationNumber: string): Promise<VehicleEnrichment | null> {
		await new Promise(resolve => setTimeout(resolve, 100));

		const mockData: Record<string, VehicleEnrichment> = {
			'ABC123': {
				registrationNumber: 'ABC123',
				monthsUntilInspection: 8,
				monthsUntilTax: null,
				monthsInTraffic: null,
				make: 'Volvo',
				model: 'V70',
				year: 2012,
			},
			'XYZ456': {
				registrationNumber: 'XYZ456',
				monthsUntilInspection: 2,
				monthsUntilTax: null,
				monthsInTraffic: null,
				make: 'Volkswagen',
				model: 'Golf',
				year: 2020,
			},
		};

		return mockData[registrationNumber] || {
			registrationNumber,
			monthsUntilInspection: Math.floor(Math.random() * 12),
			monthsUntilTax: null,
			monthsInTraffic: null,
			make: 'Unknown',
			model: 'Unknown',
			year: 2015,
		};
	}
}

export async function enrichVehicleData(registrationNumber: string): Promise<VehicleEnrichment | null> {
	const provider = new MockTransportstyrelsenProvider();
	return provider.enrichVehicle(registrationNumber);
}

export async function enrichVehicleFromBlocket(listingUrl: string): Promise<VehicleEnrichment | null> {
	try {
		const detail = await fetchBlocketDetail(listingUrl);
		
		if (!detail) {
			return null;
		}

		return {
			registrationNumber: detail.registrationNumber || 'Unknown',
			monthsUntilInspection: detail.monthsUntilInspection,
			monthsUntilTax: null,
			monthsInTraffic: null,
			make: detail.make,
			model: detail.model,
			year: detail.year,
		};
	} catch (error) {
		console.error('Error enriching vehicle from Blocket:', error);
		return null;
	}
}
