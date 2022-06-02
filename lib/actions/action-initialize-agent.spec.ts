import { v4 as uuid } from 'uuid';
import { agentHasSettings } from './action-initialize-agent';

describe('agentHasSettings()', () => {
	test('should return true on match', () => {
		const result = agentHasSettings(
			[
				{
					type: 'user@1.0.0',
					links: {
						'has settings': [
							{
								type: 'working-hours@1.0.0',
								id: uuid(),
								slug: `working-hours-${uuid()}`,
								version: '1.0.0',
								active: true,
								data: {},
								tags: [],
								markers: [],
								requires: [],
								capabilities: [],
								created_at: new Date().toISOString(),
							},
						],
					},
				},
			],
			{
				type: 'working-hours@1.0.0',
			},
		);
		expect(result).toBe(true);
	});

	test('should return false on mismatching predicate', () => {
		const result = agentHasSettings(
			[
				{
					type: 'user@1.0.0',
					links: {
						'has settings': [
							{
								type: 'working-hours@1.0.0',
								id: uuid(),
								slug: `working-hours-${uuid()}`,
								version: '1.0.0',
								active: true,
								data: {},
								tags: [],
								markers: [],
								requires: [],
								capabilities: [],
								created_at: new Date().toISOString(),
							},
						],
					},
				},
			],
			{
				type: 'agent-settings@1.0.0',
			},
		);
		expect(result).toBe(false);
	});

	test('should return false on no links', () => {
		const result = agentHasSettings(
			[
				{
					type: 'user@1.0.0',
					links: {},
				},
			],
			{
				type: 'agent-settings@1.0.0',
			},
		);
		expect(result).toBe(false);
	});

	test('should return false on no contracts', () => {
		const result = agentHasSettings([], {
			type: 'agent-settings@1.0.0',
		});
		expect(result).toBe(false);
	});
});
