/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as helpers from '../helpers';
import { strict as assert } from 'assert';

let ctx: helpers.IntegrationTestContext;

beforeAll(async () => {
	ctx = await helpers.worker.before();
});

afterAll(() => {
	return helpers.worker.after(ctx);
});

describe('action-update-card', () => {
	it('should fail to update a card if the schema does not match', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug: ctx.generateRandomSlug(),
						version: '1.0.0',
						data: {
							foo: 'bar',
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const result: any = await ctx.queue.producer.waitResults(
			ctx.context,
			request,
		);
		expect(result.error).toBe(false);

		await ctx.queue.producer.enqueue(ctx.worker.getId(), ctx.session, {
			action: 'action-update-card@1.0.0',
			context: ctx.context,
			card: result.data.id,
			type: result.data.type,
			arguments: {
				reason: null,
				patch: [
					{
						op: 'add',
						path: '/foobar',
						value: true,
					},
				],
			},
		});

		await expect(ctx.flush(ctx.session)).rejects.toThrow(
			ctx.jellyfish.errors.JellyfishSchemaMismatch,
		);
	});

	it('should update a card to add an extra property', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();
		const createRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug,
						version: '1.0.0',
						data: {
							foo: 'bar',
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const createResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const updateRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-update-card@1.0.0',
				context: ctx.context,
				card: createResult.data.id,
				type: createResult.data.type,
				arguments: {
					reason: null,
					patch: [
						{
							op: 'add',
							path: '/data/bar',
							value: 'baz',
						},
					],
				},
			},
		);

		await ctx.flush(ctx.session);
		const updateResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const updateCard = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			updateResult.data.id,
		);

		assert(updateCard !== null);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			updateResult.data.id,
		);

		assert(card !== null);

		expect(card).toEqual(
			ctx.kernel.defaults({
				created_at: updateCard.created_at,
				updated_at: updateCard.updated_at,
				linked_at: card.linked_at,
				id: updateResult.data.id,
				slug,
				name: null,
				version: '1.0.0',
				type: 'card@1.0.0',
				links: card.links,
				data: {
					foo: 'bar',
					bar: 'baz',
				},
			}),
		);
	});

	it('should update a card to set active to false', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();
		const createRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
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

		await ctx.flush(ctx.session);
		const createResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const updateRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-update-card@1.0.0',
				context: ctx.context,
				card: createResult.data.id,
				type: createResult.data.type,
				arguments: {
					reason: null,
					patch: [
						{
							op: 'replace',
							path: '/active',
							value: false,
						},
					],
				},
			},
		);

		await ctx.flush(ctx.session);
		const updateResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			updateResult.data.id,
		);

		assert(card !== null);

		expect(card).toEqual(
			ctx.kernel.defaults({
				created_at: card.created_at,
				updated_at: card.updated_at,
				linked_at: card.linked_at,
				id: updateResult.data.id,
				version: '1.0.0',
				name: null,
				slug,
				type: 'card@1.0.0',
				active: false,
				links: card.links,
			}),
		);
	});

	it('should update a card along with a reason', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const createRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug: ctx.generateRandomSlug(),
						version: '1.0.0',
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const createResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const updateRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-update-card@1.0.0',
				context: ctx.context,
				card: createResult.data.id,
				type: createResult.data.type,
				arguments: {
					reason: 'This card should have been inactive',
					patch: [
						{
							op: 'replace',
							path: '/active',
							value: false,
						},
					],
				},
			},
		);

		await ctx.flush(ctx.session);
		const updateResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const timeline = await ctx.jellyfish.query(ctx.context, ctx.session, {
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
					additionalProperties: true,
					properties: {
						target: {
							type: 'string',
							const: updateResult.data.id,
						},
					},
				},
			},
		});

		expect(timeline.length).toBe(1);
		expect(timeline[0].name).toBe('This card should have been inactive');
	});

	it('should update a card to set active to false using the card slug as input', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const createRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
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
		);

		await ctx.flush(ctx.session);
		const createResult = await ctx.queue.producer.waitResults(
			ctx.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const updateRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-update-card@1.0.0',
				context: ctx.context,
				card: 'foo-bar-baz',
				type: 'card@1.0.0',
				arguments: {
					reason: null,
					patch: [
						{
							op: 'replace',
							path: '/active',
							value: false,
						},
					],
				},
			},
		);

		await ctx.flush(ctx.session);
		const updateResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			updateResult.data.id,
		);

		assert(card !== null);

		expect(card).toEqual(
			ctx.kernel.defaults({
				created_at: card.created_at,
				updated_at: card.updated_at,
				linked_at: card.linked_at,
				id: updateResult.data.id,
				type: 'card@1.0.0',
				name: null,
				version: '1.0.0',
				slug: 'foo-bar-baz',
				active: false,
				links: card.links,
			}),
		);
	});

	it('should update a card to override an array property', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();

		const createRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug,
						version: '1.0.0',
						data: {
							roles: ['guest'],
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const createResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const updateRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-update-card@1.0.0',
				context: ctx.context,
				card: createResult.data.id,
				type: createResult.data.type,
				arguments: {
					reason: null,
					patch: [
						{
							op: 'replace',
							path: '/data/roles',
							value: [],
						},
					],
				},
			},
		);

		await ctx.flush(ctx.session);
		const updateResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			updateResult.data.id,
		);

		assert(card !== null);

		expect(card).toEqual(
			ctx.kernel.defaults({
				created_at: card.created_at,
				updated_at: card.updated_at,
				linked_at: card.linked_at,
				id: updateResult.data.id,
				type: 'card@1.0.0',
				name: null,
				slug,
				version: '1.0.0',
				links: card.links,
				data: {
					roles: [],
				},
			}),
		);
	});

	it('should add an update event if updating a card', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();

		const createRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug,
						version: '1.0.0',
						data: {
							foo: 1,
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const createResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const updateRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-update-card@1.0.0',
				context: ctx.context,
				card: createResult.data.id,
				type: createResult.data.type,
				arguments: {
					reason: null,
					patch: [
						{
							op: 'replace',
							path: '/data/foo',
							value: 2,
						},
					],
				},
			},
		);

		await ctx.flush(ctx.session);
		const updateResult = await ctx.queue.producer.waitResults(
			ctx.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const timeline = await ctx.jellyfish.query(
			ctx.context,
			ctx.session,
			{
				type: 'object',
				additionalProperties: true,
				required: ['data'],
				properties: {
					data: {
						type: 'object',
						required: ['target'],
						additionalProperties: true,
						properties: {
							target: {
								type: 'string',
								const: createResult.data.id,
							},
						},
					},
				},
			},
			{
				sortBy: 'created_at',
			},
		);

		expect(timeline).toEqual(
			[
				{
					created_at: timeline[0].created_at,
					linked_at: timeline[0].linked_at,
					updated_at: null,
					id: timeline[0].id,
					name: null,
					version: '1.0.0',
					type: 'create@1.0.0',
					slug: timeline[0].slug,
					links: timeline[0].links,
					data: {
						actor: ctx.actor.id,
						target: createResult.data.id,
						timestamp: timeline[0].data.timestamp,
						payload: {
							slug,
							type: 'card@1.0.0',
							version: '1.0.0',
							data: {
								foo: 1,
							},
						},
					},
				},
				{
					created_at: timeline[1].created_at,
					updated_at: null,
					linked_at: timeline[1].linked_at,
					id: timeline[1].id,
					name: null,
					version: '1.0.0',
					type: 'update@1.0.0',
					slug: timeline[1].slug,
					links: timeline[1].links,
					data: {
						actor: ctx.actor.id,
						target: createResult.data.id,
						timestamp: timeline[1].data.timestamp,
						payload: [
							{
								op: 'replace',
								path: '/data/foo',
								value: 2,
							},
						],
					},
				},
			].map(ctx.kernel.defaults),
		);
	});

	it('should delete a card using action-update-card', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();
		const createRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
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

		await ctx.flush(ctx.session);
		const createResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const updateRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-update-card@1.0.0',
				context: ctx.context,
				card: createResult.data.id,
				type: createResult.data.type,
				arguments: {
					reason: null,
					patch: [
						{
							op: 'replace',
							path: '/active',
							value: false,
						},
					],
				},
			},
		);

		await ctx.flush(ctx.session);
		const updateResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			updateResult.data.id,
		);

		assert(card !== null);

		expect(card).toEqual(
			ctx.kernel.defaults({
				created_at: card.created_at,
				updated_at: card.updated_at,
				linked_at: card.linked_at,
				id: updateResult.data.id,
				name: null,
				type: 'card@1.0.0',
				slug,
				version: '1.0.0',
				active: false,
				links: card.links,
			}),
		);
	});

	it("should update the markers of attached events when updating a card's markers ", async () => {
		const { context, jellyfish, session } = ctx;
		const marker = 'org-test';
		const typeCard = await jellyfish.getCardBySlug(
			context,
			session,
			'card@latest',
		);

		assert(typeCard !== null);

		const cardRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {},
				},
			},
		);

		await ctx.flush(session);
		const cardResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			cardRequest,
		);
		expect(cardResult.error).toBe(false);

		const messageRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			session,
			{
				action: 'action-create-event@1.0.0',
				context: ctx.context,
				card: cardResult.data.id,
				type: cardResult.data.type,
				arguments: {
					type: 'message',
					tags: [],
					payload: {
						message: 'johndoe',
					},
				},
			},
		);

		await ctx.flush(session);
		const messageResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		const updateRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			session,
			{
				action: 'action-update-card@1.0.0',
				context: ctx.context,
				card: cardResult.data.id,
				type: cardResult.data.type,
				arguments: {
					reason: null,
					patch: [
						{
							op: 'replace',
							path: '/markers',
							value: [marker],
						},
					],
				},
			},
		);

		await ctx.flush(session);
		await ctx.queue.producer.waitResults(ctx.context, updateRequest);

		const message = await jellyfish.getCardById(
			context,
			session,
			messageResult.data.id,
		);

		assert(message !== null);

		expect(message.markers).toEqual([marker]);
	});

	it('should be able to upsert a deeply nested card', async () => {
		const data = {
			foo: {
				bar: {
					baz: {
						qux: {
							foo: {
								bar: {
									baz: {
										qux: {
											foo: {
												bar: {
													baz: {
														qux: {
															foo: {
																bar: {
																	baz: {
																		qux: {
																			test: 1,
																		},
																	},
																},
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		};

		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const createRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug: 'foo',
						version: '1.0.0',
						data: {},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const createResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const updateRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-update-card@1.0.0',
				context: ctx.context,
				card: createResult.data.id,
				type: createResult.data.type,
				arguments: {
					reason: null,
					patch: [
						{
							op: 'add',
							path: '/data/foo',
							value: {},
						},
						{
							op: 'add',
							path: '/data/foo/bar',
							value: {},
						},
						{
							op: 'add',
							path: '/data/foo/bar/baz',
							value: {},
						},
						{
							op: 'add',
							path: '/data/foo/bar/baz/qux',
							value: {},
						},
						{
							op: 'add',
							path: '/data/foo/bar/baz/qux/foo',
							value: {},
						},
						{
							op: 'add',
							path: '/data/foo/bar/baz/qux/foo/bar',
							value: {},
						},
						{
							op: 'add',
							path: '/data/foo/bar/baz/qux/foo/bar/baz',
							value: {},
						},
						{
							op: 'add',
							path: '/data/foo/bar/baz/qux/foo/bar/baz/qux',
							value: {},
						},
						{
							op: 'add',
							path: '/data/foo/bar/baz/qux/foo/bar/baz/qux/foo',
							value: {},
						},
						{
							op: 'add',
							path: '/data/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar',
							value: {},
						},
						{
							op: 'add',
							path: '/data/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz',
							value: {},
						},
						{
							op: 'add',
							path: '/data/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz/qux',
							value: {},
						},
						{
							op: 'add',
							path: '/data/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz/qux/foo',
							value: {},
						},
						{
							op: 'add',
							path:
								'/data/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar',
							value: {},
						},
						{
							op: 'add',
							path:
								'/data/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz',
							value: {},
						},
						{
							op: 'add',
							path:
								'/data/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz/qux',
							value: {},
						},
						{
							op: 'add',
							path:
								'/data/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz/qux/test',
							value: 1,
						},
					],
				},
			},
		);

		await ctx.flush(ctx.session);
		const updateResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			updateResult.data.id,
		);

		assert(card !== null);

		expect(card.slug).toBe('foo');
		expect(card.version).toBe('1.0.0');
		expect(card.data).toEqual(data);
	});
});
