import { Kernel } from 'autumndb';
import { v4 as uuidv4 } from 'uuid';
import type { Integration, IntegrationDefinition } from '../../../../lib/sync';

const SLUG = 'foobar';

export class FoobarIntegration implements Integration {
	public slug = SLUG;

	public async destroy() {
		/* empty */
	}

	public async translate(): Promise<any> {
		return [
			{
				time: new Date(),
				actor: uuidv4(),
				card: {
					slug: `card-${uuidv4()}`,
					type: 'card@1.0.0',
					version: '1.0.0',
					data: {},
				},
			},
		];
	}

	public async mirror(_card: any, options: any): Promise<any> {
		return [
			{
				time: new Date(),
				actor: options.actor,
				card: {
					slug: `card-${uuidv4()}`,
					type: 'card@1.0.0',
					version: '1.0.0',
					data: {},
				},
			},
		];
	}
}

export const foobarIntegrationDefinition: IntegrationDefinition = {
	slug: SLUG,

	initialize: async () => new FoobarIntegration(),

	isEventValid: () => true,

	match: async () => {
		return Kernel.defaults({
			slug: `user-${uuidv4()}`,
			type: 'user@1.0.0',
		}) as any;
	},
};
