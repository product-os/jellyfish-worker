import { strict as assert } from 'assert';
import { Kernel, testUtils as coreTestUtils } from '@balena/jellyfish-core';
import type {
	Contract,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import _ from 'lodash';
import {
	errors,
	testUtils,
	TriggeredActionContract,
	triggersLib as triggers,
} from '../../lib';

let ctx: testUtils.TestContext;
let typeCard: TypeContract;

beforeAll(async () => {
	ctx = await testUtils.newContext();

	const contract = (await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'card@latest',
	)) as TypeContract;

	assert(contract !== null);

	typeCard = contract;

	await ctx.kernel.insertContract(ctx.logContext, ctx.session, {
		slug: 'foo',
		type: 'type@1.0.0',
		version: '1.0.0',
		name: 'The test foo card',
		markers: [],
		tags: [],
		links: {},
		active: true,
		data: {
			schema: {
				type: 'object',
				properties: {
					version: {
						type: 'string',
						const: '1.0.0',
					},
					data: {
						type: 'object',
						properties: {
							foo: {
								anyOf: [
									{
										type: 'number',
									},
									{
										type: 'string',
									},
								],
							},
						},
					},
				},
			},
		},
		requires: [],
		capabilities: [],
	});
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('.getRequest()', () => {
	it('should return null if the filter only has a type but there is no match', async () => {
		const trigger = Kernel.defaults({
			type: 'triggered-action@1.0.0',
			data: {
				mode: 'insert',
				filter: {
					type: 'object',
					required: ['type'],
					properties: {
						type: {
							type: 'string',
							const: 'foo@1.0.0',
						},
					},
				},
				action: 'action-create-card@1.0.0',
				card: typeCard.id,
				arguments: {
					properties: {
						slug: 'foo-bar-baz',
					},
				},
			},
		}) as TriggeredActionContract;

		const insertedCard = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: coreTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {},
			},
		);

		// TS-TODO: fix cast to any
		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedCard,
			{
				currentDate: new Date(),
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toBeFalsy();
	});

	it('should return a request if the filter only has a type and there is a match', async () => {
		const trigger = Kernel.defaults({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			type: 'triggered-action@1.0.0',
			data: {
				mode: 'insert',
				filter: {
					type: 'object',
					required: ['type'],
					properties: {
						type: {
							type: 'string',
							const: 'foo@1.0.0',
						},
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeCard.id,
				arguments: {
					properties: {
						slug: 'foo-bar-baz',
					},
				},
			},
		}) as TriggeredActionContract;

		const date = new Date();

		const insertedCard = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'foo@1.0.0',
				version: '1.0.0',
				slug: coreTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedCard,
			{
				currentDate: date,
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			currentDate: date,
			card: typeCard.id,
			logContext: ctx.logContext,
			originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			arguments: {
				properties: {
					slug: 'foo-bar-baz',
				},
			},
		});
	});

	it('should return null if there is no relevant from the old contract state', async () => {
		const trigger = Kernel.defaults({
			type: 'triggered-action@1.0.0',
			data: {
				mode: 'insert',
				filter: {
					type: 'object',
					required: ['type'],
					properties: {
						type: {
							type: 'string',
							const: 'foo@1.0.0',
						},
					},
				},
				action: 'action-create-card@1.0.0',
				card: typeCard.id,
				arguments: {
					properties: {
						slug: 'foo-bar-baz',
					},
				},
			},
		}) as TriggeredActionContract;

		const insertedCard = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: coreTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {},
			},
		);
		const oldCard = _.cloneDeep(insertedCard);
		oldCard.data.randomField = 42;

		// TS-TODO: fix cast to any
		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			oldCard,
			insertedCard,
			{
				currentDate: new Date(),
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toBeFalsy();
	});

	it('should return a request if a relevant field did change', async () => {
		const trigger = Kernel.defaults({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			type: 'triggered-action@1.0.0',
			data: {
				mode: 'insert',
				filter: {
					type: 'object',
					required: ['type'],
					properties: {
						type: {
							type: 'string',
							const: 'foo@1.0.0',
						},
						name: {
							type: 'string',
							pattern: 'x',
						},
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeCard.id,
				arguments: {
					properties: {
						slug: 'foo-bar-baz',
					},
				},
			},
		}) as TriggeredActionContract;

		const date = new Date();

		const insertedCard = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				name: 'x2',
				type: 'foo@1.0.0',
				version: '1.0.0',
				slug: coreTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {},
			},
		);
		const oldCard = _.cloneDeep(insertedCard);
		oldCard.name = 'x1';

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			oldCard,
			insertedCard,
			{
				currentDate: date,
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			currentDate: date,
			card: typeCard.id,
			logContext: ctx.logContext,
			originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			arguments: {
				properties: {
					slug: 'foo-bar-baz',
				},
			},
		});
	});

	it('should return a request given a complex matching filter', async () => {
		const trigger = Kernel.defaults({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			type: 'triggered-action@1.0.0',
			data: {
				mode: 'insert',
				filter: {
					type: 'object',
					required: ['type', 'data'],
					properties: {
						type: {
							type: 'string',
							const: 'foo@1.0.0',
						},
						data: {
							type: 'object',
							required: ['foo'],
							properties: {
								foo: {
									type: 'number',
								},
							},
						},
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeCard.id,
				arguments: {
					properties: {
						slug: 'foo-bar-baz',
					},
				},
			},
		}) as TriggeredActionContract;

		const date = new Date();

		const insertedCard = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'foo@1.0.0',
				version: '1.0.0',
				slug: coreTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					foo: 4,
				},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedCard,
			{
				currentDate: date,
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			currentDate: date,
			card: typeCard.id,
			logContext: ctx.logContext,
			originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			arguments: {
				properties: {
					slug: 'foo-bar-baz',
				},
			},
		});
	});

	it('should return null given a complex non-matching filter', async () => {
		const trigger = Kernel.defaults({
			type: 'triggered-action@1.0.0',
			data: {
				mode: 'insert',
				filter: {
					type: 'object',
					required: ['type', 'data'],
					properties: {
						type: {
							type: 'string',
							const: 'foo@1.0.0',
						},
						data: {
							type: 'object',
							required: ['foo'],
							properties: {
								foo: {
									type: 'number',
								},
							},
						},
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeCard.id,
				arguments: {
					properties: {
						slug: 'foo-bar-baz',
					},
				},
			},
		}) as TriggeredActionContract;

		const insertedCard = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'foo@1.0.0',
				version: '1.0.0',
				slug: coreTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					foo: '4',
				},
			},
		);

		// TS-TODO: fix cast to any
		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedCard,
			{
				currentDate: new Date(),
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toBeFalsy();
	});

	it('should parse source templates in the triggered action arguments', async () => {
		const trigger = Kernel.defaults({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			type: 'triggered-action@1.0.0',
			data: {
				mode: 'insert',
				filter: {
					type: 'object',
					required: ['data'],
					properties: {
						data: {
							type: 'object',
							required: ['command'],
							properties: {
								command: {
									type: 'string',
									const: 'foo-bar-baz',
								},
							},
						},
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeCard.id,
				arguments: {
					properties: {
						slug: {
							$eval: 'source.data.slug',
						},
						data: {
							number: {
								$eval: 'source.data.number',
							},
						},
					},
				},
			},
		}) as TriggeredActionContract;

		const date = new Date();

		const insertedCard = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: coreTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					command: 'foo-bar-baz',
					slug: 'hello-world',
					number: 6,
				},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedCard,
			{
				currentDate: date,
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			card: typeCard.id,
			logContext: ctx.logContext,
			originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			currentDate: date,
			arguments: {
				properties: {
					slug: 'hello-world',
					data: {
						number: 6,
					},
				},
			},
		});
	});

	it('should return the request if the mode matches on update', async () => {
		const trigger = Kernel.defaults({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			type: 'triggered-action@1.0.0',
			data: {
				filter: {
					type: 'object',
					required: ['data'],
					properties: {
						data: {
							type: 'object',
							required: ['command'],
							properties: {
								command: {
									type: 'string',
									const: 'foo-bar-baz',
								},
							},
						},
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeCard.id,
				mode: 'update',
				arguments: {
					properties: {
						slug: {
							$eval: 'source.data.slug',
						},
						data: {
							number: {
								$eval: 'source.data.number',
							},
						},
					},
				},
			},
		}) as TriggeredActionContract;

		const date = new Date();

		const insertedCard = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: coreTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					command: 'foo-bar-baz',
					slug: 'hello-world',
					number: 6,
				},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedCard,
			{
				currentDate: date,
				logContext: ctx.logContext,
				session: ctx.session,
				mode: 'update',
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			card: typeCard.id,
			logContext: ctx.logContext,
			originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			currentDate: date,
			arguments: {
				properties: {
					slug: 'hello-world',
					data: {
						number: 6,
					},
				},
			},
		});
	});

	it('should return the request if the mode matches on insert', async () => {
		const trigger = Kernel.defaults({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			type: 'triggered-action@1.0.0',
			data: {
				filter: {
					type: 'object',
					required: ['data'],
					properties: {
						data: {
							type: 'object',
							required: ['command'],
							properties: {
								command: {
									type: 'string',
									const: 'foo-bar-baz',
								},
							},
						},
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeCard.id,
				mode: 'insert',
				arguments: {
					properties: {
						slug: {
							$eval: 'source.data.slug',
						},
						data: {
							number: {
								$eval: 'source.data.number',
							},
						},
					},
				},
			},
		}) as TriggeredActionContract;

		const date = new Date();

		const insertedCard = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: coreTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					command: 'foo-bar-baz',
					slug: 'hello-world',
					number: 6,
				},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedCard,
			{
				currentDate: date,
				logContext: ctx.logContext,
				session: ctx.session,
				mode: 'insert',
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			card: typeCard.id,
			logContext: ctx.logContext,
			originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			currentDate: date,
			arguments: {
				properties: {
					slug: 'hello-world',
					data: {
						number: 6,
					},
				},
			},
		});
	});

	it('should return null if the mode does not match', async () => {
		const trigger = Kernel.defaults({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			type: 'triggered-action@1.0.0',
			data: {
				filter: {
					type: 'object',
					required: ['data'],
					properties: {
						data: {
							type: 'object',
							required: ['command'],
							properties: {
								command: {
									type: 'string',
									const: 'foo-bar-baz',
								},
							},
						},
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeCard.id,
				mode: 'update',
				arguments: {
					properties: {
						slug: {
							$eval: 'source.data.slug',
						},
						data: {
							number: {
								$eval: 'source.data.number',
							},
						},
					},
				},
			},
		}) as TriggeredActionContract;

		const date = new Date();

		const insertedCard = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				slug: coreTestUtils.generateRandomId(),
				type: 'card@1.0.0',
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					command: 'foo-bar-baz',
					slug: 'hello-world',
					number: 6,
				},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedCard,
			{
				currentDate: date,
				logContext: ctx.logContext,
				session: ctx.session,
				mode: 'insert',
			},
		);

		expect(request).toBe(null);
	});

	it('should parse timestamp templates in the triggered action arguments', async () => {
		const trigger = Kernel.defaults({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			type: 'triggered-action@1.0.0',
			data: {
				mode: 'insert',
				filter: {
					type: 'object',
					required: ['type'],
					properties: {
						type: { const: 'card@1.0.0' },
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeCard.id,
				arguments: {
					properties: {
						data: {
							timestamp: {
								$eval: 'timestamp',
							},
						},
					},
				},
			},
		}) as TriggeredActionContract;

		const currentDate = new Date();

		const insertedCard = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				slug: coreTestUtils.generateRandomId(),
				type: 'card@1.0.0',
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					command: 'foo-bar-baz',
					slug: 'hello-world',
					number: 6,
				},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedCard,
			{
				currentDate,
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			currentDate,
			card: typeCard.id,
			logContext: ctx.logContext,
			originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			arguments: {
				properties: {
					data: {
						timestamp: currentDate.toISOString(),
					},
				},
			},
		});
	});

	it('should return null if one of the templates is unsatisfied', async () => {
		const trigger = Kernel.defaults({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			slug: 'triggered-action-cb3523c5',
			type: 'triggered-action@1.0.0',
			data: {
				mode: 'insert',
				filter: {
					type: 'object',
					required: ['data'],
					properties: {
						data: {
							type: 'object',
							required: ['command'],
							properties: {
								command: {
									type: 'string',
									const: 'foo-bar-baz',
								},
							},
						},
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeCard.id,
				arguments: {
					properties: {
						slug: {
							$eval: 'source.data.slug',
						},
						data: {
							number: {
								$eval: 'source.data.number',
							},
						},
					},
				},
			},
		}) as TriggeredActionContract;

		const insertedCard = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				slug: coreTestUtils.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					command: 'foo-bar-baz',
					slug: 'hello-world',
				},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedCard,
			{
				currentDate: new Date(),
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toBeFalsy();
	});
});

describe('.getTypeTriggers()', () => {
	it('should return a trigger card with a matching type', async () => {
		const cards = [
			{
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				data: {
					type: 'foo@1.0.0',
					filter: {
						type: 'object',
						required: ['data'],
						properties: {
							data: {
								type: 'object',
								required: ['command'],
								properties: {
									command: {
										type: 'string',
										const: 'foo-bar-baz',
									},
								},
							},
						},
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
							data: {
								number: {
									$eval: 'source.data.number',
								},
							},
						},
					},
				},
			},
		].map(Kernel.defaults);

		const insertedCards = await Promise.all(
			cards.map((card) => {
				return ctx.kernel.insertContract(
					ctx.logContext,
					ctx.session,
					card as Contract,
				);
			}),
		);

		const updatedCard = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			insertedCards[0].id,
		);

		const result = await triggers.getTypeTriggers(
			ctx.logContext,
			ctx.kernel,
			ctx.session,
			'foo@1.0.0',
		);

		expect(result).toEqual([
			Object.assign({}, updatedCard, {
				id: result[0].id,
			}),
		]);
	});

	it('should not return inactive cards', async () => {
		const typeSlug = coreTestUtils.generateRandomSlug();
		const cards = [
			{
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				active: false,
				data: {
					type: `${typeSlug}@1.0.0`,
					filter: {
						type: 'object',
						required: ['data'],
						properties: {
							data: {
								type: 'object',
								required: ['command'],
								properties: {
									command: {
										type: 'string',
										const: 'foo-bar-baz',
									},
								},
							},
						},
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
							data: {
								number: {
									$eval: 'source.data.number',
								},
							},
						},
					},
				},
			},
		].map(Kernel.defaults);

		for (const card of cards) {
			await ctx.kernel.insertContract(
				ctx.logContext,
				ctx.session,
				card as Contract,
			);
		}

		const result = await triggers.getTypeTriggers(
			ctx.logContext,
			ctx.kernel,
			ctx.session,
			`${typeSlug}@1.0.0`,
		);

		expect(result).toEqual([]);
	});

	it('should ignore non-matching cards', async () => {
		const typeSlug = coreTestUtils.generateRandomSlug();
		const cards = [
			{
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				data: {
					type: `${typeSlug}@1.0.0`,
					filter: {
						type: 'object',
						required: ['data'],
						properties: {
							data: {
								type: 'object',
								required: ['command'],
								properties: {
									command: {
										type: 'string',
										const: 'foo-bar-baz',
									},
								},
							},
						},
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
							data: {
								number: {
									$eval: 'source.data.number',
								},
							},
						},
					},
				},
			},
			{
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				data: {
					type: 'bar@1.0.0',
					filter: {
						type: 'object',
						required: ['data'],
						properties: {
							data: {
								type: 'object',
								required: ['command'],
								properties: {
									command: {
										type: 'string',
										const: 'foo-bar-baz',
									},
								},
							},
						},
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
							data: {
								number: {
									$eval: 'source.data.number',
								},
							},
						},
					},
				},
			},
		].map(Kernel.defaults);

		const insertedCards = await Promise.all(
			cards.map((card) => {
				return ctx.kernel.insertContract(
					ctx.logContext,
					ctx.session,
					card as Contract,
				);
			}),
		);

		const result = await triggers.getTypeTriggers(
			ctx.logContext,
			ctx.kernel,
			ctx.session,
			`${typeSlug}@1.0.0`,
		);

		const updatedCard = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			insertedCards[0].id,
		);

		expect(result).toEqual([
			Object.assign({}, updatedCard, {
				id: result[0].id,
			}),
		]);
	});

	it('should ignore cards that are not triggered actions', async () => {
		const typeSlug = coreTestUtils.generateRandomSlug();
		const cards = [
			{
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				data: {
					type: `${typeSlug}@1.0.0`,
					filter: {
						type: 'object',
						required: ['data'],
						properties: {
							data: {
								type: 'object',
								required: ['command'],
								properties: {
									command: {
										type: 'string',
										const: 'foo-bar-baz',
									},
								},
							},
						},
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
							data: {
								number: {
									$eval: 'source.data.number',
								},
							},
						},
					},
				},
			},
			{
				type: 'card@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'card',
				}),
				version: '1.0.0',
				data: {
					type: `${typeSlug}@1.0.0`,
					filter: {
						type: 'object',
						required: ['data'],
						properties: {
							data: {
								type: 'object',
								required: ['command'],
								properties: {
									command: {
										type: 'string',
										const: 'foo-bar-baz',
									},
								},
							},
						},
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
							data: {
								number: {
									$eval: 'source.data.number',
								},
							},
						},
					},
				},
			},
		].map(Kernel.defaults);

		const insertedCards = await Promise.all(
			cards.map((card) => {
				return ctx.kernel.insertContract(
					ctx.logContext,
					ctx.session,
					card as Contract,
				);
			}),
		);

		const result = await triggers.getTypeTriggers(
			ctx.logContext,
			ctx.kernel,
			ctx.session,
			`${typeSlug}@1.0.0`,
		);

		const updatedCard = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			insertedCards[0].id,
		);

		expect(result).toEqual([
			Object.assign({}, updatedCard, {
				id: result[0].id,
			}),
		]);
	});

	it('should not return triggered actions not associated with a type', async () => {
		const cards = [
			{
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				data: {
					filter: {
						type: 'object',
						required: ['data'],
						properties: {
							data: {
								type: 'object',
								required: ['command'],
								properties: {
									command: {
										type: 'string',
										const: 'foo-bar-baz',
									},
								},
							},
						},
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
							data: {
								number: {
									$eval: 'source.data.number',
								},
							},
						},
					},
				},
			},
		].map(Kernel.defaults);

		for (const card of cards) {
			await ctx.kernel.insertContract(
				ctx.logContext,
				ctx.session,
				card as Contract,
			);
		}

		const result = await triggers.getTypeTriggers(
			ctx.logContext,
			ctx.kernel,
			ctx.session,
			`${coreTestUtils.generateRandomSlug()}@1.0.0`,
		);
		expect(result).toEqual([]);
	});
});

