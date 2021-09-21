/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import ActionLibrary from '@balena/jellyfish-action-library';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { core } from '@balena/jellyfish-types';
import { TriggeredActionContract } from '@balena/jellyfish-types/build/worker';
import { strict as assert } from 'assert';
import Bluebird from 'bluebird';
import * as _ from 'lodash';
import { Worker } from '../../lib/index';

let ctx: integrationHelpers.IntegrationTestContext;

beforeAll(async () => {
	ctx = await integrationHelpers.before(
		[DefaultPlugin, ActionLibrary, ProductOsPlugin],
		{
			worker: Worker,
		},
	);
});

afterAll(() => {
	return integrationHelpers.after(ctx);
});

describe('.getId()', () => {
	test('should preserve the same id during its lifetime', async () => {
		const id1 = ctx.worker.getId();
		const id2 = ctx.worker.getId();
		const id3 = ctx.worker.getId();
		const id4 = ctx.worker.getId();
		const id5 = ctx.worker.getId();

		expect(id1).toBe(id2);
		expect(id2).toBe(id3);
		expect(id3).toBe(id4);
		expect(id4).toBe(id5);
	});

	test('different workers should get different ids', async () => {
		const worker1 = new Worker(
			ctx.jellyfish as any,
			ctx.session,
			ctx.actionLibrary,
			ctx.queue.consumer,
			ctx.queue.producer,
		);
		const worker2 = new Worker(
			ctx.jellyfish,
			ctx.session,
			ctx.actionLibrary,
			ctx.queue.consumer,
			ctx.queue.producer,
		);
		const worker3 = new Worker(
			ctx.jellyfish,
			ctx.session,
			ctx.actionLibrary,
			ctx.queue.consumer,
			ctx.queue.producer,
		);

		await worker1.initialize(ctx.context);
		await worker2.initialize(ctx.context);
		await worker3.initialize(ctx.context);

		expect(worker1.getId()).not.toBe(worker2.getId());
		expect(worker1.getId()).not.toBe(worker3.getId());
		expect(worker2.getId()).not.toBe(worker3.getId());
	});
});

