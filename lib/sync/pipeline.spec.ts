import { constant } from 'lodash';
import sinon from 'sinon';
import * as pipeline from './pipeline';
import { SyncActionContext } from './sync-context';

describe('pipeline.importCards()', () => {
	test('should work with card partials', async () => {
		const upsertElementSpy = sinon.spy(
			constant({
				foo: 'bar',
			}),
		);

		const sequence = [
			{
				time: new Date(),
				actor: '46a045b8-95f6-42b5-bf7f-aa0a1365b9ee',
				card: {
					type: 'card',
					slug: 'card-78a1dfd7-21ea-405a-b269-de0b0e587975',
				},
			},
		];

		const context = {
			upsertElement: upsertElementSpy,
		} as any as SyncActionContext;

		const results = await pipeline.importCards(context, sequence, {});

		expect(results.length).toBe(1);
		expect(upsertElementSpy.calledOnce).toBe(true);
		expect((upsertElementSpy.args as any)[0][0]).toBe('card');
		expect((upsertElementSpy.args as any)[0][1]).toEqual({
			active: true,
			version: '1.0.0',
			tags: [],
			markers: [],
			links: {},
			requires: [],
			capabilities: [],
			data: {},
			type: 'card',
			slug: 'card-78a1dfd7-21ea-405a-b269-de0b0e587975',
		});
	});

	test('should work with JSONpatch', async () => {
		const upsertElementSpy = sinon.spy(
			constant({
				foo: 'bar',
			}),
		);

		const sequence = [
			{
				time: new Date(),
				actor: '46a045b8-95f6-42b5-bf7f-aa0a1365b9ee',
				card: {
					id: '78a1dfd7-21ea-405a-b269-de0b0e587975',
					type: 'card',
					patch: [
						{
							op: 'replace',
							path: '/name',
							value: 'foobar',
						},
					],
				},
			},
		];

		const context = {
			upsertElement: upsertElementSpy,
		} as any as SyncActionContext;

		// TS-TODO: Sequence types are incorrect here, but I'm not sure why
		const results = await pipeline.importCards(context, sequence as any, {});

		expect(results.length).toBe(1);
		expect(upsertElementSpy.calledOnce).toBe(true);
		expect((upsertElementSpy.args as any)[0][0]).toBe('card');
		expect((upsertElementSpy.args as any)[0][1]).toEqual({
			id: '78a1dfd7-21ea-405a-b269-de0b0e587975',
			type: 'card',
			patch: [
				{
					op: 'replace',
					path: '/name',
					value: 'foobar',
				},
			],
		});
	});
});
