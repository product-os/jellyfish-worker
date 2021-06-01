/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import Bluebird from 'bluebird';
import * as helpers from './helpers';
import { strict as assert } from 'assert';
import { Contract, TypeContract } from '@balena/jellyfish-types/build/core';
import { v4 as uuid } from 'uuid';
import _ from 'lodash';

let ctx: helpers.IntegrationTestContext;

beforeAll(async () => {
	ctx = await helpers.before();
});

afterAll(() => {
	return helpers.after(ctx);
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
		const id = uuid();

		ctx.worker.setTriggers(ctx.context, [
			{
				id,
				slug: 'triggered-action-xr3523c5',
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
		const id = uuid();
		ctx.worker.setTriggers(ctx.context, [
			{
				id,
				slug: `triggered-action-foo-bar-${id.substr(0, 7)}`,
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
		]);

		const originatorId = uuid();

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
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
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
			{
				id: 'xb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar-xb3523c5',
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
			{
				id: uuid(),
				slug: 'trigger-action-ib3523c5',
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
			{
				id: uuid(),
				slug: 'triggered-action-d67acdef',
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
			{
				id: uuid(),
				slug: 'triggered-action-cx3523c5',
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
			{
				id: uuid(),
				slug: 'triggered-action-d68acdef',
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
					'filter',
					'$$links',
					'is attached to',
					'properties',
					'type',
					'const',
				]) === `${slug}@1.0.0`
			);
		});

		expect(generatedTrigger).toEqual({
			id: generatedTrigger!.id,
			slug: `triggered-action-${slug}-data-mentions`,
			action: 'action-set-add@1.0.0',
			target: {
				$eval: "source.links['is attached to'][0].id",
			},
			filter: generatedTrigger!.filter,
			arguments: {
				property: 'data.mentions',
				value: {
					$if: 'source.data.payload.mentions',
					then: {
						$eval: 'source.data.payload.mentions',
					},
					else: [],
				},
			},
		});
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