describe('Worker', () => {
	it('should not re-enqueue requests after duplicated execute events', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();
		await ctx.queue.producer.enqueue(ctx.worker.getId(), ctx.session, {
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
		});

		const enqueuedRequest1 = await ctx.dequeue();

		assert(enqueuedRequest1 !== null);

		await ctx.queue.consumer.postResults(
			ctx.generateRandomID(),
			ctx.context,
			enqueuedRequest1 as any,
			{
				error: false,
				data: {
					id: ctx.generateRandomID(),
					type: 'card@1.0.0',
					slug,
				},
			},
		);

		await expect(
			ctx.worker.execute(ctx.session, enqueuedRequest1),
		).rejects.toThrow(ctx.jellyfish.errors.JellyfishElementAlreadyExists);

		const enqueuedRequest2 = await ctx.dequeue();
		expect(enqueuedRequest2).toBeFalsy();
	});

	it('should evaluate a simple computed property on insertion', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();
		const typeAction = {
			action: 'action-create-card@1.0.0',
			context: ctx.context,
			card: typeCard.id,
			type: typeCard.type,
			arguments: {
				reason: null,
				properties: {
					slug,
					data: {
						schema: {
							type: 'object',
							properties: {
								type: {
									type: 'string',
									pattern: `^${slug}@`,
								},
								data: {
									type: 'object',
									properties: {
										foo: {
											type: 'string',
											$$formula: 'UPPER(input)',
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
			},
		};

		const typeRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			typeAction,
		);
		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			typeRequest,
		);

		assert(typeResult !== null);

		expect(typeResult.error).toBe(false);

		const insertAction = {
			action: 'action-create-card@1.0.0',
			context: ctx.context,
			card: typeResult.data.id,
			type: typeResult.data.type,
			arguments: {
				reason: null,
				properties: {
					data: {
						foo: 'hello',
					},
				},
			},
		};

		const insertRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			insertAction,
		);
		await ctx.flush(ctx.session);
		const insertResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			insertResult.data.id,
		);

		assert(card !== null);

		expect(card).toEqual({
			id: card.id,
			slug: card.slug,
			capabilities: [],
			requires: [],
			markers: [],
			name: null,
			version: '1.0.0',
			linked_at: card.linked_at,
			updated_at: card.updated_at,
			created_at: card.created_at,
			type: `${slug}@1.0.0`,
			active: true,
			loop: null,
			links: {},
			tags: [],
			data: {
				foo: 'HELLO',
			},
		});
	});

	it('should evaluate a simple SUM property on a insertAction', async () => {
		const typeCard: any = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		const slug = ctx.generateRandomSlug();
		const typeAction = {
			action: 'action-create-card@1.0.0',
			context: ctx.context,
			card: typeCard.id,
			type: typeCard.type,
			arguments: {
				reason: null,
				properties: {
					slug,
					data: {
						schema: {
							type: 'object',
							properties: {
								type: {
									type: 'string',
									pattern: `^${slug}@`,
								},
								data: {
									type: 'object',
									properties: {
										apples: {
											type: 'number',
										},
										oranges: {
											type: 'number',
										},
										fruitSalad: {
											type: 'number',
											$$formula:
												'SUM([contract.data.apples, contract.data.oranges])',
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
			},
		};

		const typeRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			typeAction,
		);
		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertAction = {
			action: 'action-create-card@1.0.0',
			context: ctx.context,
			card: typeResult.data.id,
			type: typeResult.data.type,
			arguments: {
				reason: null,
				properties: {
					data: {
						apples: 10,
						oranges: 5,
					},
				},
			},
		};

		const insertRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			insertAction,
		);
		await ctx.flush(ctx.session);
		const insertResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			insertResult.data.id,
		);

		assert(card !== null);

		expect(card).toEqual({
			id: card.id,
			slug: card.slug,
			capabilities: [],
			requires: [],
			markers: [],
			name: null,
			version: '1.0.0',
			linked_at: card.linked_at,
			updated_at: card.updated_at,
			created_at: card.created_at,
			type: `${slug}@1.0.0`,
			active: true,
			loop: null,
			links: {},
			tags: [],
			data: {
				apples: 10,
				fruitSalad: 15,
				oranges: 5,
			},
		});
	});

	it('should evaluate a simple computed property on a JSON Patch move', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();
		const typeAction = {
			action: 'action-create-card@1.0.0',
			context: ctx.context,
			card: typeCard.id,
			type: typeCard.type,
			arguments: {
				reason: null,
				properties: {
					slug,
					data: {
						schema: {
							type: 'object',
							properties: {
								type: {
									type: 'string',
									pattern: `^${slug}@`,
								},
								data: {
									type: 'object',
									properties: {
										foo: {
											type: 'string',
											$$formula: 'UPPER(input)',
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
			},
		};

		const typeRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			typeAction,
		);
		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertAction = {
			action: 'action-create-card@1.0.0',
			context: ctx.context,
			card: typeResult.data.id,
			type: typeResult.data.type,
			arguments: {
				reason: null,
				properties: {
					data: {
						bar: 'hello',
						foo: 'test',
					},
				},
			},
		};

		const insertRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			insertAction,
		);
		await ctx.flush(ctx.session);
		const insertResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const updateAction = {
			action: 'action-update-card@1.0.0',
			context: ctx.context,
			card: insertResult.data.id,
			type: insertResult.data.type,
			arguments: {
				reason: null,
				patch: [
					{
						op: 'move',
						from: '/data/bar',
						path: '/data/foo',
					},
				],
			},
		};

		const updateRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			updateAction,
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

		expect(card).toEqual({
			id: card.id,
			slug: card.slug,
			capabilities: [],
			requires: [],
			markers: [],
			name: null,
			version: '1.0.0',
			linked_at: card.linked_at,
			updated_at: card.updated_at,
			created_at: card.created_at,
			type: `${slug}@1.0.0`,
			active: true,
			loop: null,
			links: {},
			tags: [],
			data: {
				// bar: 'hello', // removed by json patch move operation
				foo: 'HELLO',
			},
		});
	});

	it('should evaluate a simple computed property on a JSON Patch copy', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();
		const typeAction = {
			action: 'action-create-card@1.0.0',
			context: ctx.context,
			card: typeCard.id,
			type: typeCard.type,
			arguments: {
				reason: null,
				properties: {
					slug,
					data: {
						schema: {
							type: 'object',
							properties: {
								type: {
									type: 'string',
									pattern: `^${slug}@`,
								},
								data: {
									type: 'object',
									properties: {
										foo: {
											type: 'string',
											$$formula: 'UPPER(input)',
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
			},
		};

		const typeRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			typeAction,
		);
		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertAction = {
			action: 'action-create-card@1.0.0',
			context: ctx.context,
			card: typeResult.data.id,
			type: typeResult.data.type,
			arguments: {
				reason: null,
				properties: {
					data: {
						bar: 'hello',
						foo: 'test',
					},
				},
			},
		};

		const insertRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			insertAction,
		);
		await ctx.flush(ctx.session);
		const insertResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const updateAction = {
			action: 'action-update-card@1.0.0',
			context: ctx.context,
			card: insertResult.data.id,
			type: insertResult.data.type,
			arguments: {
				reason: null,
				patch: [
					{
						op: 'copy',
						from: '/data/bar',
						path: '/data/foo',
					},
				],
			},
		};

		const updateRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			updateAction,
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

		expect(card).toEqual({
			id: card.id,
			slug: card.slug,
			capabilities: [],
			requires: [],
			markers: [],
			name: null,
			version: '1.0.0',
			linked_at: card.linked_at,
			updated_at: card.updated_at,
			created_at: card.created_at,
			type: `${slug}@1.0.0`,
			active: true,
			loop: null,
			links: {},
			tags: [],
			data: {
				foo: 'HELLO',
				bar: 'hello',
			},
		});
	});

	it('should evaluate a simple computed property on a JSON Patch replace', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();
		const typeAction = {
			action: 'action-create-card@1.0.0',
			context: ctx.context,
			card: typeCard.id,
			type: typeCard.type,
			arguments: {
				reason: null,
				properties: {
					slug,
					data: {
						schema: {
							type: 'object',
							properties: {
								type: {
									type: 'string',
									pattern: `^${slug}@`,
								},
								data: {
									type: 'object',
									properties: {
										foo: {
											type: 'string',
											$$formula: 'UPPER(input)',
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
			},
		};

		const typeRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			typeAction,
		);
		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertAction = {
			action: 'action-create-card@1.0.0',
			context: ctx.context,
			card: typeResult.data.id,
			type: typeResult.data.type,
			arguments: {
				reason: null,
				properties: {
					data: {
						foo: 'hello',
					},
				},
			},
		};

		const insertRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			insertAction,
		);
		await ctx.flush(ctx.session);
		const insertResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const updateAction = {
			action: 'action-update-card@1.0.0',
			context: ctx.context,
			card: insertResult.data.id,
			type: insertResult.data.type,
			arguments: {
				reason: null,
				patch: [
					{
						op: 'replace',
						path: '/data/foo',
						value: 'bar',
					},
				],
			},
		};

		const updateRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			updateAction,
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

		expect(card).toEqual({
			id: card.id,
			slug: card.slug,
			capabilities: [],
			requires: [],
			markers: [],
			name: null,
			version: '1.0.0',
			linked_at: card.linked_at,
			updated_at: card.updated_at,
			created_at: card.created_at,
			type: `${slug}@1.0.0`,
			active: true,
			loop: null,
			links: {},
			tags: [],
			data: {
				foo: 'BAR',
			},
		});
	});

	it('should evaluate a simple computed property on a JSON Patch addition', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();
		const typeAction = {
			action: 'action-create-card@1.0.0',
			context: ctx.context,
			card: typeCard.id,
			type: typeCard.type,
			arguments: {
				reason: null,
				properties: {
					slug,
					data: {
						schema: {
							type: 'object',
							properties: {
								type: {
									type: 'string',
									pattern: `^${slug}@`,
								},
								data: {
									type: 'object',
									properties: {
										foo: {
											type: 'string',
											$$formula: 'UPPER(input)',
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
			},
		};

		const typeRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			typeAction,
		);
		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertAction = {
			action: 'action-create-card@1.0.0',
			context: ctx.context,
			card: typeResult.data.id,
			type: typeResult.data.type,
			arguments: {
				reason: null,
				properties: {
					data: {},
				},
			},
		};

		const insertRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			insertAction,
		);
		await ctx.flush(ctx.session);
		const insertResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const updateAction = {
			action: 'action-update-card@1.0.0',
			context: ctx.context,
			card: insertResult.data.id,
			type: insertResult.data.type,
			arguments: {
				reason: null,
				patch: [
					{
						op: 'add',
						path: '/data/foo',
						value: 'hello',
					},
				],
			},
		};

		const updateRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			updateAction,
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

		expect(card).toEqual({
			id: card.id,
			slug: card.slug,
			capabilities: [],
			requires: [],
			markers: [],
			name: null,
			version: '1.0.0',
			linked_at: card.linked_at,
			updated_at: card.updated_at,
			created_at: card.created_at,
			type: `${slug}@1.0.0`,
			active: true,
			loop: null,
			links: {},
			tags: [],
			data: {
				foo: 'HELLO',
			},
		});
	});

	it('should throw if the result of the formula is incompatible with the given type', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();
		const typeAction = {
			action: 'action-create-card@1.0.0',
			context: ctx.context,
			card: typeCard.id,
			type: typeCard.type,
			arguments: {
				reason: null,
				properties: {
					slug,
					data: {
						schema: {
							type: 'object',
							properties: {
								type: {
									type: 'string',
									pattern: `^${slug}@`,
								},
								data: {
									type: 'object',
									properties: {
										foo: {
											type: 'number',
											$$formula: 'UPPER(input)',
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
			},
		};

		const typeRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			typeAction,
		);
		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertAction = {
			action: 'action-create-card@1.0.0',
			context: ctx.context,
			card: typeResult.data.id,
			type: typeResult.data.type,
			arguments: {
				reason: null,
				properties: {
					data: {
						foo: 'hello',
					},
				},
			},
		};

		await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			insertAction,
		);
		await expect(ctx.flush(ctx.session)).rejects.toThrow(
			ctx.jellyfish.errors.JellyfishSchemaMismatch,
		);
	});

	it('should not re-enqueue requests after execute failure', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		await ctx.queue.producer.enqueue(ctx.worker.getId(), ctx.session, {
			action: 'action-create-card@1.0.0',
			context: ctx.context,
			card: typeCard.id,
			type: typeCard.type,
			arguments: {
				reason: null,
				properties: {
					slug: 'foo',
					version: '1.0.0',
					data: {
						foo: 'bar',
					},
				},
			},
		});

		const enqueuedRequest1 = await ctx.dequeue();

		assert(enqueuedRequest1 !== null);

		await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
			slug: 'foo',
			type: 'card@1.0.0',
			version: '1.0.0',
			data: {
				foo: 'bar',
			},
		});

		await ctx.queue.consumer.postResults(
			ctx.generateRandomID(),
			ctx.context,
			enqueuedRequest1 as any,
			{
				error: false,
				data: {
					id: ctx.generateRandomID(),
					type: 'card@1.0.0',
					slug: 'foo',
				},
			},
		);

		await expect(
			ctx.worker.execute(ctx.session, enqueuedRequest1),
		).rejects.toThrow(ctx.jellyfish.errors.JellyfishElementAlreadyExists);

		const enqueuedRequest2 = await ctx.dequeue();
		expect(enqueuedRequest2).toBeFalsy();
	});

	it('should be able to login as a user with a password', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'user@latest',
		);

		assert(typeCard !== null);

		const request1 = await ctx.worker.pre(ctx.session, {
			action: 'action-create-user@1.0.0',
			card: typeCard.id,
			context: ctx.context,
			type: typeCard.type,
			arguments: {
				email: 'johndoe@example.com',
				username: ctx.generateRandomSlug({
					prefix: 'user',
				}),
				password: 'foobarbaz',
			},
		});

		const createUserRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			request1,
		);

		await ctx.flushAll(ctx.session);
		const signupResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			createUserRequest,
		);
		expect(signupResult.error).toBe(false);

		const request2 = await ctx.worker.pre(ctx.session, {
			action: 'action-create-session@1.0.0',
			card: signupResult.data.id,
			context: ctx.context,
			type: signupResult.data.type,
			arguments: {
				password: 'foobarbaz',
			},
		});

		const loginRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			request2,
		);

		await ctx.flushAll(ctx.session);
		const loginResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			loginRequest,
		);
		expect(loginResult.error).toBe(false);

		const session = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			loginResult.data.id,
		);

		assert(session !== null);

		expect(session).toEqual(
			ctx.jellyfish.defaults({
				created_at: session.created_at,
				linked_at: session.linked_at,
				name: null,
				id: session.id,
				slug: session.slug,
				version: '1.0.0',
				type: 'session@1.0.0',
				links: session.links,
				data: {
					actor: signupResult.data.id,
					expiration: session.data.expiration,
					scope: {},
				},
			}),
		);

		const currentDate = new Date();
		expect(new Date(session.data.expiration as any) > currentDate).toBe(true);
	});

	it('should not be able to login as a password-less user', async () => {
		const user = await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
			type: 'user@1.0.0',
			version: '1.0.0',
			slug: ctx.generateRandomSlug({
				prefix: 'user',
			}),
			data: {
				email: 'johndoe@example.com',
				hash: 'PASSWORDLESS',
				roles: [],
			},
		});

		await ctx.queue.producer.enqueue(ctx.worker.getId(), ctx.session, {
			action: 'action-create-session@1.0.0',
			context: ctx.context,
			card: user.id,
			type: user.type,
			arguments: {},
		});

		await expect(ctx.flush(ctx.session)).rejects.toThrow(
			ctx.worker.errors.WorkerSchemaMismatch,
		);
	});

	it('should not be able to login as a password-less user given a random password', async () => {
		const user = await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
			type: 'user@1.0.0',
			version: '1.0.0',
			slug: ctx.generateRandomSlug({
				prefix: 'user',
			}),
			data: {
				email: 'johndoe@example.com',
				hash: 'PASSWORDLESS',
				roles: [],
			},
		});

		await expect(
			ctx.worker.pre(ctx.session, {
				action: 'action-create-session@1.0.0',
				context: ctx.context,
				card: user.id,
				type: user.type,
				arguments: {
					password: 'foobar',
				},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});

	it('should not be able to login as a password-less non-disallowed user', async () => {
		const user = await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
			type: 'user@1.0.0',
			version: '1.0.0',
			slug: ctx.generateRandomSlug({
				prefix: 'user',
			}),
			data: {
				disallowLogin: false,
				email: 'johndoe@example.com',
				hash: 'PASSWORDLESS',
				roles: [],
			},
		});

		await ctx.queue.producer.enqueue(ctx.worker.getId(), ctx.session, {
			action: 'action-create-session@1.0.0',
			context: ctx.context,
			card: user.id,
			type: user.type,
			arguments: {},
		});

		await expect(ctx.flush(ctx.session)).rejects.toThrow(
			ctx.worker.errors.WorkerSchemaMismatch,
		);
	});

	it('should not be able to login as a password-less disallowed user', async () => {
		const user = await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
			type: 'user@1.0.0',
			version: '1.0.0',
			slug: ctx.generateRandomSlug({
				prefix: 'user',
			}),
			data: {
				disallowLogin: true,
				email: 'johndoe@example.com',
				hash: 'PASSWORDLESS',
				roles: [],
			},
		});

		await ctx.queue.producer.enqueue(ctx.worker.getId(), ctx.session, {
			action: 'action-create-session@1.0.0',
			context: ctx.context,
			card: user.id,
			type: user.type,
			arguments: {},
		});

		await expect(ctx.flush(ctx.session)).rejects.toThrow(
			ctx.worker.errors.WorkerSchemaMismatch,
		);
	});

	it('should fail if signing up with the wrong password', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'user@latest',
		);

		assert(typeCard !== null);

		const request1 = await ctx.worker.pre(ctx.session, {
			action: 'action-create-user@1.0.0',
			context: ctx.context,
			card: typeCard.id,
			type: typeCard.type,
			arguments: {
				email: 'johndoe@example.com',
				username: ctx.generateRandomSlug({
					prefix: 'user',
				}),
				password: 'xxxxxxxxxxxx',
			},
		});

		const createUserRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			request1,
		);

		await ctx.flush(ctx.session);
		const signupResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			createUserRequest,
		);
		expect(signupResult.error).toBe(false);

		await expect(
			ctx.worker.pre(ctx.session, {
				action: 'action-create-session@1.0.0',
				context: ctx.context,
				card: signupResult.data.id,
				type: signupResult.data.type,
				arguments: {
					password: 'foobarbaz',
				},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});

	it('should post an error execute event if logging in as a disallowed user', async () => {
		const adminCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'user-admin@latest',
		);

		assert(adminCard !== null);

		await expect(
			ctx.worker.pre(ctx.session, {
				action: 'action-create-session@1.0.0',
				context: ctx.context,
				card: adminCard.id,
				type: adminCard.type,
				arguments: {
					password: 'foobarbaz',
				},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});

	it('a triggered action can update a dynamic list of cards (ids as array of strings)', async () => {
		const cardIds: string[] = [];
		const slug = ctx.generateRandomSlug();
		await Bluebird.each([1, 2, 3], async (idx) => {
			const card = await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
				slug: `${slug}${idx}`,
				type: 'card@1.0.0',
				version: '1.0.0',
				data: {
					id: `id${idx}`,
				},
			});
			cardIds.push(card.id);
		});

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
								required: ['cards'],
								properties: {
									cards: {
										type: 'array',
										items: {
											type: 'string',
										},
									},
								},
							},
						},
					},
					action: 'action-update-card@1.0.0',
					target: {
						$eval: 'source.data.cards',
					},
					arguments: {
						reason: null,
						patch: [
							{
								op: 'add',
								path: '/data/updated',
								value: true,
							},
						],
					},
				},
			}) as TriggeredActionContract,
		]);

		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		const actionCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'action-create-card@latest',
		);

		assert(actionCard !== null);
		assert(typeCard !== null);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						data: {
							cards: cardIds,
						},
					},
				},
			},
		);

		await ctx.flushAll(ctx.session);
		const result = await ctx.queue.producer.waitResults(ctx.context, request);
		expect(result.error).toBe(false);

		await ctx.flushAll(ctx.session);

		await Bluebird.each([1, 2, 3], async (idx) => {
			const card = await ctx.jellyfish.getCardBySlug(
				ctx.context,
				ctx.session,
				`${slug}${idx}@latest`,
			);
			assert(card !== null);
			expect(card.data.updated).toBe(true);
		});
	});

	test('a triggered action can update a dynamic list of cards (ids as array of objects with field id)', async () => {
		const cardsWithId: Array<{ [id: string]: string }> = [];
		const slug = ctx.generateRandomSlug();
		await Bluebird.each([1, 2, 3], async (idx) => {
			const card = await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
				slug: `${slug}${idx}`,
				type: 'card@1.0.0',
				version: '1.0.0',
				data: {
					id: `id${idx}`,
				},
			});
			cardsWithId.push({ id: card.id });
		});

		ctx.worker.setTriggers(ctx.context, [
			ctx.jellyfish.defaults({
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				type: 'triggered-action@1.0.0',
				data: {
					filter: {
						type: 'object',
						required: ['data'],
						properties: {
							data: {
								type: 'object',
								required: ['cards'],
								properties: {
									cards: {
										type: 'array',
										items: {
											type: 'object',
											required: ['id'],
											properties: {
												id: {
													type: 'string',
												},
											},
										},
									},
								},
							},
						},
					},
					action: 'action-update-card@1.0.0',
					target: {
						$map: {
							$eval: 'source.data.cards[0:]',
						},
						'each(card)': {
							$eval: 'card.id',
						},
					},
					arguments: {
						reason: null,
						patch: [
							{
								op: 'add',
								path: '/data/updated',
								value: true,
							},
						],
					},
				},
			}) as TriggeredActionContract,
		]);

		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		const actionCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'action-create-card@latest',
		);

		assert(typeCard !== null);
		assert(actionCard !== null);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						data: {
							cards: cardsWithId,
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const result = await ctx.queue.producer.waitResults(ctx.context, request);
		expect(result.error).toBe(false);

		await ctx.flushAll(ctx.session);

		await Bluebird.each([1, 2, 3], async (idx) => {
			const card = await ctx.jellyfish.getCardBySlug(
				ctx.context,
				ctx.session,
				`${slug}${idx}@latest`,
			);
			assert(card !== null);
			expect(card.data.updated).toBe(true);
		});
	});

	it('should fail when attempting to insert a triggered-action card with duplicate targets', async () => {
		const trigger = {
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			type: 'triggered-action@1.0.0',
			slug: 'triggered-action-12345',
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
				action: 'action-update-card@1.0.0',
				target: ['1', '1', '1'],
				arguments: {
					reason: null,
					patch: [
						{
							op: 'add',
							path: '/data/updated',
							value: true,
						},
					],
				},
			},
		};

		await expect(
			ctx.jellyfish.insertCard(ctx.context, ctx.session, trigger),
		).rejects.toThrow(ctx.backend.errors.JellyfishSchemaMismatch);
	});

	test('trigger should update card if triggered by a user not owning the card', async () => {
		const card = await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
			slug: ctx.generateRandomSlug({
				prefix: 'user',
			}),
			type: 'card@1.0.0',
			version: '1.0.0',
			data: {
				id: 'id-admin',
			},
		});

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
								required: ['cards'],
								properties: {
									cards: {
										type: 'array',
										items: {
											type: 'object',
											required: ['id'],
											properties: {
												id: {
													type: 'string',
												},
											},
										},
									},
								},
							},
						},
					},
					action: 'action-update-card@1.0.0',
					target: {
						$map: {
							$eval: 'source.data.cards[0:]',
						},
						'each(card)': {
							$eval: 'card.id',
						},
					},
					arguments: {
						reason: null,
						patch: [
							{
								op: 'add',
								path: '/data/updated',
								value: true,
							},
						],
					},
				},
			}) as TriggeredActionContract,
		]);

		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'type@latest',
		);
		const actionCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'action-create-card@latest',
		);

		assert(typeCard !== null);
		assert(actionCard !== null);

		const userJohnDoe = await ctx.jellyfish.insertCard(
			ctx.context,
			ctx.session,
			{
				type: 'user@1.0.0',
				version: '1.0.0',
				slug: ctx.generateRandomSlug({
					prefix: 'user',
				}),
				data: {
					email: 'accounts+jellyfish@resin.io',
					roles: ['user-community'],
					hash: 'PASSWORDLESS',
				},
			},
		);

		const sessionOfJohnDoe = await ctx.jellyfish.insertCard(
			ctx.context,
			ctx.session,
			{
				type: 'session@1.0.0',
				version: '1.0.0',
				slug: `session-${userJohnDoe.slug}`,
				data: {
					actor: userJohnDoe.id,
				},
			},
		);
		const sessionIdOfJohnDoe = sessionOfJohnDoe.id;

		await ctx.queue.producer.enqueue(ctx.worker.getId(), sessionIdOfJohnDoe, {
			action: `${actionCard.slug}@${actionCard.version}`,
			context: ctx.context,
			card: typeCard.id,
			type: typeCard.type,
			arguments: {
				reason: null,
				properties: {
					data: {
						cards: [
							{
								id: card.id,
							},
						],
						schema: {},
					},
				},
			},
		});

		await ctx.flush(sessionIdOfJohnDoe);

		// Now flush any remaining jobs that have been generated by triggers
		await ctx.flushAll(ctx.session);

		const result = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			card.id,
		);
		assert(result !== null);
		expect(result).toBeTruthy();
		expect(result.data.updated).toBe(true);
	});
});

