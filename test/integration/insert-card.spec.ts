import { strict as assert } from 'assert';
import { Kernel, testUtils as coreTestUtils } from '@balena/jellyfish-core';
import type {
	Contract,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import * as _ from 'lodash';
import {
	ActionDefinition,
	testUtils,
	TriggeredActionContract,
} from '../../lib';
import { actionCreateCard } from '../../lib/actions/action-create-card';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	const actionTestOriginator: ActionDefinition = {
		handler: async (
			session: string,
			handlerCtx: any,
			card: any,
			request: any,
		) => {
			request.arguments.properties.data =
				request.arguments.properties.data || {};
			request.arguments.properties.data.originator = request.originator;
			return actionCreateCard.handler(session, handlerCtx, card, request);
		},
		contract: {
			slug: 'action-test-originator',
			type: actionCreateCard.contract.type,
			name: actionCreateCard.contract.name,
			data: actionCreateCard.contract.data,
		},
	};

	ctx = await testUtils.newContext({
		actions: [actionTestOriginator],
	});
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('.insertCard()', () => {
	test('should pass a triggered action originator', async () => {
		const typeCard = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const command = coreTestUtils.generateRandomSlug({
			prefix: 'originator-test',
		});
		const id = coreTestUtils.generateRandomId();

		ctx.worker.setTriggers(ctx.logContext, [
			...ctx.worker.getTriggers(),
			Kernel.defaults({
				id,
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
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
										const: command,
									},
								},
							},
						},
					},
					action: 'action-test-originator@1.0.0',
					target: typeCard.id,
					arguments: {
						reason: null,
						properties: {
							slug: command,
							version: '1.0.0',
						},
					},
				},
			}) as TriggeredActionContract,
		]);

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeCard,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				slug: coreTestUtils.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command,
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const card = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command}@1.0.0`,
		);

		assert(card !== null);
		expect(card.data.originator).toBe(id);
	});

	test('should take an originator option', async () => {
		const typeCard = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const command = coreTestUtils.generateRandomSlug();
		const id = coreTestUtils.generateRandomId();
		ctx.worker.setTriggers(ctx.logContext, [
			...ctx.worker.getTriggers(),
			Kernel.defaults({
				id,
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
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
										const: command,
									},
								},
							},
						},
					},
					action: 'action-test-originator@1.0.0',
					target: typeCard.id,
					arguments: {
						reason: null,
						properties: {
							slug: command,
						},
					},
				},
			}) as TriggeredActionContract,
		]);

		const originatorId = coreTestUtils.generateRandomId();

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeCard,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				originator: originatorId,
				attachEvents: false,
				reason: null,
			},
			{
				slug: coreTestUtils.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command,
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const card = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command}@latest`,
		);
		assert(card !== null);
		expect(card.data.originator).toBe(originatorId);
	});

	test('should execute one matching triggered action', async () => {
		const typeCard = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const command = coreTestUtils.generateRandomSlug();
		ctx.worker.setTriggers(ctx.logContext, [
			...ctx.worker.getTriggers(),
			Kernel.defaults({
				id: coreTestUtils.generateRandomId(),
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
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
										const: command,
									},
								},
							},
						},
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						reason: null,
						properties: {
							slug: command,
						},
					},
				},
			}) as TriggeredActionContract,
		]);

		const result = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeCard,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: true,
				reason: null,
			},
			{
				slug: coreTestUtils.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command,
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const tail = await ctx.kernel.query(ctx.logContext, ctx.session, {
			type: 'object',
			additionalProperties: true,
			required: ['type', 'data'],
			properties: {
				type: {
					type: 'string',
					const: 'create@1.0.0',
				},
				data: {
					type: 'object',
					required: ['target'],
					properties: {
						target: {
							type: 'string',
							const: result!.id,
						},
					},
				},
			},
		});

		expect(tail.length).toBe(1);

		const resultCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command}@1.0.0`,
		);

		expect(resultCard).toBeTruthy();
	});

	test('should not execute non-matching triggered actions', async () => {
		const typeCard = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const command = coreTestUtils.generateRandomSlug();
		ctx.worker.setTriggers(ctx.logContext, [
			Kernel.defaults({
				id: coreTestUtils.generateRandomId(),
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
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
										const: command,
									},
								},
							},
						},
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						properties: {
							slug: command,
						},
					},
				},
			}) as TriggeredActionContract,
		]);

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeCard,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: true,
				reason: null,
			},
			{
				slug: coreTestUtils.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command: coreTestUtils.generateRandomSlug(),
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const resultCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command}@1.0.0`,
		);

		expect(resultCard).toBeFalsy();
	});

	test('should execute more than one matching triggered action', async () => {
		const typeCard = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const prefix = 'triggered-action-test';
		const command1 = coreTestUtils.generateRandomSlug({ prefix });
		const command2 = coreTestUtils.generateRandomSlug({ prefix });
		ctx.worker.setTriggers(ctx.logContext, [
			Kernel.defaults({
				id: coreTestUtils.generateRandomId(),
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
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
										const: command1,
									},
								},
							},
						},
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						reason: null,
						properties: {
							slug: command1,
						},
					},
				},
			}) as TriggeredActionContract,
			Kernel.defaults({
				id: coreTestUtils.generateRandomId(),
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
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
										const: command1,
									},
								},
							},
						},
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						reason: null,
						properties: {
							slug: command2,
						},
					},
				},
			}) as TriggeredActionContract,
		]);

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeCard,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: true,
				reason: null,
			},
			{
				slug: coreTestUtils.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command: command1,
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const resultCard1 = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command1}@1.0.0`,
		);

		const resultCard2 = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command2}@1.0.0`,
		);

		expect(resultCard1).toBeTruthy();
		expect(resultCard2).toBeTruthy();
	});

	test('should execute the matching triggered actions given more than one', async () => {
		const typeCard = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const command1 = coreTestUtils.generateRandomSlug();
		const command2 = coreTestUtils.generateRandomSlug();
		ctx.worker.setTriggers(ctx.logContext, [
			Kernel.defaults({
				id: coreTestUtils.generateRandomId(),
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
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
										const: command1,
									},
								},
							},
						},
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						reason: null,
						properties: {
							slug: command1,
						},
					},
				},
			}) as TriggeredActionContract,
			Kernel.defaults({
				id: coreTestUtils.generateRandomId(),
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
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
										const: command2,
									},
								},
							},
						},
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						reason: null,
						properties: {
							slug: command2,
						},
					},
				},
			}) as TriggeredActionContract,
		]);

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeCard,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: true,
				reason: null,
			},
			{
				slug: coreTestUtils.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command: command1,
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const resultCard1 = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command1}@1.0.0`,
		);

		const resultCard2 = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command2}@1.0.0`,
		);

		expect(resultCard1).toBeTruthy();
		expect(resultCard2).toBeFalsy();
	});

	test('should remove previously inserted type triggered actions if inserting a type', async () => {
		const typeCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const fooType = coreTestUtils.generateRandomSlug({
			prefix: 'foo',
		});
		const barType = coreTestUtils.generateRandomSlug({
			prefix: 'bar',
		});
		const cards = [
			{
				type: 'triggered-action@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				version: '1.0.0',
				data: {
					type: `${fooType}@1.0.0`,
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
						reason: null,
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
							version: '1.0.0',
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
					type: `${barType}@1.0.0`,
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
						reason: null,
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
							version: '1.0.0',
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

		await ctx.flushAll(ctx.session);

		const typeTypeContract = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);

		assert(typeTypeContract !== null);

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeTypeContract,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: true,
				reason: null,
			},
			{
				slug: fooType,
				version: '1.0.0',
				data: {
					schema: {
						type: 'object',
					},
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const triggers = await ctx.kernel.query(ctx.logContext, ctx.session, {
			type: 'object',
			additionalProperties: true,
			required: ['active', 'type'],
			properties: {
				active: {
					type: 'boolean',
					const: true,
				},
				type: {
					type: 'string',
					const: 'triggered-action@1.0.0',
				},
				data: {
					type: 'object',
					required: ['type'],
					properties: {
						type: {
							anyOf: [
								{
									type: 'string',
									const: `${fooType}@1.0.0`,
								},
								{
									type: 'string',
									const: `${barType}@1.0.0`,
								},
							],
						},
					},
				},
			},
		});

		const updatedCard = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			insertedCards[1].id,
		);

		expect(triggers).toEqual([
			Object.assign({}, updatedCard, {
				id: triggers[0].id,
			}),
		]);
	});

	test('should add a triggered action given a type with an AGGREGATE formula', async () => {
		const typeType = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = coreTestUtils.generateRandomSlug();

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				slug,
				version: '1.0.0',
				data: {
					schema: {
						type: 'object',
						properties: {
							type: {
								type: 'string',
								const: `${slug}@1.0.0`,
							},
							data: {
								type: 'object',
								properties: {
									mentions: {
										type: 'array',
										$$formula: 'AGGREGATE($events, "data.payload.mentions")',
									},
								},
								additionalProperties: true,
							},
						},
						additionalProperties: true,
						required: ['type', 'data'],
					},
				},
			},
		);

		const trigger = await ctx.waitForMatch({
			type: 'object',
			additionalProperties: true,
			required: ['active', 'type'],
			properties: {
				active: {
					type: 'boolean',
					const: true,
				},
				type: {
					type: 'string',
					const: 'triggered-action@1.0.0',
				},
				data: {
					type: 'object',
					required: ['type'],
					properties: {
						type: {
							type: 'string',
							const: `${slug}@1.0.0`,
						},
					},
				},
			},
		});

		expect(trigger).toEqual({
			created_at: trigger.created_at,
			updated_at: null,
			linked_at: trigger.linked_at,
			id: trigger.id,
			slug: `triggered-action-${slug}-data-mentions`,
			type: trigger.type,
			version: '1.0.0',
			name: null,
			active: true,
			loop: null,
			links: {},
			tags: [],
			markers: [],
			requires: [],
			capabilities: [],
			data: trigger.data,
		});
	});

	test('should pre-register a triggered action if using AGGREGATE', async () => {
		const typeType = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = coreTestUtils.generateRandomSlug();
		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				slug,
				version: '1.0.0',
				data: {
					schema: {
						type: 'object',
						properties: {
							type: {
								type: 'string',
								const: `${slug}@1.0.0`,
							},
							data: {
								type: 'object',
								properties: {
									mentions: {
										type: 'array',
										$$formula: 'AGGREGATE($events, "data.payload.mentions")',
									},
								},
								additionalProperties: true,
							},
						},
						additionalProperties: true,
						required: ['type', 'data'],
					},
				},
			},
		);

		const generatedTrigger = ctx.worker.getTriggers().find((trigger) => {
			return (
				_.get(trigger, [
					'data',
					'filter',
					'$$links',
					'is attached to',
					'properties',
					'type',
					'const',
				]) === `${slug}@1.0.0`
			);
		});

		expect(generatedTrigger).toBeTruthy();
	});

	test('should update pre-registered triggered actions if removing an AGGREGATE', async () => {
		const typeType = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = coreTestUtils.generateRandomSlug();

		const element = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				slug,
				version: '1.0.0',
				data: {
					schema: {
						type: 'object',
						properties: {
							type: {
								type: 'string',
								const: `${slug}@1.0.0`,
							},
							data: {
								type: 'object',
								properties: {
									mentions: {
										type: 'array',
										$$formula: 'AGGREGATE($events, "data.payload.mentions")',
									},
								},
								additionalProperties: true,
							},
						},
						additionalProperties: true,
						required: ['type', 'data'],
					},
				},
			},
		);

		await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			element!,
			[
				{
					op: 'remove',
					path: '/data/schema/properties/data/properties/mentions/$$formula',
				},
			],
		);

		expect(
			ctx.worker.getTriggers().find((trigger) => {
				return (
					_.get(trigger, [
						'filter',
						'$$links',
						'is attached to',
						'properties',
						'type',
						'const',
					]) === `${slug}@1.0.0`
				);
			}),
		).toBeFalsy();
	});

	test('should add multiple triggered actions given a type with an AGGREGATE formula', async () => {
		const typeType = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = coreTestUtils.generateRandomSlug();

		const type = {
			slug,
			version: '1.0.0',
			data: {
				schema: {
					type: 'object',
					properties: {
						type: {
							type: 'string',
							const: `${slug}@1.0.0`,
						},
						data: {
							type: 'object',
							properties: {
								mentions: {
									type: 'array',
									$$formula: 'AGGREGATE($events, "data.payload.mentions")',
								},
							},
							additionalProperties: true,
						},
					},
					additionalProperties: true,
					required: ['type', 'data'],
				},
			},
		};

		const element = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			type,
		);

		await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			element!,
			[
				{
					op: 'replace',
					path: '/active',
					value: false,
				},
			],
		);

		await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			element!,
			[
				{
					op: 'replace',
					path: '/active',
					value: true,
				},
			],
		);

		const triggers = await ctx.kernel.query(ctx.logContext, ctx.session, {
			type: 'object',
			additionalProperties: true,
			required: ['active', 'type'],
			properties: {
				active: {
					type: 'boolean',
					const: true,
				},
				type: {
					type: 'string',
					const: 'triggered-action@1.0.0',
				},
				data: {
					type: 'object',
					required: ['type'],
					properties: {
						type: {
							type: 'string',
							const: `${slug}@1.0.0`,
						},
					},
				},
			},
		});

		/*
		expect(
			ctx.worker.getTriggers().filter((trigger) => {
				return (
					_.get(trigger, [
						'filter',
						'$$links',
						'is attached to',
						'properties',
						'type',
						'const',
					]) === `${slug}@1.0.0`
				);
			}),
		).toHaveLength(1);
		*/
		expect(triggers).toHaveLength(1);
	});

	test('should execute a triggered action given a type with an contract.links["..."] formula', async () => {
		// This test
		// * creates a new type with a link formula
		// * creates two contracts of this type
		// * links the two contracts
		// * updates the contract that was linked from
		// * checks if formula in linked to contract was updated
		// (and lots of sanity checks in the middle)

		const typeType = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);
		const linkType = (await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'link@latest',
		))!;

		assert(typeType !== null);

		const typeSlug = coreTestUtils.generateRandomSlug();
		const initialValue = 1;
		const propValueBeforeUpdate = 2;
		const magicNumber = 3;

		const newType = (await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				slug: typeSlug,
				version: '1.0.0',
				data: {
					schema: {
						type: 'object',
						properties: {
							type: {
								type: 'string',
								const: `${typeSlug}@1.0.0`,
							},
							data: {
								type: 'object',
								properties: {
									linkedProperty: {
										type: 'number',
										$$formula:
											'contract.links["was built from"].length && contract.links["was built from"][0].data.prop',
									},
								},
								additionalProperties: true,
							},
						},
						additionalProperties: true,
						required: ['type', 'data'],
					},
				},
			},
		))! as TypeContract;

		const triggeredAction = await ctx.waitForMatch({
			type: 'object',
			additionalProperties: true,
			required: ['active', 'type'],
			properties: {
				active: {
					type: 'boolean',
					const: true,
				},
				type: {
					type: 'string',
					const: 'triggered-action@1.0.0',
				},
				data: {
					type: 'object',
					required: ['type'],
					properties: {
						type: {
							type: 'string',
							const: `${typeSlug}@1.0.0`,
						},
					},
				},
			},
		});

		const testContract = (await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			newType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				data: {
					otherProp: 42,
					linkedProperty: initialValue, // should get overwritten immediately
				},
			},
		))!;

		const linkedContract = (await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			newType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				data: {
					otherProp: 23,
					prop: propValueBeforeUpdate,
				},
			},
		))!;

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			linkType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				name: 'was built into',
				data: {
					inverseName: 'was built from',
					from: {
						id: linkedContract.id,
						slug: linkedContract.slug,
						type: linkedContract.type,
					},
					to: {
						id: testContract.id,
						slug: testContract.slug,
						type: testContract.type,
					},
				},
			},
		);

		// sanity check that link and filter work as expected
		const triggerMatch = await ctx.waitForMatch(triggeredAction.data.filter);
		expect(triggerMatch.id).toEqual(linkedContract.id);

		// first test if linked formula works in when invoked directly
		await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			newType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: 'random change that should trigger formula re-eval',
			},
			testContract,
			[{ op: 'add', path: '/data/randomChange', value: 1 }],
		);

		const testContractAfterBogusUpdate = await ctx.waitForMatch({
			type: 'object',
			additionalProperties: true,
			required: ['id'],
			properties: {
				id: {
					type: 'string',
					const: testContract.id,
				},
				data: {
					type: 'object',
					required: ['linkedProperty'],
					properties: {
						linkedProperty: {
							type: 'number',
							const: propValueBeforeUpdate,
						},
					},
				},
			},
		});

		expect(testContractAfterBogusUpdate.data.linkedProperty).toEqual(
			propValueBeforeUpdate,
		);

		// force an update as linking doesn't seem to be enough
		await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			newType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: 'random change that should cause triggered action to run',
			},
			linkedContract,
			[{ op: 'replace', path: '/data/prop', value: magicNumber }],
		);

		await ctx.flush(ctx.session);

		const testContractAfterUpdate = await ctx.waitForMatch({
			type: 'object',
			additionalProperties: true,
			required: ['id'],
			properties: {
				id: {
					type: 'string',
					const: testContract.id,
				},
				data: {
					type: 'object',
					required: ['linkedProperty'],
					properties: {
						linkedProperty: {
							type: 'number',
							const: magicNumber,
						},
					},
				},
			},
		});

		expect(testContractAfterUpdate.data.linkedProperty).toEqual(magicNumber);
	});
});
