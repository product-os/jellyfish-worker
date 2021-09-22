/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import ActionLibrary from '@balena/jellyfish-action-library';
import { actionCreateCard } from '@balena/jellyfish-action-library/build/actions/action-create-card';
import type { ActionFile } from '@balena/jellyfish-plugin-base';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { Contract, TypeContract } from '@balena/jellyfish-types/build/core';
import { TriggeredActionContract } from '@balena/jellyfish-types/build/worker';
import { strict as assert } from 'assert';
import Bluebird from 'bluebird';
import _ from 'lodash';
import { Worker } from '../../lib';

let ctx: integrationHelpers.IntegrationTestContext;

beforeAll(async () => {
	const actionTestOriginator: ActionFile = {
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
		card: {
			slug: 'action-test-originator',
			type: actionCreateCard.card.type,
			name: actionCreateCard.card.name,
			data: actionCreateCard.card.data,
		},
	};

	ctx = await integrationHelpers.before(
		[DefaultPlugin, ActionLibrary, ProductOsPlugin],
		{
			worker: Worker,
			actions: [actionTestOriginator],
			cards: [
				Object.assign({}, actionCreateCard.card, {
					slug: 'action-test-originator',
				}),
			],
		},
	);
});

afterAll(() => {
	return integrationHelpers.after(ctx);
});

describe('.insertCard()', () => {
	test('should pass a triggered action originator', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const command = ctx.generateRandomSlug({ prefix: 'originator-test' });
		const id = ctx.generateRandomID();

		ctx.worker.setTriggers(ctx.context, [
			...ctx.worker.getTriggers(),
			ctx.jellyfish.defaults({
				id,
				type: 'triggered-action@1.0.0',
				slug: ctx.generateRandomSlug({
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
			ctx.context,
			ctx.session,
			typeCard,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
				attachEvents: false,
				reason: null,
			},
			{
				slug: ctx.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command,
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const card = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			`${command}@1.0.0`,
		);

		assert(card !== null);
		expect(card.data.originator).toBe(id);
	});

	test('should take an originator option', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const command = ctx.generateRandomSlug();
		const id = ctx.generateRandomID();
		ctx.worker.setTriggers(ctx.context, [
			...ctx.worker.getTriggers(),
			ctx.jellyfish.defaults({
				id,
				slug: ctx.generateRandomSlug({
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

		const originatorId = ctx.generateRandomID();

		await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
				originator: originatorId,
				attachEvents: false,
				reason: null,
			},
			{
				slug: ctx.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command,
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const card = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			`${command}@latest`,
		);
		assert(card !== null);
		expect(card.data.originator).toBe(originatorId);
	});

	test('should execute one matching triggered action', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const command = ctx.generateRandomSlug();
		ctx.worker.setTriggers(ctx.context, [
			...ctx.worker.getTriggers(),
			ctx.jellyfish.defaults({
				id: ctx.generateRandomID(),
				slug: ctx.generateRandomSlug({
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
			ctx.context,
			ctx.session,
			typeCard,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
				attachEvents: true,
				reason: null,
			},
			{
				slug: ctx.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command,
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const tail = await ctx.jellyfish.query(ctx.context, ctx.session, {
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

		const resultCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			`${command}@1.0.0`,
		);

		expect(resultCard).toBeTruthy();
	});

	test('should not execute non-matching triggered actions', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const command = ctx.generateRandomSlug();
		ctx.worker.setTriggers(ctx.context, [
			ctx.jellyfish.defaults({
				id: ctx.generateRandomID(),
				slug: ctx.generateRandomSlug({
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
			ctx.context,
			ctx.session,
			typeCard,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
				attachEvents: true,
				reason: null,
			},
			{
				slug: ctx.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command: ctx.generateRandomSlug(),
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const resultCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			`${command}@1.0.0`,
		);

		expect(resultCard).toBeFalsy();
	});

	test('should execute more than one matching triggered action', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const prefix = 'triggered-action-test';
		const command1 = ctx.generateRandomSlug({ prefix });
		const command2 = ctx.generateRandomSlug({ prefix });
		ctx.worker.setTriggers(ctx.context, [
			ctx.jellyfish.defaults({
				id: ctx.generateRandomID(),
				slug: ctx.generateRandomSlug({
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
			ctx.jellyfish.defaults({
				id: ctx.generateRandomID(),
				slug: ctx.generateRandomSlug({
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
			ctx.context,
			ctx.session,
			typeCard,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
				attachEvents: true,
				reason: null,
			},
			{
				slug: ctx.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command: command1,
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const resultCard1 = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			`${command1}@1.0.0`,
		);

		const resultCard2 = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			`${command2}@1.0.0`,
		);

		expect(resultCard1).toBeTruthy();
		expect(resultCard2).toBeTruthy();
	});

	test('should execute the matching triggered actions given more than one', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const command1 = ctx.generateRandomSlug();
		const command2 = ctx.generateRandomSlug();
		ctx.worker.setTriggers(ctx.context, [
			ctx.jellyfish.defaults({
				id: ctx.generateRandomID(),
				slug: ctx.generateRandomSlug({
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
			ctx.jellyfish.defaults({
				id: ctx.generateRandomID(),
				slug: ctx.generateRandomSlug({
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
			ctx.context,
			ctx.session,
			typeCard,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
				attachEvents: true,
				reason: null,
			},
			{
				slug: ctx.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command: command1,
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const resultCard1 = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			`${command1}@1.0.0`,
		);

		const resultCard2 = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			`${command2}@1.0.0`,
		);

		expect(resultCard1).toBeTruthy();
		expect(resultCard2).toBeFalsy();
	});

	test('should remove previously inserted type triggered actions if inserting a type', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const fooType = ctx.generateRandomSlug({
			prefix: 'foo',
		});
		const barType = ctx.generateRandomSlug({
			prefix: 'bar',
		});
		const cards = [
			{
				type: 'triggered-action@1.0.0',
				slug: ctx.generateRandomSlug({
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
				slug: ctx.generateRandomSlug({
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
		].map(ctx.jellyfish.defaults);

		const insertedCards = await Bluebird.map(cards, (card) => {
			return ctx.jellyfish.insertCard(
				ctx.context,
				ctx.session,
				card as Contract,
			);
		});

		await ctx.flushAll(ctx.session);

		const typeTypeContract = await ctx.jellyfish.getCardBySlug<TypeContract>(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeTypeContract !== null);

		await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeTypeContract,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
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

		const triggers = await ctx.jellyfish.query(ctx.context, ctx.session, {
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

		const updatedCard = await ctx.jellyfish.getCardById(
			ctx.context,
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
		const typeType = await ctx.jellyfish.getCardBySlug<TypeContract>(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = ctx.generateRandomSlug();

		await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
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
		const typeType = await ctx.jellyfish.getCardBySlug<TypeContract>(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = ctx.generateRandomSlug();
		await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
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
		const typeType = await ctx.jellyfish.getCardBySlug<TypeContract>(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = ctx.generateRandomSlug();

		const element = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
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
			ctx.context,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
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
		const typeType = await ctx.jellyfish.getCardBySlug<TypeContract>(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = ctx.generateRandomSlug();

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
			ctx.context,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
				attachEvents: false,
				reason: null,
			},
			type,
		);

		await ctx.worker.patchCard(
			ctx.context,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
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
			ctx.context,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
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

		const triggers = await ctx.jellyfish.query(ctx.context, ctx.session, {
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
});