describe('.getTriggers()', () => {
	it('should return a list of triggers', async () => {
		const triggers = ctx.worker.getTriggers();
		expect(triggers[0].type.split('@')[0]).toEqual('triggered-action');
	});
});

describe('.replaceCard()', () => {
	test('should update type contract schema', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();
		const result1 = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: true,
				actor: ctx.actor.id,
			},
			{
				slug,
				version: '1.0.0',
				data: {
					schema: {
						data: {
							foo: {
								title: 'Foobar',
								type: 'string',
							},
						},
					},
				},
			},
		);

		await ctx.worker.replaceCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: true,
				actor: ctx.actor.id,
			},
			{
				slug,
				version: '1.0.0',
				data: {
					schema: {
						data: {
							foo: {
								title: 'Foobar2',
								type: 'string',
							},
						},
					},
				},
			},
		);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			result1!.id,
		);

		assert(card !== null);
		assert(result1! !== null);

		expect((card.data.schema as any).data.foo.title).toEqual('Foobar2');
	});

	test('updating a card must have the correct tail', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();
		const result1 = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: true,
				actor: ctx.actor.id,
			},
			{
				slug,
				version: '1.0.0',
				data: {
					foo: 1,
				},
			},
		);

		await ctx.worker.replaceCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: true,
				actor: ctx.actor.id,
			},
			{
				slug,
				version: '1.0.0',
				data: {
					foo: 2,
				},
			},
		);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			result1!.id,
		);

		assert(card !== null);
		assert(result1! !== null);

		expect(card).toEqual(
			ctx.jellyfish.defaults({
				created_at: result1.created_at,
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

		const tail = await ctx.jellyfish.query(ctx.context, ctx.session, {
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
		});

		// "Replace" is an operation that will go away once the database
		// becomes fully immutable, so we don't attempt to calculate a
		// JSON Patch update for it, as we treat it as an exception
		expect(tail.length).toBe(1);
		expect(tail[0].type).toBe('create@1.0.0');
		expect(tail[0].data.payload).toEqual(
			_.pick(result1, ['data', 'slug', 'type', 'version']),
		);
	});

	test('should be able to disable event creation', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();

		const result = await ctx.worker.replaceCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: false,
				actor: ctx.actor.id,
			},
			{
				slug,
				version: '1.0.0',
			},
		);

		assert(result !== null);

		const tail = await ctx.jellyfish.query(ctx.context, ctx.session, {
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
							const: result.id,
						},
					},
				},
			},
		});

		expect(tail.length).toBe(0);
	});
});

