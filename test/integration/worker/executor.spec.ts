/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as _ from 'lodash';
import * as helpers from './helpers';
import Bluebird from 'bluebird';
import { errors, executor, utils } from '../../../lib';

let context: any;

beforeAll(async () => {
	context = await helpers.jellyfish.before();

	context.triggers = [];
	context.stubQueue = [];
	context.executeAction = (_session: string, request: any) => {
		context.stubQueue.push(request);
	};

	context.actionContext = {
		errors,
		cards: context.jellyfish.cards,
		getEventSlug: utils.getEventSlug,
		privilegedSession: context.session,
		context: context.context,
		getCardById: (session: string, id: string, options: any) => {
			return context.jellyfish.getCardById(
				context.context,
				session,
				id,
				options,
			);
		},
		getCardBySlug: (session: string, slug: string, options: any) => {
			return context.jellyfish.getCardBySlug(
				context.context,
				session,
				slug,
				options,
			);
		},
		setTriggers: (ctx: any, triggers: any) => {
			ctx.triggers = triggers;
		},
		insertCard: (session: string, typeCard: any, options: any, object: any) => {
			return executor.insertCard(
				context.context,
				context.jellyfish,
				session,
				typeCard,
				{
					context: context.actionContext,
					library: context.actionLibrary,
					actor: context.actor.id,
					currentTime: new Date(),
					attachEvents: options.attachEvents,
					executeAction: context.executeAction,
				},
				object,
			);
		},
	};

	context.waitForMatch = async (waitQuery: any, times = 20) => {
		if (times === 0) {
			throw new Error('The wait query did not resolve');
		}
		const results = await context.jellyfish.query(
			context.context,
			context.session,
			waitQuery,
		);
		if (results.length > 0) {
			return results[0];
		}
		await Bluebird.delay(500);
		return context.waitForMatch(waitQuery, times - 1);
	};
});

afterAll(() => {
	return helpers.jellyfish.after(context);
});

describe('.replaceCard()', () => {
	test('updating a card must have the correct tail', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const slug = context.generateRandomSlug();
		const result1 = await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: true,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			{
				slug,
				version: '1.0.0',
				data: {
					foo: 1,
				},
			},
		);

		await executor.replaceCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: true,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			{
				slug,
				version: '1.0.0',
				data: {
					foo: 2,
				},
			},
		);

		expect(context.stubQueue).toEqual([]);
		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			result1!.id,
		);
		expect(card).toEqual(
			context.jellyfish.defaults({
				created_at: result1!.created_at,
				updated_at: card.updated_at,
				linked_at: card.linked_at,
				id: result1!.id,
				name: null,
				slug,
				type: 'card@1.0.0',
				data: {
					foo: 2,
				},
			}),
		);

		const tail = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				additionalProperties: true,
				required: ['type', 'data'],
				properties: {
					type: {
						type: 'string',
						enum: ['create@1.0.0', 'update@1.0.0'],
					},
					data: {
						type: 'object',
						required: ['target'],
						properties: {
							target: {
								type: 'string',
								const: result1!.id,
							},
						},
					},
				},
			},
		);

		// "Replace" is an operation that will go away once the database
		// becomes fully immutable, so we don't attempt to calculate a
		// JSON Patch update for it, as we treat it as an exception
		expect(tail.length).toBe(1);
		expect(tail[0].type).toBe('create@1.0.0');
		expect(tail[0].data.payload).toEqual(
			_.pick(result1, ['data', 'slug', 'type', 'version']),
		);
	});
});

