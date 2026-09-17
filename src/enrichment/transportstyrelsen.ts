import type { VehicleEnrichment } from '../types/index.js';

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
				monthsUntilTax: 3,
				monthsInTraffic: 156,
				make: 'Volvo',
				model: 'V70',
				year: 2012,
			},
			'XYZ456': {
				registrationNumber: 'XYZ456',
				monthsUntilInspection: 2,
				monthsUntilTax: 11,
				monthsInTraffic: 48,
				make: 'Volkswagen',
				model: 'Golf',
				year: 2020,
			},
		};

		return mockData[registrationNumber] || {
			registrationNumber,
			monthsUntilInspection: Math.floor(Math.random() * 12),
			monthsUntilTax: Math.floor(Math.random() * 12),
			monthsInTraffic: Math.floor(Math.random() * 200),
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