describe('.insertCard()', () => {
	test('should insert a card', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();
		const result = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: false,
				actor: ctx.actor.id,
			},
			{
				slug,
				data: {
					foo: 1,
				},
			},
		);

		assert(result !== null);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			result.id,
		);

		expect(card).toEqual(
			ctx.jellyfish.defaults({
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
		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();
		const result = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: false,
				actor: ctx.actor.id,
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

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			result!.id,
		);

		assert(card !== null);

		expect(card.type).toBe('card@1.0.0');
	});

	test('should default active to true', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard !== null);
		const result = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: false,
				actor: ctx.actor.id,
			},
			{
				slug: ctx.generateRandomSlug(),
				version: '1.0.0',
			},
		);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			result!.id,
		);
		assert(card !== null);
		expect(card.active).toBe(true);
	});

	test('should be able to set active to false', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard !== null);
		const result = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: false,
				actor: ctx.actor.id,
			},
			{
				slug: ctx.generateRandomSlug(),
				version: '1.0.0',
				active: false,
			},
		);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			result!.id,
		);
		assert(card !== null);
		expect(card.active).toBe(false);
	});

	test('should provide sane defaults for links', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard !== null);
		const result = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: false,
				actor: ctx.actor.id,
			},
			{
				slug: ctx.generateRandomSlug(),
				version: '1.0.0',
			},
		);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			result!.id,
		);
		assert(card !== null);
		expect(card.links).toEqual({});
	});

	test('should provide sane defaults for tags', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard !== null);
		const result = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: false,
				actor: ctx.actor.id,
			},
			{
				slug: ctx.generateRandomSlug(),
				version: '1.0.0',
			},
		);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			result!.id,
		);
		assert(card !== null);
		expect(card.tags).toEqual([]);
	});

	test('should provide sane defaults for data', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard !== null);
		const result = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: false,
				actor: ctx.actor.id,
			},
			{
				slug: ctx.generateRandomSlug(),
				version: '1.0.0',
			},
		);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			result!.id,
		);
		assert(card !== null);
		expect(card.data).toEqual({});
	});

	test('should be able to set a slug', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const slug = ctx.generateRandomSlug();
		const result = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: false,
				actor: ctx.actor.id,
			},
			{
				slug,
				version: '1.0.0',
			},
		);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			result!.id,
		);
		assert(card !== null);
		expect(card.slug).toBe(slug);
	});

	test('should be able to set a name', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard !== null);
		const result = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: false,
				actor: ctx.actor.id,
			},
			{
				slug: ctx.generateRandomSlug(),
				version: '1.0.0',
				name: 'Hello',
			},
		);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			result!.id,
		);
		assert(card !== null);
		expect(card.name).toBe('Hello');
	});

	test('throw if card already exists and override is false', async () => {
		const slug = ctx.generateRandomSlug();
		await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
			slug,
			type: 'card@1.0.0',
			version: '1.0.0',
		});

		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard !== null);
		await expect(
			ctx.worker.insertCard(
				ctx.context,
				ctx.session,
				typeCard,
				{
					attachEvents: false,
					actor: ctx.actor.id,
				},
				{
					version: '1.0.0',
					slug,
					active: false,
				},
			),
		).rejects.toThrow(ctx.jellyfish.errors.JellyfishElementAlreadyExists);
	});

	test('should add a create event if attachEvents is true', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard !== null);
		const result = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: true,
				actor: ctx.actor.id,
			},
			{
				version: '1.0.0',
				slug: ctx.generateRandomSlug(),
			},
		);

		assert(result !== null);

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
							const: result.id,
						},
					},
				},
			},
		});

		expect(tail.length).toBe(1);
	});
});