describe('.insertCard()', () => {
	test('should insert a card', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const slug = context.generateRandomSlug();
		const result = await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: false,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			{
				slug,
				data: {
					foo: 1,
				},
			},
		);

		expect(context.stubQueue).toEqual([]);
		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			result!.id,
		);
		expect(card).toEqual(
			context.jellyfish.defaults({
				created_at: result!.created_at,
				id: result!.id,
				name: null,
				slug,
				type: 'card@1.0.0',
				data: {
					foo: 1,
				},
			}),
		);
	});

	test('should ignore an explicit type property', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const slug = context.generateRandomSlug();
		const result = await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: false,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			{
				active: true,
				slug,
				type: `${slug}@1.0.0`,
				version: '1.0.0',
				links: {},
				tags: [],
				markers: [],
				requires: [],
				capabilities: [],
				data: {
					foo: 1,
				},
			},
		);

		expect(context.stubQueue).toEqual([]);
		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			result!.id,
		);
		expect(card.type).toBe('card@1.0.0');
	});

	test('should default active to true', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const result = await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: false,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			{
				slug: context.generateRandomSlug(),
				version: '1.0.0',
			},
		);

		expect(context.stubQueue).toEqual([]);
		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			result!.id,
		);
		expect(card.active).toBe(true);
	});

	test('should be able to set active to false', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const result = await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: false,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			{
				slug: context.generateRandomSlug(),
				version: '1.0.0',
				active: false,
			},
		);

		expect(context.stubQueue).toEqual([]);
		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			result!.id,
		);
		expect(card.active).toBe(false);
	});

	test('should provide sane defaults for links', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const result = await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: false,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			{
				slug: context.generateRandomSlug(),
				version: '1.0.0',
			},
		);

		expect(context.stubQueue).toEqual([]);
		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			result!.id,
		);
		expect(card.links).toEqual({});
	});

	test('should provide sane defaults for tags', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const result = await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: false,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			{
				slug: context.generateRandomSlug(),
				version: '1.0.0',
			},
		);

		expect(context.stubQueue).toEqual([]);
		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			result!.id,
		);
		expect(card.tags).toEqual([]);
	});

	test('should provide sane defaults for data', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const result = await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: false,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			{
				slug: context.generateRandomSlug(),
				version: '1.0.0',
			},
		);

		expect(context.stubQueue).toEqual([]);
		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			result!.id,
		);
		expect(card.data).toEqual({});
	});

	test('should be able to set a slug', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const slug = context.generateRandomSlug();
		const result = await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: false,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			{
				slug,
				version: '1.0.0',
			},
		);

		expect(context.stubQueue).toEqual([]);
		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			result!.id,
		);
		expect(card.slug).toBe(slug);
	});

	test('should be able to set a name', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const result = await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: false,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			{
				slug: context.generateRandomSlug(),
				version: '1.0.0',
				name: 'Hello',
			},
		);

		expect(context.stubQueue).toEqual([]);
		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			result!.id,
		);
		expect(card.name).toBe('Hello');
	});

	test('throw if card already exists and override is false', async () => {
		const slug = context.generateRandomSlug();
		await context.jellyfish.insertCard(context.context, context.session, {
			slug,
			type: 'card@1.0.0',
			version: '1.0.0',
		});

		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		await expect(
			executor.insertCard(
				context.context,
				context.jellyfish,
				context.session,
				typeCard,
				{
					currentTime: new Date(),
					attachEvents: false,
					context: context.actionContext,
					library: context.actionLibrary,
					actor: context.actor.id,
					executeAction: context.executeAction,
				},
				{
					version: '1.0.0',
					slug,
					active: false,
				},
			),
		).rejects.toThrow(context.jellyfish.errors.JellyfishElementAlreadyExists);
	});

	test('should add a create event if attachEvents is true', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const result = await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: true,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			{
				version: '1.0.0',
				slug: context.generateRandomSlug(),
			},
		);

		expect(context.stubQueue).toEqual([]);
		const tail = await context.jellyfish.query(
			context.context,
			context.session,
			{
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
			},
		);

		expect(tail.length).toBe(1);
	});

	test('should pass a triggered action as an action originator', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const command = context.generateRandomSlug();
		const triggers = [
			{
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
									const: command,
								},
							},
						},
					},
				},
				action: 'action-test-originator',
				target: typeCard.id,
				type: typeCard.type,
				arguments: {
					properties: {
						slug: command,
					},
				},
				schedule: 'sync',
			},
		];

		await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: true,
				context: context.actionContext,
				library: Object.assign(
					{
						'action-test-originator': {
							card: Object.assign(
								{},
								context.actionLibrary['action-create-card'].card,
								{
									slug: 'action-test-originator',
								},
							),
							handler: async (
								session: string,
								ctx: any,
								card: any,
								request: any,
							) => {
								request.arguments.properties.data =
									request.arguments.properties.data || {};
								request.arguments.properties.data.originator =
									request.originator;
								return context.actionLibrary['action-create-card'].handler(
									session,
									ctx,
									card,
									request,
								);
							},
						},
					},
					context.actionLibrary,
				),
				actor: context.actor.id,
				executeAction: context.executeAction,
				triggers,
			},
			{
				slug: context.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command,
				},
			},
		);

		const resultCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${command}@1.0.0`,
			{
				type: typeCard.slug,
			},
		);

		expect(resultCard.data.originator).toBe(
			'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
		);
	});

	test('should be able to override a triggered action originator', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const command = context.generateRandomSlug();
		const triggers = [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				schedule: 'sync',
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
				action: 'action-test-originator',
				target: typeCard.id,
				type: typeCard.type,
				arguments: {
					properties: {
						slug: command,
					},
				},
			},
		];

		await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: true,
				context: context.actionContext,
				originator: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				library: Object.assign(
					{
						'action-test-originator': {
							card: Object.assign(
								{},
								context.actionLibrary['action-create-card'].card,
								{
									slug: 'action-test-originator',
								},
							),
							handler: async (session, ctx, card, request) => {
								request.arguments.properties.data =
									request.arguments.properties.data || {};
								request.arguments.properties.data.originator =
									request.originator;
								return context.actionLibrary['action-create-card'].handler(
									session,
									ctx,
									card,
									request,
								);
							},
						},
					},
					context.actionLibrary,
				),
				actor: context.actor.id,
				executeAction: context.executeAction,
				triggers,
			},
			{
				slug: context.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command,
				},
			},
		);

		const resultCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${command}@1.0.0`,
			{
				type: typeCard.slug,
			},
		);

		expect(resultCard.data.originator).toBe(
			'4a962ad9-20b5-4dd8-a707-bf819593cc84',
		);
	});

	test('.insertCard() should execute one matching triggered action', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const command = context.generateRandomSlug();
		const triggers = [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				schedule: 'sync',
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
				type: typeCard.type,
				arguments: {
					properties: {
						slug: command,
					},
				},
			},
		];

		const result = await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: true,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
				triggers,
			},
			{
				slug: context.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command,
				},
			},
		);

		const tail = await context.jellyfish.query(
			context.context,
			context.session,
			{
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
			},
		);

		expect(tail.length).toBe(1);
		expect(context.stubQueue).toEqual([]);

		const resultCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${command}@1.0.0`,
			{
				type: typeCard.slug,
			},
		);

		expect(resultCard).toBeTruthy();
	});

	test('should not execute non-matching triggered actions', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const command = context.generateRandomSlug();
		const triggers = [
			{
				schedule: 'sync',
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
		];

		await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: true,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
				triggers,
			},
			{
				slug: context.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command: context.generateRandomSlug(),
				},
			},
		);

		expect(context.stubQueue).toEqual([]);
		const resultCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${command}@1.0.0`,
			{
				type: typeCard.slug,
			},
		);

		expect(resultCard).toBeFalsy();
	});

	test('should execute more than one matching triggered action', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const command1 = context.generateRandomSlug();
		const command2 = context.generateRandomSlug();
		const triggers = [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				schedule: 'sync',
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
				type: typeCard.type,
				arguments: {
					properties: {
						slug: command1,
					},
				},
			},
			{
				id: 'd6cacdef-f53b-4b5b-8aa2-8476e48248a4',
				schedule: 'sync',
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
				type: typeCard.type,
				arguments: {
					properties: {
						slug: command2,
					},
				},
			},
		];

		await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: true,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
				triggers,
			},
			{
				slug: context.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command: command1,
				},
			},
		);

		expect(context.stubQueue).toEqual([]);

		const resultCard1 = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${command1}@1.0.0`,
			{
				type: typeCard.slug,
			},
		);

		const resultCard2 = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${command2}@1.0.0`,
			{
				type: typeCard.slug,
			},
		);

		expect(resultCard1).toBeTruthy();
		expect(resultCard2).toBeTruthy();
	});

	test('should execute the matching triggered actions given more than one', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const command1 = context.generateRandomSlug();
		const command2 = context.generateRandomSlug();
		const triggers = [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				schedule: 'sync',
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
				type: typeCard.type,
				arguments: {
					properties: {
						slug: command1,
					},
				},
			},
			{
				id: 'd6cacdef-f53b-4b5b-8aa2-8476e48248a4',
				schedule: 'sync',
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
				type: typeCard.type,
				arguments: {
					properties: {
						slug: command2,
					},
				},
			},
		];

		await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: true,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
				triggers,
			},
			{
				slug: context.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command: command1,
				},
			},
		);

		expect(context.stubQueue).toEqual([]);

		const resultCard1 = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${command1}@1.0.0`,
			{
				type: typeCard.slug,
			},
		);

		const resultCard2 = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${command2}@1.0.0`,
			{
				type: typeCard.slug,
			},
		);

		expect(resultCard1).toBeTruthy();
		expect(resultCard2).toBeFalsy();
	});

	test('should remove previously inserted type triggered actions if inserting a type', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const fooType = context.generateRandomSlug({
			prefix: 'foo',
		});
		const barType = context.generateRandomSlug({
			prefix: 'bar',
		});
		const cards = [
			{
				type: 'triggered-action@1.0.0',
				slug: context.generateRandomSlug({
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
				slug: context.generateRandomSlug({
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
		].map(context.kernel.defaults);

		const insertedCards = await Bluebird.map(cards, (card) => {
			return context.jellyfish.insertCard(
				context.context,
				context.session,
				card,
			);
		});

		await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			await context.jellyfish.getCardBySlug(
				context.context,
				context.session,
				'type@latest',
			),
			{
				currentTime: new Date(),
				attachEvents: false,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
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

		const triggers = await context.jellyfish.query(
			context.context,
			context.session,
			{
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
			},
		);
		const updatedCard = await context.jellyfish.getCardById(
			context.context,
			context.session,
			insertedCards[1].id,
		);

		expect(triggers).toEqual([
			Object.assign({}, updatedCard, {
				id: triggers[0].id,
			}),
		]);
	});

	test('should add a triggered action given a type with an AGGREGATE formula', async () => {
		const typeType = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);

		const slug = context.generateRandomSlug();
		await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeType,
			{
				currentTime: new Date(),
				attachEvents: false,
				executeAction: context.executeAction,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				setTriggers: context.actionContext.setTriggers,
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

		const trigger = await context.waitForMatch({
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
			data: {
				schedule: 'async',
				type: trigger.data.type,
				target: trigger.data.target,
				action: trigger.data.action,
				arguments: trigger.data.arguments,
				filter: trigger.data.filter,
			},
		});
	});

	test('should pre-register a triggered action if using AGGREGATE', async () => {
		const typeType = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);

		let localTriggers: any[] = [];
		const slug = context.generateRandomSlug();
		await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeType,
			{
				currentTime: new Date(),
				attachEvents: false,
				executeAction: context.executeAction,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				setTriggers: (_context: any, triggers: any[]) => {
					localTriggers = triggers;
				},
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

		expect(localTriggers).toEqual([
			{
				schedule: 'async',
				id: localTriggers[0].id,
				slug: `triggered-action-${slug}-data-mentions`,
				action: 'action-set-add@1.0.0',
				target: {
					$eval: "source.links['is attached to'][0].id",
				},
				filter: localTriggers[0].filter,
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
			},
		]);
	});

	test('should update pre-registered triggered actions if removing an AGGREGATE', async () => {
		const typeType = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);

		const localTriggers: any[] = [];
		const slug = context.generateRandomSlug();
		const element = await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeType,
			{
				currentTime: new Date(),
				attachEvents: false,
				executeAction: context.executeAction,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				setTriggers: context.actionContext.setTriggers,
				triggers: localTriggers,
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

		await executor.patchCard(
			context.context,
			context.jellyfish,
			context.session,
			typeType,
			{
				currentTime: new Date(),
				attachEvents: false,
				executeAction: context.executeAction,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				setTriggers: context.actionContext.setTriggers,
				triggers: localTriggers,
			},
			element!,
			[
				{
					op: 'remove',
					path: '/data/schema/properties/data/properties/mentions/$$formula',
				},
			],
		);

		expect(localTriggers).toEqual([]);
	});

	test('should add multiple triggered actions given a type with an AGGREGATE formula', async () => {
		const typeType = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);

		const slug = context.generateRandomSlug();
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

		const element = await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeType,
			{
				currentTime: new Date(),
				attachEvents: false,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
				setTriggers: context.actionContext.setTriggers,
			},
			type,
		);

		await executor.patchCard(
			context.context,
			context.jellyfish,
			context.session,
			typeType,
			{
				currentTime: new Date(),
				attachEvents: false,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
				setTriggers: context.actionContext.setTriggers,
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

		await executor.patchCard(
			context.context,
			context.jellyfish,
			context.session,
			typeType,
			{
				currentTime: new Date(),
				attachEvents: false,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
				setTriggers: context.actionContext.setTriggers,
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

		const triggers = await context.jellyfish.query(
			context.context,
			context.session,
			{
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
			},
		);

		expect(triggers.length).toBe(1);
	});
});

describe('.patchCard()', () => {
	test('should ignore pointless updates', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const result1 = await executor.insertCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: true,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			{
				slug: context.generateRandomSlug(),
				version: '1.0.0',
				active: true,
			},
		);

		const result2 = await executor.patchCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: true,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			result1!,
			[],
		);

		const result3 = await executor.patchCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: false,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			result1!,
			[
				{
					op: 'replace',
					path: '/active',
					value: true,
				},
			],
		);

		expect(context.stubQueue).toEqual([]);
		expect(result1).toBeTruthy();
		expect(result2).toBeFalsy();
		expect(result3).toBeFalsy();

		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			result1!.id,
		);
		expect(card.created_at).toBe(result1!.created_at);
	});

	test('should not upsert if no changes were made', async () => {
		const element = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				slug: context.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		await executor.patchCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: true,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			element,
			[],
		);

		expect(context.stubQueue).toEqual([]);
	});

	test('should set a card to inactive', async () => {
		const previousCard = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				slug: context.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		await executor.patchCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: false,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			previousCard,
			[
				{
					op: 'replace',
					path: '/active',
					value: false,
				},
			],
		);

		expect(context.stubQueue).toEqual([]);
		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			previousCard.id,
		);
		expect(card.active).toBe(false);
	});

	test('should add an update event if attachEvents is true', async () => {
		const element = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				slug: context.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const result = await executor.patchCard(
			context.context,
			context.jellyfish,
			context.session,
			typeCard,
			{
				currentTime: new Date(),
				attachEvents: true,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			element,
			[
				{
					op: 'replace',
					path: '/active',
					value: false,
				},
			],
		);

		expect(context.stubQueue).toEqual([]);
		const tail = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				additionalProperties: true,
				required: ['type', 'data'],
				properties: {
					type: {
						type: 'string',
						const: 'update@1.0.0',
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
			},
		);

		expect(tail.length).toBe(1);
	});

	test('should remove previously inserted type triggered actions if deactivating a type', async () => {
		const slug = context.generateRandomSlug();
		const type = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'type@1.0.0',
				version: '1.0.0',
				slug,
				data: {
					schema: {
						type: 'object',
					},
				},
			},
		);

		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		await context.jellyfish.insertCard(context.context, context.session, {
			type: 'triggered-action@1.0.0',
			slug: context.generateRandomSlug({
				prefix: 'triggered-action',
			}),
			version: '1.0.0',
			data: {
				type: `${slug}@1.0.0`,
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
		});

		await executor.patchCard(
			context.context,
			context.jellyfish,
			context.session,
			await context.jellyfish.getCardBySlug(
				context.context,
				context.session,
				'type@latest',
			),
			{
				currentTime: new Date(),
				attachEvents: false,
				context: context.actionContext,
				library: context.actionLibrary,
				actor: context.actor.id,
				executeAction: context.executeAction,
			},
			type,
			[
				{
					op: 'replace',
					path: '/active',
					value: false,
				},
			],
		);

		const triggers = await context.jellyfish.query(
			context.context,
			context.session,
			{
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
			},
		);

		expect(triggers).toEqual([]);
	});
});

