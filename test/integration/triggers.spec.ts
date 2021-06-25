/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { v4 as uuidv4 } from 'uuid';
import Bluebird from 'bluebird';
import { strict as assert } from 'assert';
import * as helpers from './helpers';
import { triggers, errors } from '../../lib/index';
import { Contract, TypeContract } from '@balena/jellyfish-types/build/core';

let ctx: helpers.IntegrationTestContext;
let typeCard: TypeContract;

beforeAll(async () => {
	ctx = await helpers.before();

	const contract = (await ctx.jellyfish.getCardBySlug(
		ctx.context,
		ctx.session,
		'card@latest',
	)) as TypeContract;

	assert(contract !== null);

	typeCard = contract;

	await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
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
	return helpers.after(ctx);
});

describe('.getRequest()', () => {
	it('should return null if the filter only has a type but there is no match', async () => {
		const trigger = {
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
		};

		const insertedCard = await ctx.jellyfish.insertCard(
			ctx.context,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: uuidv4(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {},
			},
		);

		// TS-TODO: fix cast to any
		const request = await triggers.getRequest(
			ctx.jellyfish,
			trigger as any,
			insertedCard,
			{
				currentDate: new Date(),
				mode: 'insert',
				context: ctx.context,
				session: ctx.session,
			},
		);

		expect(request).toBeFalsy();
	});

	it('should return a request if the filter only has a type and there is a match', async () => {
		const trigger = {
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
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
		};

		const date = new Date();

		const insertedCard = await ctx.jellyfish.insertCard(
			ctx.context,
			ctx.session,
			{
				type: 'foo@1.0.0',
				version: '1.0.0',
				slug: uuidv4(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {},
			},
		);

		const request = await triggers.getRequest(
			ctx.jellyfish,
			trigger,
			insertedCard,
			{
				currentDate: date,
				mode: 'insert',
				context: ctx.context,
				session: ctx.session,
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			currentDate: date,
			card: typeCard.id,
			context: ctx.context,
			originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			arguments: {
				properties: {
					slug: 'foo-bar-baz',
				},
			},
		});
	});

	it('should return a request if the input card is null', async () => {
		const trigger = {
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
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
		};

		const date = new Date();

		const request = await triggers.getRequest(ctx.jellyfish, trigger, null, {
			currentDate: date,
			mode: 'insert',
			context: ctx.context,
			session: ctx.session,
		});

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			currentDate: date,
			card: typeCard.id,
			context: ctx.context,
			originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			arguments: {
				properties: {
					slug: 'foo-bar-baz',
				},
			},
		});
	});

	it('should return null if referencing source when no input card', async () => {
		const trigger = {
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
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
					slug: {
						$eval: 'source.type',
					},
				},
			},
		};

		const request = await triggers.getRequest(ctx.jellyfish, trigger, null, {
			currentDate: new Date(),
			mode: 'insert',
			context: ctx.context,
			session: ctx.session,
		});

		expect(request).toBe(null);
	});

	it('should return a request given a complex matching filter', async () => {
		const trigger = {
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
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
		};

		const date = new Date();

		const insertedCard = await ctx.jellyfish.insertCard(
			ctx.context,
			ctx.session,
			{
				type: 'foo@1.0.0',
				version: '1.0.0',
				slug: uuidv4(),
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
			ctx.jellyfish,
			trigger,
			insertedCard,
			{
				currentDate: date,
				mode: 'insert',
				context: ctx.context,
				session: ctx.session,
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			currentDate: date,
			card: typeCard.id,
			context: ctx.context,
			originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			arguments: {
				properties: {
					slug: 'foo-bar-baz',
				},
			},
		});
	});

	it('should return null given a complex non-matching filter', async () => {
		const trigger = {
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
		};

		const insertedCard = await ctx.jellyfish.insertCard(
			ctx.context,
			ctx.session,
			{
				type: 'foo@1.0.0',
				version: '1.0.0',
				slug: uuidv4(),
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
			ctx.jellyfish,
			trigger as any,
			insertedCard,
			{
				currentDate: new Date(),
				mode: 'insert',
				context: ctx.context,
				session: ctx.session,
			},
		);

		expect(request).toBeFalsy();
	});

	it('should parse source templates in the triggered action arguments', async () => {
		const trigger = {
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
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
		};

		const date = new Date();

		const insertedCard = await ctx.jellyfish.insertCard(
			ctx.context,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: uuidv4(),
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
			ctx.jellyfish,
			trigger,
			insertedCard,
			{
				currentDate: date,
				mode: 'insert',
				context: ctx.context,
				session: ctx.session,
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			card: typeCard.id,
			context: ctx.context,
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
		const trigger = {
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
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
		};

		const date = new Date();

		const insertedCard = await ctx.jellyfish.insertCard(
			ctx.context,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: uuidv4(),
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
			ctx.jellyfish,
			trigger,
			insertedCard,
			{
				currentDate: date,
				context: ctx.context,
				session: ctx.session,
				mode: 'update',
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			card: typeCard.id,
			context: ctx.context,
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
		const trigger = {
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
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
		};

		const date = new Date();

		const insertedCard = await ctx.jellyfish.insertCard(
			ctx.context,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: uuidv4(),
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
			ctx.jellyfish,
			trigger,
			insertedCard,
			{
				currentDate: date,
				context: ctx.context,
				session: ctx.session,
				mode: 'insert',
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			card: typeCard.id,
			context: ctx.context,
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
		const trigger = {
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
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
		};

		const date = new Date();

		const insertedCard = await ctx.jellyfish.insertCard(
			ctx.context,
			ctx.session,
			{
				slug: uuidv4(),
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
			ctx.jellyfish,
			trigger,
			insertedCard,
			{
				currentDate: date,
				context: ctx.context,
				session: ctx.session,
				mode: 'insert',
			},
		);

		expect(request).toBe(null);
	});

	it('should parse timestamp templates in the triggered action arguments', async () => {
		const trigger = {
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			mode: 'insert',
			filter: {
				type: 'object',
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
		};

		const currentDate = new Date();

		const insertedCard = await ctx.jellyfish.insertCard(
			ctx.context,
			ctx.session,
			{
				slug: uuidv4(),
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
			ctx.jellyfish,
			trigger,
			insertedCard,
			{
				currentDate,
				mode: 'insert',
				context: ctx.context,
				session: ctx.session,
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			currentDate,
			card: typeCard.id,
			context: ctx.context,
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
		const trigger = {
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
		};

		const insertedCard = await ctx.jellyfish.insertCard(
			ctx.context,
			ctx.session,
			{
				slug: uuidv4(),
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
			ctx.jellyfish,
			trigger as any,
			insertedCard,
			{
				currentDate: new Date(),
				mode: 'insert',
				context: ctx.context,
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
				slug: ctx.generateRandomSlug({
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
		].map(ctx.jellyfish.defaults);

		const insertedCards = await Bluebird.map(cards, (card) => {
			return ctx.jellyfish.insertCard(
				ctx.context,
				ctx.session,
				card as Contract,
			);
		});

		const updatedCard = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			insertedCards[0].id,
		);

		const result = await triggers.getTypeTriggers(
			ctx.context,
			ctx.jellyfish,
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
		const typeSlug = ctx.generateRandomSlug();
		const cards = [
			{
				type: 'triggered-action@1.0.0',
				slug: ctx.generateRandomSlug({
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
		].map(ctx.jellyfish.defaults);

		for (const card of cards) {
			await ctx.jellyfish.insertCard(
				ctx.context,
				ctx.session,
				card as Contract,
			);
		}

		const result = await triggers.getTypeTriggers(
			ctx.context,
			ctx.jellyfish,
			ctx.session,
			`${typeSlug}@1.0.0`,
		);

		expect(result).toEqual([]);
	});

	it('should ignore non-matching cards', async () => {
		const typeSlug = ctx.generateRandomSlug();
		const cards = [
			{
				type: 'triggered-action@1.0.0',
				slug: ctx.generateRandomSlug({
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
				slug: ctx.generateRandomSlug({
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
		].map(ctx.jellyfish.defaults);

		const insertedCards = await Bluebird.map(cards, (card) => {
			return ctx.jellyfish.insertCard(
				ctx.context,
				ctx.session,
				card as Contract,
			);
		});

		const result = await triggers.getTypeTriggers(
			ctx.context,
			ctx.jellyfish,
			ctx.session,
			`${typeSlug}@1.0.0`,
		);

		const updatedCard = await ctx.jellyfish.getCardById(
			ctx.context,
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
		const typeSlug = ctx.generateRandomSlug();
		const cards = [
			{
				type: 'triggered-action@1.0.0',
				slug: ctx.generateRandomSlug({
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
				slug: ctx.generateRandomSlug({
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
		].map(ctx.jellyfish.defaults);

		const insertedCards = await Bluebird.map(cards, (card) => {
			return ctx.jellyfish.insertCard(
				ctx.context,
				ctx.session,
				card as Contract,
			);
		});

		const result = await triggers.getTypeTriggers(
			ctx.context,
			ctx.jellyfish,
			ctx.session,
			`${typeSlug}@1.0.0`,
		);

		const updatedCard = await ctx.jellyfish.getCardById(
			ctx.context,
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
				slug: ctx.generateRandomSlug({
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
		].map(ctx.jellyfish.defaults);

		for (const card of cards) {
			await ctx.jellyfish.insertCard(
				ctx.context,
				ctx.session,
				card as Contract,
			);
		}

		const result = await triggers.getTypeTriggers(
			ctx.context,
			ctx.jellyfish,
			ctx.session,
			`${ctx.generateRandomSlug()}@1.0.0`,
		);
		expect(result).toEqual([]);
	});
});

describe('.getStartDate()', () => {
	it('should return epoch if the trigger has no start date', async () => {
		// TS-TODO: remove the cast to "any"
		const result = triggers.getStartDate({
			type: 'triggered-action@1.0.0',
			slug: ctx.generateRandomSlug({
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
		} as any);

		expect(result.getTime()).toBe(0);
	});

	it('should return epoch if the trigger has an invalid date', async () => {
		// TS-TODO: remove the cast to "any"
		const result = triggers.getStartDate({
			type: 'triggered-action@1.0.0',
			slug: ctx.generateRandomSlug({
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
		} as any);

		expect(result.getTime()).toBe(0);
	});

	it('should return the specified date if valid', async () => {
		const date = new Date();
		// TS-TODO: Remove the cast to "any"
		const result = triggers.getStartDate({
			type: 'triggered-action@1.0.0',
			slug: ctx.generateRandomSlug({
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
		} as any);

		expect(result.getTime()).toBe(date.getTime());
	});
});

describe('.getNextExecutionDate()', () => {
	it('should return null if no interval', async () => {
		const date = new Date();

		// TS-TODO: fix the cast to any here
		const result = triggers.getNextExecutionDate(
			{
				type: 'triggered-action@1.0.0',
				slug: ctx.generateRandomSlug({
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
			} as any,
			date,
		);

		expect(result).toEqual(null);
	});

	it('should return epoch if no last execution date', async () => {
		// TS-TODO: fix the cast to any here
		const result = triggers.getNextExecutionDate({
			type: 'triggered-action@1.0.0',
			slug: ctx.generateRandomSlug({
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
		} as any);

		expect(result!.getTime()).toBe(0);
	});

	it('should return epoch if last execution date is not a valid date', async () => {
		// TS-TODO: Remove cast to any
		const result = triggers.getNextExecutionDate(
			{
				type: 'triggered-action@1.0.0',
				slug: ctx.generateRandomSlug({
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
			} as any,
			new Date('foobar'),
		);

		expect(result!.getTime()).toBe(0);
	});

	it('should return epoch if last execution date is not a date', async () => {
		// TS-TODO: fix cast
		const result = triggers.getNextExecutionDate(
			{
				type: 'triggered-action@1.0.0',
				slug: ctx.generateRandomSlug({
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
			} as any,
			'foobar' as any,
		);

		expect(result!.getTime()).toBe(0);
	});

	it('should throw if the interval is invalid', async () => {
		const date = new Date();

		expect(() => {
			// TS-TODO: fix cast
			triggers.getNextExecutionDate(
				{
					type: 'triggered-action@1.0.0',
					slug: ctx.generateRandomSlug({
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
				} as any,
				date,
			);
		}).toThrow(errors.WorkerInvalidDuration);
	});

	it('should return the next interval after the last execution', async () => {
		// TS-TODO: fix cast
		const result = triggers.getNextExecutionDate(
			{
				type: 'triggered-action@1.0.0',
				slug: ctx.generateRandomSlug({
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
			} as any,
			new Date('2018-01-01T05:30:00.000Z'),
		);

		expect(result!.toISOString()).toBe('2018-01-01T06:00:00.000Z');
	});

	it('should return the start date if the last execution happened way before the start date', async () => {
		// TS-TODO: fix cast to any
		const result = triggers.getNextExecutionDate(
			{
				type: 'triggered-action@1.0.0',
				slug: ctx.generateRandomSlug({
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
			} as any,
			new Date('2018-01-01T01:00:00.000Z'),
		);

		expect(result!.toISOString()).toBe('2018-01-01T05:00:00.000Z');
	});

	it('should return the subsequent interval if the last execution happened just before the start date', async () => {
		// TS-TODO: fix cast to any
		const result = triggers.getNextExecutionDate(
			{
				type: 'triggered-action@1.0.0',
				slug: ctx.generateRandomSlug({
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
			} as any,
			new Date('2018-01-01T04:50:00.000Z'),
		);

		expect(result!.toISOString()).toBe('2018-01-01T06:00:00.000Z');
	});

	it('should return the next interval if the last execution is the start date', async () => {
		// TS-TODO: Fix cast to any
		const result = triggers.getNextExecutionDate(
			{
				type: 'triggered-action@1.0.0',
				slug: ctx.generateRandomSlug({
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
			} as any,
			new Date('2018-01-01T05:00:00.000Z'),
		);

		expect(result!.toISOString()).toBe('2018-01-01T06:00:00.000Z');
	});
});