describe('.getStartDate()', () => {
	it('should return epoch if the trigger has no start date', async () => {
		// TS-TODO: remove the cast to "any"
		const result = triggers.getStartDate(
			Kernel.defaults({
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					filter: {
						type: 'object',
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
		);

		expect(result.getTime()).toBe(0);
	});

	it('should return epoch if the trigger has an invalid date', async () => {
		// TS-TODO: remove the cast to "any"
		const result = triggers.getStartDate(
			Kernel.defaults({
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					filter: {
						type: 'object',
					},
					startDate: 'foo',
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
		);

		expect(result.getTime()).toBe(0);
	});

	it('should return the specified date if valid', async () => {
		const date = new Date();
		// TS-TODO: Remove the cast to "any"
		const result = triggers.getStartDate(
			Kernel.defaults({
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					filter: {
						type: 'object',
					},
					startDate: date.toISOString(),
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
		);

		expect(result.getTime()).toBe(date.getTime());
	});
});

describe('.getNextExecutionDate()', () => {
	it('should return null if no interval', async () => {
		const date = new Date();

		// TS-TODO: fix the cast to any here
		const result = triggers.getNextExecutionDate(
			Kernel.defaults({
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					filter: {
						type: 'object',
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
			date,
		);

		expect(result).toEqual(null);
	});

	it('should return epoch if no last execution date', async () => {
		// TS-TODO: fix the cast to any here
		const result = triggers.getNextExecutionDate(
			Kernel.defaults({
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					interval: 'PT1H',
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
		);

		expect(result!.getTime()).toBe(0);
	});

	it('should return epoch if last execution date is not a valid date', async () => {
		// TS-TODO: Remove cast to any
		const result = triggers.getNextExecutionDate(
			Kernel.defaults({
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					interval: 'PT1H',
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
			new Date('foobar'),
		);

		expect(result!.getTime()).toBe(0);
	});

	it('should return epoch if last execution date is not a date', async () => {
		// TS-TODO: fix cast
		const result = triggers.getNextExecutionDate(
			Kernel.defaults({
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					interval: 'PT1H',
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
			'foobar' as any,
		);

		expect(result!.getTime()).toBe(0);
	});

	it('should throw if the interval is invalid', async () => {
		const date = new Date();

		expect(() => {
			// TS-TODO: fix cast
			triggers.getNextExecutionDate(
				Kernel.defaults({
					type: 'triggered-action@1.0.0',
					slug: coreTestUtils.generateRandomSlug({
						prefix: 'triggered-action',
					}),
					version: '1.0.0',
					active: true,
					links: {},
					tags: [],
					markers: [],
					data: {
						interval: 'FOOBARBAZ',
						action: 'action-create-card@1.0.0',
						target: typeCard.id,
						arguments: {
							properties: {
								slug: 'foo',
							},
						},
					},
				}) as TriggeredActionContract,
				date,
			);
		}).toThrow(errors.WorkerInvalidDuration);
	});

	it('should return the next interval after the last execution', async () => {
		// TS-TODO: fix cast
		const result = triggers.getNextExecutionDate(
			Kernel.defaults({
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					interval: 'PT1H',
					action: 'action-create-card@1.0.0',
					startDate: '2018-01-01T00:00:00.000Z',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
			new Date('2018-01-01T05:30:00.000Z'),
		);

		expect(result!.toISOString()).toBe('2018-01-01T06:00:00.000Z');
	});

	it('should return the start date if the last execution happened way before the start date', async () => {
		// TS-TODO: fix cast to any
		const result = triggers.getNextExecutionDate(
			Kernel.defaults({
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					interval: 'PT1H',
					action: 'action-create-card@1.0.0',
					startDate: '2018-01-01T05:00:00.000Z',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
			new Date('2018-01-01T01:00:00.000Z'),
		);

		expect(result!.toISOString()).toBe('2018-01-01T05:00:00.000Z');
	});

	it('should return the subsequent interval if the last execution happened just before the start date', async () => {
		// TS-TODO: fix cast to any
		const result = triggers.getNextExecutionDate(
			Kernel.defaults({
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					interval: 'PT1H',
					action: 'action-create-card@1.0.0',
					startDate: '2018-01-01T05:00:00.000Z',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
			new Date('2018-01-01T04:50:00.000Z'),
		);

		expect(result!.toISOString()).toBe('2018-01-01T06:00:00.000Z');
	});

	it('should return the next interval if the last execution is the start date', async () => {
		// TS-TODO: Fix cast to any
		const result = triggers.getNextExecutionDate(
			Kernel.defaults({
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					interval: 'PT1H',
					action: 'action-create-card@1.0.0',
					startDate: '2018-01-01T05:00:00.000Z',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
			new Date('2018-01-01T05:00:00.000Z'),
		);

		expect(result!.toISOString()).toBe('2018-01-01T06:00:00.000Z');
	});
});
