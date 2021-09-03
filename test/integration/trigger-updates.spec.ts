/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { TriggeredActionContract } from '@balena/jellyfish-types/build/worker';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import CARDS from '../../lib/cards';

let ctx: integrationHelpers.IntegrationTestContext;

beforeAll(async () => {
	ctx = await integrationHelpers.before(CARDS);
});

afterAll(() => {
	return integrationHelpers.after(ctx);
});

describe('.setTriggers()', () => {
	it('should be able to set triggers', () => {
		const trigger1 = ctx.jellyfish.defaults({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			slug: 'triggered-action-foo-bar',
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

		const trigger2 = ctx.jellyfish.defaults({
			id: 'd6cacdef-f53b-4b5b-8aa2-8476e48248a4',
			slug: 'triggered-action-foo-baz',
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

		ctx.worker.setTriggers(ctx.context, [trigger1, trigger2]);

		const triggers = ctx.worker.getTriggers();

		expect(triggers).toEqual([trigger1, trigger2]);
	});
});

describe('.upsertTrigger()', () => {
	it('should be able to add a trigger', () => {
		const trigger1 = ctx.jellyfish.defaults({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			slug: 'triggered-action-foo-bar',
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

		const trigger2 = ctx.jellyfish.defaults({
			id: 'd6cacdef-f53b-4b5b-8aa2-8476e48248a4',
			slug: 'triggered-action-foo-baz',
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

		ctx.worker.setTriggers(ctx.context, [trigger1]);

		ctx.worker.upsertTrigger(ctx.context, trigger2);

		const triggers = ctx.worker.getTriggers();

		expect(triggers).toEqual([trigger1, trigger2]);
	});

	it('should be able to modify an existing trigger', () => {
		const trigger1 = ctx.jellyfish.defaults({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			slug: 'triggered-action-foo-bar',
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

		const trigger2 = ctx.jellyfish.defaults({
			id: 'd6cacdef-f53b-4b5b-8aa2-8476e48248a4',
			slug: 'triggered-action-foo-baz',
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

		ctx.worker.setTriggers(ctx.context, [trigger1, trigger2]);

		const newArguments = {
			baz: 'buzz',
		};

		ctx.worker.upsertTrigger(ctx.context, {
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
		const trigger1 = ctx.jellyfish.defaults({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			slug: 'triggered-action-foo-bar',
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

		const trigger2 = ctx.jellyfish.defaults({
			id: 'd6cacdef-f53b-4b5b-8aa2-8476e48248a4',
			slug: 'triggered-action-foo-baz',
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

		ctx.worker.setTriggers(ctx.context, [trigger1, trigger2]);

		ctx.worker.removeTrigger(ctx.context, trigger1.id);

		const triggers = ctx.worker.getTriggers();

		expect(triggers).toEqual([trigger2]);
	});
});