describe('.patchCard()', () => {
	test('should ignore pointless updates', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);
		const result1 = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: true,
				actor: ctx.actor.id,
			},
			{
				slug: ctx.generateRandomSlug(),
				version: '1.0.0',
				active: true,
			},
		);

		assert(result1 !== null);

		const result2 = await ctx.worker.patchCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				actor: ctx.actor.id,
			},
			result1,
			[],
		);

		const result3 = await ctx.worker.patchCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				actor: ctx.actor.id,
			},
			result1,
			[
				{
					op: 'replace',
					path: '/active',
					value: true,
				},
			],
		);

		expect(result1).toBeTruthy();
		expect(result2).toBeFalsy();
		expect(result3).toBeFalsy();

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			result1.id,
		);
		assert(card !== null);
		expect(card.created_at).toBe(result1!.created_at);
	});

	test('should not upsert if no changes were made', async () => {
		const element = await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
			slug: ctx.generateRandomSlug(),
			type: 'card@1.0.0',
			version: '1.0.0',
		});

		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard !== null);
		await ctx.worker.patchCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				actor: ctx.actor.id,
			},
			element,
			[],
		);
	});

	test('should set a card to inactive', async () => {
		const previousCard = await ctx.jellyfish.insertCard(
			ctx.context,
			ctx.session,
			{
				slug: ctx.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard !== null);
		await ctx.worker.patchCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				actor: ctx.actor.id,
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

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			previousCard.id,
		);
		assert(card !== null);
		expect(card.active).toBe(false);
	});

	test('should add an update event if attachEvents is true', async () => {
		const element = await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
			slug: ctx.generateRandomSlug(),
			type: 'card@1.0.0',
			version: '1.0.0',
		});

		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard !== null);
		const result = await ctx.worker.patchCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				attachEvents: true,
				actor: ctx.actor.id,
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

		const tail = await ctx.jellyfish.query(ctx.context, ctx.session, {
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
		});

		expect(tail.length).toBe(1);
	});

	test('should remove previously inserted type triggered actions if deactivating a type', async () => {
		const slug = ctx.generateRandomSlug();
		const type = await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
			type: 'type@1.0.0',
			version: '1.0.0',
			slug,
			data: {
				schema: {
					type: 'object',
				},
			},
		});

		const typeCard = await ctx.jellyfish.getCardBySlug<core.TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard !== null);
		await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
			type: 'triggered-action@1.0.0',
			slug: ctx.generateRandomSlug({
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

		const typeTypeContract =
			await ctx.jellyfish.getCardBySlug<core.TypeContract>(
				ctx.context,
				ctx.session,
				'type@latest',
			);
		assert(typeTypeContract !== null);
		await ctx.worker.patchCard(
			ctx.context,
			ctx.session,
			typeTypeContract,
			{
				actor: ctx.actor.id,
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

		expect(triggers).toEqual([]);
	});
});

describe('.getActionContext()', () => {
	it('should include a map of type contracts', async () => {
		const types = await ctx.jellyfish.query<core.TypeContract>(
			ctx.context,
			ctx.session,
			{
				type: 'object',
				properties: {
					type: {
						const: 'type@1.0.0',
					},
				},
			},
		);

		ctx.worker.setTypeContracts(ctx.context, types);

		const actionContext = ctx.worker.getActionContext(ctx.context);

		const hasAllTypes = _.every(types, (contract) => {
			return _.has(actionContext.cards, `${contract.slug}@${contract.version}`);
		});

		expect(hasAllTypes).toBeTruthy();
	});
});