describe('.run()', () => {
	test('should create a card', async () => {
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const slug = context.generateRandomSlug();
		const result = await executor.run(
			context.jellyfish,
			context.session,
			context.actionContext,
			{
				'action-create-card': context.actionLibrary['action-create-card'],
			},
			{
				actor: context.actor.id,
				context: context.context,
				action: actionCard,
				timestamp: '2018-07-04T00:22:52.247Z',
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug,
						version: '1.0.0',
					},
				},
			},
		);

		expect(result).toEqual({
			id: result.id,
			type: 'card@1.0.0',
			version: '1.0.0',
			slug,
		});
	});

	test('should throw if the input card does not exist', async () => {
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);
		await expect(
			executor.run(
				context.jellyfish,
				context.session,
				context.actionContext,
				{
					'action-create-card': context.actionLibrary['action-create-card'],
				},
				{
					actor: context.actor.id,
					action: actionCard,
					context: context.context,
					timestamp: '2018-07-04T00:22:52.247Z',
					card: 'foobarbaz@9.9.9',
					type: 'card@1.0.0',
					arguments: {
						properties: {
							version: '1.0.0',
							slug: 'foo-bar-baz',
						},
					},
				},
			),
		).rejects.toThrow(errors.WorkerNoElement);
	});

	test('should throw if the actor does not exist', async () => {
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		await expect(
			executor.run(
				context.jellyfish,
				context.session,
				context.actionContext,
				{
					'action-create-card': context.actionLibrary['action-create-card'],
				},
				{
					actor: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
					action: actionCard,
					context: context.context,
					timestamp: '2018-07-04T00:22:52.247Z',
					card: typeCard.id,
					type: typeCard.type,
					arguments: {
						properties: {
							version: '1.0.0',
							slug: 'foo-bar-baz',
						},
					},
				},
			),
		).rejects.toThrow(errors.WorkerNoElement);
	});

	test('should throw if input card does not match the action filter', async () => {
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);
		await expect(
			executor.run(
				context.jellyfish,
				context.session,
				context.actionContext,
				{
					'action-create-card': context.actionLibrary['action-create-card'],
				},
				{
					actor: context.actor.id,
					action: actionCard,
					context: context.context,
					timestamp: '2018-07-04T00:22:52.247Z',
					card: actionCard.id,
					type: actionCard.type,
					arguments: {
						properties: {
							version: '1.0.0',
							slug: 'foo-bar-baz',
						},
					},
				},
			),
		).rejects.toThrow(errors.WorkerSchemaMismatch);
	});

	test('should throw if the arguments do not match the action', async () => {
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		await expect(
			executor.run(
				context.jellyfish,
				context.session,
				context.actionContext,
				{
					'action-create-card': context.actionLibrary['action-create-card'],
				},
				{
					actor: context.actor.id,
					action: actionCard,
					context: context.context,
					timestamp: '2018-07-04T00:22:52.247Z',
					card: typeCard.id,
					type: typeCard.type,
					arguments: {
						foo: 'bar',
						bar: 'baz',
					},
				},
			),
		).rejects.toThrow(errors.WorkerSchemaMismatch);
	});

	test('should throw if the action has no corresponding implementation', async () => {
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		await expect(
			executor.run(
				context.jellyfish,
				context.session,
				context.actionContext,
				{},
				{
					actor: context.actor.id,
					action: actionCard,
					context: context.context,
					timestamp: '2018-07-04T00:22:52.247Z',
					card: typeCard.id,
					type: typeCard.type,
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug: 'foo-bar-baz',
						},
					},
				},
			),
		).rejects.toThrow(errors.WorkerInvalidAction);
	});
});
