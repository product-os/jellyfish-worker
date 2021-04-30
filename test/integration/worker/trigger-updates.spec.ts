/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as helpers from './helpers';

let context: any;

beforeAll(async () => {
	context = await helpers.worker.before();
});

afterAll(() => {
	return helpers.worker.after(context);
});

describe('.setTriggers()', () => {
	it('should be able to set a trigger with a start date', () => {
		context.worker.setTriggers(context.context, [
			{
				schedule: 'async',
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				startDate: '2008-01-01T00:00:00.000Z',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
		]);

		const triggers = context.worker.getTriggers();

		expect(triggers).toEqual([
			{
				schedule: 'async',
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				startDate: '2008-01-01T00:00:00.000Z',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
		]);
	});

	it('should be able to set a trigger with an interval', () => {
		context.worker.setTriggers(context.context, [
			{
				schedule: 'async',
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				interval: 'PT1H',
				arguments: {
					foo: 'bar',
				},
			},
		]);

		const triggers = context.worker.getTriggers();

		expect(triggers).toEqual([
			{
				schedule: 'async',
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				interval: 'PT1H',
				arguments: {
					foo: 'bar',
				},
			},
		]);
	});

	it('should be able to set triggers', () => {
		context.worker.setTriggers(context.context, [
			{
				schedule: 'async',
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
			{
				schedule: 'async',
				id: 'd6cacdef-f53b-4b5b-8aa2-8476e48248a4',
				slug: 'triggered-action-foo-baz',
				action: 'action-foo-bar@1.0.0',
				target: 'a13474e4-7b44-453b-9f3e-aa783b8f37ea',
				type: 'card@1.0.0',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'baz',
				},
			},
		]);

		const triggers = context.worker.getTriggers();

		expect(triggers).toEqual([
			{
				schedule: 'async',
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
			{
				schedule: 'async',
				id: 'd6cacdef-f53b-4b5b-8aa2-8476e48248a4',
				slug: 'triggered-action-foo-baz',
				action: 'action-foo-bar@1.0.0',
				target: 'a13474e4-7b44-453b-9f3e-aa783b8f37ea',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'baz',
				},
			},
		]);
	});

	it('should not store extra properties', () => {
		context.worker.setTriggers(context.context, [
			{
				schedule: 'async',
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				foo: 'bar',
				bar: 'baz',
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
		]);

		const triggers = context.worker.getTriggers();

		expect(triggers).toEqual([
			{
				schedule: 'async',
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
		]);
	});

	it('should store a mode', () => {
		context.worker.setTriggers(context.context, [
			{
				schedule: 'async',
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				mode: 'update',
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
		]);

		const triggers = context.worker.getTriggers();

		expect(triggers).toEqual([
			{
				schedule: 'async',
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: 'action-foo-bar@1.0.0',
				mode: 'update',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
		]);
	});

	it('should throw if no interval nor filter', () => {
		expect(() => {
			context.worker.setTriggers(context.context, [
				{
					schedule: 'async',
					id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
					slug: 'triggered-action-foo-bar',
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					action: 'action-create-card@1.0.0',
					arguments: {
						reason: null,
						foo: 'bar',
					},
				},
			]);
		}).toThrow(context.worker.errors.WorkerInvalidTrigger);
	});

	it('should throw if mode is not a string', () => {
		expect(() => {
			context.worker.setTriggers(context.context, [
				{
					schedule: 'async',
					id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
					slug: 'triggered-action-foo-bar',
					action: 'action-foo-bar@1.0.0',
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					mode: 1,
					filter: {
						type: 'object',
					},
					arguments: {
						foo: 'bar',
					},
				},
			]);
		}).toThrow(context.worker.errors.WorkerInvalidTrigger);
	});

	it('should throw if both interval and filter', () => {
		expect(() => {
			context.worker.setTriggers(context.context, [
				{
					schedule: 'async',
					id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
					slug: 'triggered-action-foo-bar',
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					interval: 'PT1H',
					filter: {
						type: 'object',
					},
					action: 'action-create-card@1.0.0',
					arguments: {
						reason: null,
						foo: 'bar',
					},
				},
			]);
		}).toThrow(context.worker.errors.WorkerInvalidTrigger);
	});

	it('should throw if no id', () => {
		expect(() => {
			context.worker.setTriggers(context.context, [
				{
					schedule: 'async',
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					slug: 'triggered-action-foo-bar',
					action: 'action-create-card@1.0.0',
					filter: {
						type: 'object',
					},
					arguments: {
						reason: null,
						foo: 'bar',
					},
				},
			]);
		}).toThrow(context.worker.errors.WorkerInvalidTrigger);
	});

	it('should throw if no slug', () => {
		expect(() => {
			context.worker.setTriggers(context.context, [
				{
					schedule: 'async',
					id: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					action: 'action-create-card@1.0.0',
					filter: {
						type: 'object',
					},
					arguments: {
						reason: null,
						foo: 'bar',
					},
				},
			]);
		}).toThrow(context.worker.errors.WorkerInvalidTrigger);
	});

	it('should throw if id is not a string', () => {
		expect(() => {
			context.worker.setTriggers(context.context, [
				{
					schedule: 'async',
					id: 999,
					slug: 'triggered-action-foo-bar',
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					action: 'action-create-card@1.0.0',
					filter: {
						type: 'object',
					},
					arguments: {
						reason: null,
						foo: 'bar',
					},
				},
			]);
		}).toThrow(context.worker.errors.WorkerInvalidTrigger);
	});

	it('should throw if interval is not a string', () => {
		expect(() => {
			context.worker.setTriggers(context.context, [
				{
					schedule: 'async',
					id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
					slug: 'triggered-action-foo-bar',
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					action: 'action-create-card@1.0.0',
					interval: 999,
					arguments: {
						reason: null,
						foo: 'bar',
					},
				},
			]);
		}).toThrow(context.worker.errors.WorkerInvalidTrigger);
	});

	it('should throw if no action', () => {
		expect(() => {
			context.worker.setTriggers(context.context, [
				{
					schedule: 'async',
					id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
					slug: 'triggered-action-foo-bar',
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					filter: {
						type: 'object',
					},
					arguments: {
						foo: 'bar',
					},
				},
			]);
		}).toThrow(context.worker.errors.WorkerInvalidTrigger);
	});

	it('should throw if action is not a string', () => {
		expect(() => {
			context.worker.setTriggers(context.context, [
				{
					schedule: 'async',
					id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
					slug: 'triggered-action-foo-bar',
					action: 1,
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					filter: {
						type: 'object',
					},
					arguments: {
						foo: 'bar',
					},
				},
			]);
		}).toThrow(context.worker.errors.WorkerInvalidTrigger);
	});

	it('should throw if no target', () => {
		expect(() => {
			context.worker.setTriggers(context.context, [
				{
					schedule: 'async',
					id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
					slug: 'triggered-action-foo-bar',
					action: 'action-create-card@1.0.0',
					filter: {
						type: 'object',
					},
					arguments: {
						reason: null,
						foo: 'bar',
					},
				},
			]);
		}).toThrow(context.worker.errors.WorkerInvalidTrigger);
	});

	it('should throw if target is not a string', () => {
		expect(() => {
			context.worker.setTriggers(context.context, [
				{
					schedule: 'async',
					id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
					slug: 'triggered-action-foo-bar',
					action: 'action-create-card@1.0.0',
					target: 1,
					filter: {
						type: 'object',
					},
					arguments: {
						reason: null,
						foo: 'bar',
					},
				},
			]);
		}).toThrow(context.worker.errors.WorkerInvalidTrigger);
	});

	it('should throw if no filter', () => {
		expect(() => {
			context.worker.setTriggers(context.context, [
				{
					schedule: 'async',
					id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
					slug: 'triggered-action-foo-bar',
					action: 'action-create-card@1.0.0',
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					arguments: {
						reason: null,
						foo: 'bar',
					},
				},
			]);
		}).toThrow(context.worker.errors.WorkerInvalidTrigger);
	});

	it('should throw if filter is not an object', () => {
		expect(() => {
			context.worker.setTriggers(context.context, [
				{
					schedule: 'async',
					id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
					slug: 'triggered-action-foo-bar',
					action: 'action-create-card@1.0.0',
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					filter: 'foo',
					arguments: {
						reason: null,
						foo: 'bar',
					},
				},
			]);
		}).toThrow(context.worker.errors.WorkerInvalidTrigger);
	});

	it('should throw if no arguments', () => {
		expect(() => {
			context.worker.setTriggers(context.context, [
				{
					schedule: 'async',
					id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
					slug: 'triggered-action-foo-bar',
					action: 'action-create-card@1.0.0',
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					filter: {
						type: 'object',
					},
				},
			]);
		}).toThrow(context.worker.errors.WorkerInvalidTrigger);
	});

	it('should throw if arguments is not an object', () => {
		expect(() => {
			context.worker.setTriggers(context.context, [
				{
					schedule: 'async',
					id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
					slug: 'triggered-action-foo-bar',
					action: 'action-create-card@1.0.0',
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					filter: {
						type: 'object',
					},
					arguments: 1,
				},
			]);
		}).toThrow(context.worker.errors.WorkerInvalidTrigger);
	});
});

describe('.upsertTrigger()', () => {
	it('should be able to add a trigger', () => {
		context.worker.setTriggers(context.context, [
			{
				schedule: 'async',
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
		]);

		context.worker.upsertTrigger(context.context, {
			schedule: 'async',
			id: 'd6cacdef-f53b-4b5b-8aa2-8476e48248a4',
			slug: 'triggered-action-foo-baz',
			action: 'action-foo-bar@1.0.0',
			target: 'a13474e4-7b44-453b-9f3e-aa783b8f37ea',
			type: 'card@1.0.0',
			filter: {
				type: 'object',
			},
			arguments: {
				foo: 'baz',
			},
		});

		const triggers = context.worker.getTriggers();

		expect(triggers).toEqual([
			{
				schedule: 'async',
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
			{
				schedule: 'async',
				id: 'd6cacdef-f53b-4b5b-8aa2-8476e48248a4',
				slug: 'triggered-action-foo-baz',
				action: 'action-foo-bar@1.0.0',
				target: 'a13474e4-7b44-453b-9f3e-aa783b8f37ea',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'baz',
				},
			},
		]);
	});

	it('should be able to modify an existing trigger', () => {
		context.worker.setTriggers(context.context, [
			{
				schedule: 'async',
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
			{
				schedule: 'async',
				id: 'd6cacdef-f53b-4b5b-8aa2-8476e48248a4',
				slug: 'triggered-action-foo-baz',
				action: 'action-foo-bar@1.0.0',
				target: 'a13474e4-7b44-453b-9f3e-aa783b8f37ea',
				type: 'card@1.0.0',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'baz',
				},
			},
		]);

		context.worker.upsertTrigger(context.context, {
			schedule: 'async',
			id: 'd6cacdef-f53b-4b5b-8aa2-8476e48248a4',
			slug: 'triggered-action-foo-baz',
			action: 'action-foo-bar@1.0.0',
			target: 'a13474e4-7b44-453b-9f3e-aa783b8f37ea',
			type: 'card@1.0.0',
			filter: {
				type: 'object',
			},
			arguments: {
				baz: 'buzz',
			},
		});

		const triggers = context.worker.getTriggers();

		expect(triggers).toEqual([
			{
				schedule: 'async',
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
			{
				schedule: 'async',
				id: 'd6cacdef-f53b-4b5b-8aa2-8476e48248a4',
				slug: 'triggered-action-foo-baz',
				action: 'action-foo-bar@1.0.0',
				target: 'a13474e4-7b44-453b-9f3e-aa783b8f37ea',
				filter: {
					type: 'object',
				},
				arguments: {
					baz: 'buzz',
				},
			},
		]);
	});
});

describe('.removeTrigger()', () => {
	it('should be able to remove an existing trigger', () => {
		const cards = [
			{
				schedule: 'async',
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
			{
				schedule: 'async',
				id: 'd6cacdef-f53b-4b5b-8aa2-8476e48248a4',
				slug: 'triggered-action-foo-baz',
				action: 'action-foo-bar@1.0.0',
				target: 'a13474e4-7b44-453b-9f3e-aa783b8f37ea',
				type: 'card@1.0.0',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'baz',
				},
			},
		];

		context.worker.setTriggers(context.context, cards);

		context.worker.removeTrigger(context.context, cards[1].id);

		const triggers = context.worker.getTriggers();

		expect(triggers).toEqual([cards[0]]);
	});
});
