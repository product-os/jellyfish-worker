import { ActionLibrary } from '@balena/jellyfish-action-library';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import type { TriggeredActionContract } from '@balena/jellyfish-types/build/worker';
import { Worker } from '../../lib';

let ctx: integrationHelpers.IntegrationTestContext;

beforeAll(async () => {
	ctx = await integrationHelpers.before({
		plugins: [DefaultPlugin, ActionLibrary, ProductOsPlugin],
		worker: Worker,
	});
});

afterAll(() => {
	return integrationHelpers.after(ctx);
});

describe('.setTriggers()', () => {
	it('should be able to set triggers', () => {
		const trigger1 = ctx.kernel.defaults({
			id: ctx.generateRandomID(),
			slug: ctx.generateRandomSlug({
				prefix: 'triggered-action',
			}),
			type: 'triggered-action@1.0.0',
			data: {
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
		}) as TriggeredActionContract;

		const trigger2 = ctx.kernel.defaults({
			id: ctx.generateRandomID(),
			slug: ctx.generateRandomSlug({
				prefix: 'triggered-action',
			}),
			type: 'triggered-action@1.0.0',
			data: {
				action: 'action-foo-bar@1.0.0',
				target: 'a13474e4-7b44-453b-9f3e-aa783b8f37ea',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'baz',
				},
			},
		}) as TriggeredActionContract;

		ctx.worker.setTriggers(ctx.logContext, [trigger1, trigger2]);

		const triggers = ctx.worker.getTriggers();

		expect(triggers).toEqual([trigger1, trigger2]);
	});
});

describe('.upsertTrigger()', () => {
	it('should be able to add a trigger', () => {
		const trigger1 = ctx.kernel.defaults({
			id: ctx.generateRandomID(),
			slug: ctx.generateRandomSlug({
				prefix: 'triggered-action',
			}),
			type: 'triggered-action@1.0.0',
			data: {
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
		}) as TriggeredActionContract;

		const trigger2 = ctx.kernel.defaults({
			id: ctx.generateRandomID(),
			slug: ctx.generateRandomSlug({
				prefix: 'triggered-action',
			}),
			type: 'triggered-action@1.0.0',
			data: {
				action: 'action-foo-bar@1.0.0',
				target: 'a13474e4-7b44-453b-9f3e-aa783b8f37ea',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'baz',
				},
			},
		}) as TriggeredActionContract;

		ctx.worker.setTriggers(ctx.logContext, [trigger1]);

		ctx.worker.upsertTrigger(ctx.logContext, trigger2);

		const triggers = ctx.worker.getTriggers();

		expect(triggers).toEqual([trigger1, trigger2]);
	});

	it('should be able to modify an existing trigger', () => {
		const trigger1 = ctx.kernel.defaults({
			id: ctx.generateRandomID(),
			slug: ctx.generateRandomSlug({
				prefix: 'triggered-action',
			}),
			type: 'triggered-action@1.0.0',
			data: {
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
		}) as TriggeredActionContract;

		const trigger2 = ctx.kernel.defaults({
			id: ctx.generateRandomID(),
			slug: ctx.generateRandomSlug({
				prefix: 'triggered-action',
			}),
			type: 'triggered-action@1.0.0',
			data: {
				action: 'action-foo-bar@1.0.0',
				target: 'a13474e4-7b44-453b-9f3e-aa783b8f37ea',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'baz',
				},
			},
		}) as TriggeredActionContract;

		ctx.worker.setTriggers(ctx.logContext, [trigger1, trigger2]);

		const newArguments = {
			baz: 'buzz',
		};

		ctx.worker.upsertTrigger(ctx.logContext, {
			...trigger2,
			data: {
				...trigger2.data,
				arguments: newArguments,
			},
		});

		const triggers = ctx.worker.getTriggers();

		expect(triggers).toEqual([
			trigger1,
			{
				...trigger2,
				data: {
					...trigger2.data,
					arguments: newArguments,
				},
			},
		]);
	});
});

describe('.removeTrigger()', () => {
	it('should be able to remove an existing trigger', () => {
		const trigger1 = ctx.kernel.defaults({
			id: ctx.generateRandomID(),
			slug: ctx.generateRandomSlug({
				prefix: 'triggered-action',
			}),
			type: 'triggered-action@1.0.0',
			data: {
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
		}) as TriggeredActionContract;

		const trigger2 = ctx.kernel.defaults({
			id: ctx.generateRandomID(),
			slug: ctx.generateRandomSlug({
				prefix: 'triggered-action',
			}),
			type: 'triggered-action@1.0.0',
			data: {
				action: 'action-foo-bar@1.0.0',
				target: 'a13474e4-7b44-453b-9f3e-aa783b8f37ea',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'baz',
				},
			},
		}) as TriggeredActionContract;

		ctx.worker.setTriggers(ctx.logContext, [trigger1, trigger2]);

		ctx.worker.removeTrigger(ctx.logContext, trigger1.id);

		const triggers = ctx.worker.getTriggers();

		expect(triggers).toEqual([trigger2]);
	});
});
