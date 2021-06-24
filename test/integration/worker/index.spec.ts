/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as helpers from './helpers';
import * as _ from 'lodash';
import Bluebird from 'bluebird';
import { Worker } from '../../../lib/index';
import { v4 as uuidv4 } from 'uuid';

let context: any;

beforeAll(async () => {
	context = await helpers.worker.before();
});

afterAll(() => {
	return helpers.worker.after(context);
});

describe('.getId()', () => {
	test('should preserve the same id during its lifetime', async () => {
		const id1 = context.worker.getId();
		const id2 = context.worker.getId();
		const id3 = context.worker.getId();
		const id4 = context.worker.getId();
		const id5 = context.worker.getId();

		expect(id1).toBe(id2);
		expect(id2).toBe(id3);
		expect(id3).toBe(id4);
		expect(id4).toBe(id5);
	});

	test('different workers should get different ids', async () => {
		const worker1 = new Worker(
			context.jellyfish,
			context.session,
			context.actionLibrary,
			context.queue.consumer,
			context.queue.producer,
		);
		const worker2 = new Worker(
			context.jellyfish,
			context.session,
			context.actionLibrary,
			context.queue.consumer,
			context.queue.producer,
		);
		const worker3 = new Worker(
			context.jellyfish,
			context.session,
			context.actionLibrary,
			context.queue.consumer,
			context.queue.producer,
		);

		await worker1.initialize(context.context);
		await worker2.initialize(context.context);
		await worker3.initialize(context.context);

		expect(worker1.getId()).not.toBe(worker2.getId());
		expect(worker1.getId()).not.toBe(worker3.getId());
		expect(worker2.getId()).not.toBe(worker3.getId());
	});
});

describe('Worker', () => {
	it('should not re-enqueue requests after duplicated execute events', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const slug = context.generateRandomSlug();
		await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
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

		const enqueuedRequest1 = await context.dequeue();

		await context.queue.consumer.postResults(
			uuidv4(),
			context.context,
			enqueuedRequest1,
			{
				error: false,
				data: {
					id: uuidv4(),
					type: 'card@1.0.0',
					slug,
				},
			},
		);

		await expect(
			context.worker.execute(context.session, enqueuedRequest1),
		).rejects.toThrow(context.jellyfish.errors.JellyfishElementAlreadyExists);

		const enqueuedRequest2 = await context.dequeue();
		expect(enqueuedRequest2).toBeFalsy();
	});

	it('should evaluate a simple computed property on insertion', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);

		const slug = context.generateRandomSlug();
		const typeAction = {
			action: 'action-create-card@1.0.0',
			context: context.context,
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

		const typeRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			typeAction,
		);
		await context.flush(context.session);
		const typeResult = await context.queue.producer.waitResults(
			context.context,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertAction = {
			action: 'action-create-card@1.0.0',
			context: context.context,
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

		const insertRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			insertAction,
		);
		await context.flush(context.session);
		const insertResult = await context.queue.producer.waitResults(
			context.context,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			insertResult.data.id,
		);

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
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);

		const slug = context.generateRandomSlug();
		const typeAction = {
			action: 'action-create-card@1.0.0',
			context: context.context,
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
											$$formula: 'SUM([this.data.apples, this.data.oranges])',
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

		const typeRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			typeAction,
		);
		await context.flush(context.session);
		const typeResult = await context.queue.producer.waitResults(
			context.context,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertAction = {
			action: 'action-create-card@1.0.0',
			context: context.context,
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

		const insertRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			insertAction,
		);
		await context.flush(context.session);
		const insertResult = await context.queue.producer.waitResults(
			context.context,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			insertResult.data.id,
		);

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
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);

		const slug = context.generateRandomSlug();
		const typeAction = {
			action: 'action-create-card@1.0.0',
			context: context.context,
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

		const typeRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			typeAction,
		);
		await context.flush(context.session);
		const typeResult = await context.queue.producer.waitResults(
			context.context,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertAction = {
			action: 'action-create-card@1.0.0',
			context: context.context,
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

		const insertRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			insertAction,
		);
		await context.flush(context.session);
		const insertResult = await context.queue.producer.waitResults(
			context.context,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const updateAction = {
			action: 'action-update-card@1.0.0',
			context: context.context,
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

		const updateRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			updateAction,
		);
		await context.flush(context.session);
		const updateResult = await context.queue.producer.waitResults(
			context.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			updateResult.data.id,
		);

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
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);

		const slug = context.generateRandomSlug();
		const typeAction = {
			action: 'action-create-card@1.0.0',
			context: context.context,
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

		const typeRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			typeAction,
		);
		await context.flush(context.session);
		const typeResult = await context.queue.producer.waitResults(
			context.context,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertAction = {
			action: 'action-create-card@1.0.0',
			context: context.context,
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

		const insertRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			insertAction,
		);
		await context.flush(context.session);
		const insertResult = await context.queue.producer.waitResults(
			context.context,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const updateAction = {
			action: 'action-update-card@1.0.0',
			context: context.context,
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

		const updateRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			updateAction,
		);
		await context.flush(context.session);
		const updateResult = await context.queue.producer.waitResults(
			context.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			updateResult.data.id,
		);

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
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);

		const slug = context.generateRandomSlug();
		const typeAction = {
			action: 'action-create-card@1.0.0',
			context: context.context,
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

		const typeRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			typeAction,
		);
		await context.flush(context.session);
		const typeResult = await context.queue.producer.waitResults(
			context.context,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertAction = {
			action: 'action-create-card@1.0.0',
			context: context.context,
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

		const insertRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			insertAction,
		);
		await context.flush(context.session);
		const insertResult = await context.queue.producer.waitResults(
			context.context,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const updateAction = {
			action: 'action-update-card@1.0.0',
			context: context.context,
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

		const updateRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			updateAction,
		);
		await context.flush(context.session);
		const updateResult = await context.queue.producer.waitResults(
			context.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			updateResult.data.id,
		);

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
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);

		const slug = context.generateRandomSlug();
		const typeAction = {
			action: 'action-create-card@1.0.0',
			context: context.context,
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

		const typeRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			typeAction,
		);
		await context.flush(context.session);
		const typeResult = await context.queue.producer.waitResults(
			context.context,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertAction = {
			action: 'action-create-card@1.0.0',
			context: context.context,
			card: typeResult.data.id,
			type: typeResult.data.type,
			arguments: {
				reason: null,
				properties: {
					data: {},
				},
			},
		};

		const insertRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			insertAction,
		);
		await context.flush(context.session);
		const insertResult = await context.queue.producer.waitResults(
			context.context,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const updateAction = {
			action: 'action-update-card@1.0.0',
			context: context.context,
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

		const updateRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			updateAction,
		);
		await context.flush(context.session);
		const updateResult = await context.queue.producer.waitResults(
			context.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			updateResult.data.id,
		);

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
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);

		const slug = context.generateRandomSlug();
		const typeAction = {
			action: 'action-create-card@1.0.0',
			context: context.context,
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

		const typeRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			typeAction,
		);
		await context.flush(context.session);
		const typeResult = await context.queue.producer.waitResults(
			context.context,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertAction = {
			action: 'action-create-card@1.0.0',
			context: context.context,
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

		await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			insertAction,
		);
		await expect(context.flush(context.session)).rejects.toThrow(
			context.jellyfish.errors.JellyfishSchemaMismatch,
		);
	});

	it('should not re-enqueue requests after execute failure', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
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
			},
		);

		const enqueuedRequest1 = await context.dequeue();

		await context.jellyfish.insertCard(context.context, context.session, {
			slug: 'foo',
			type: 'card@1.0.0',
			version: '1.0.0',
			data: {
				foo: 'bar',
			},
		});

		await context.queue.consumer.postResults(
			uuidv4(),
			context.context,
			enqueuedRequest1,
			{
				error: false,
				data: {
					id: uuidv4(),
					type: 'card@1.0.0',
					slug: 'foo',
				},
			},
		);

		await expect(
			context.worker.execute(context.session, enqueuedRequest1),
		).rejects.toThrow(context.jellyfish.errors.JellyfishElementAlreadyExists);

		const enqueuedRequest2 = await context.dequeue();
		expect(enqueuedRequest2).toBeFalsy();
	});

	it('should be able to login as a user with a password', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'user@latest',
		);

		const request1 = await context.worker.pre(context.session, {
			action: 'action-create-user@1.0.0',
			card: typeCard.id,
			context: context.context,
			type: typeCard.type,
			arguments: {
				email: 'johndoe@example.com',
				username: context.generateRandomSlug({
					prefix: 'user',
				}),
				password: 'foobarbaz',
			},
		});

		const createUserRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			request1,
		);

		await context.flush(context.session);
		const signupResult = await context.queue.producer.waitResults(
			context.context,
			createUserRequest,
		);
		expect(signupResult.error).toBe(false);

		const request2 = await context.worker.pre(context.session, {
			action: 'action-create-session@1.0.0',
			card: signupResult.data.id,
			context: context.context,
			type: signupResult.data.type,
			arguments: {
				password: 'foobarbaz',
			},
		});

		const loginRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			request2,
		);

		await context.flush(context.session);
		const loginResult = await context.queue.producer.waitResults(
			context.context,
			loginRequest,
		);
		expect(loginResult.error).toBe(false);

		const session = await context.jellyfish.getCardById(
			context.context,
			context.session,
			loginResult.data.id,
		);

		expect(session).toEqual(
			context.kernel.defaults({
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
		expect(new Date(session.data.expiration) > currentDate).toBe(true);
	});

	it('should not be able to login as a password-less user', async () => {
		const user = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'user@1.0.0',
				version: '1.0.0',
				slug: context.generateRandomSlug({
					prefix: 'user',
				}),
				data: {
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: [],
				},
			},
		);

		await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-session@1.0.0',
				context: context.context,
				card: user.id,
				type: user.type,
				arguments: {},
			},
		);

		await expect(context.flush(context.session)).rejects.toThrow(
			context.worker.errors.WorkerSchemaMismatch,
		);
	});

	it('should not be able to login as a password-less user given a random password', async () => {
		const user = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'user@1.0.0',
				version: '1.0.0',
				slug: context.generateRandomSlug({
					prefix: 'user',
				}),
				data: {
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: [],
				},
			},
		);

		await expect(
			context.worker.pre(context.session, {
				action: 'action-create-session@1.0.0',
				context: context.context,
				card: user.id,
				type: user.type,
				arguments: {
					password: 'foobar',
				},
			}),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);
	});

	it('should not be able to login as a password-less non-disallowed user', async () => {
		const user = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'user@1.0.0',
				version: '1.0.0',
				slug: context.generateRandomSlug({
					prefix: 'user',
				}),
				data: {
					disallowLogin: false,
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: [],
				},
			},
		);

		await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-session@1.0.0',
				context: context.context,
				card: user.id,
				type: user.type,
				arguments: {},
			},
		);

		await expect(context.flush(context.session)).rejects.toThrow(
			context.worker.errors.WorkerSchemaMismatch,
		);
	});

	it('should not be able to login as a password-less disallowed user', async () => {
		const user = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'user@1.0.0',
				version: '1.0.0',
				slug: context.generateRandomSlug({
					prefix: 'user',
				}),
				data: {
					disallowLogin: true,
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: [],
				},
			},
		);

		await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-session@1.0.0',
				context: context.context,
				card: user.id,
				type: user.type,
				arguments: {},
			},
		);

		await expect(context.flush(context.session)).rejects.toThrow(
			context.worker.errors.WorkerSchemaMismatch,
		);
	});

	it('should fail if signing up with the wrong password', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'user@latest',
		);

		const request1 = await context.worker.pre(context.session, {
			action: 'action-create-user@1.0.0',
			context: context.context,
			card: typeCard.id,
			type: typeCard.type,
			arguments: {
				email: 'johndoe@example.com',
				username: context.generateRandomSlug({
					prefix: 'user',
				}),
				password: 'xxxxxxxxxxxx',
			},
		});

		const createUserRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			request1,
		);

		await context.flush(context.session);
		const signupResult = await context.queue.producer.waitResults(
			context.context,
			createUserRequest,
		);
		expect(signupResult.error).toBe(false);

		await expect(
			context.worker.pre(context.session, {
				action: 'action-create-session@1.0.0',
				context: context.context,
				card: signupResult.data.id,
				type: signupResult.data.type,
				arguments: {
					password: 'foobarbaz',
				},
			}),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);
	});

	it('should post an error execute event if logging in as a disallowed user', async () => {
		const adminCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'user-admin@latest',
		);

		await expect(
			context.worker.pre(context.session, {
				action: 'action-create-session@1.0.0',
				context: context.context,
				card: adminCard.id,
				type: adminCard.type,
				arguments: {
					password: 'foobarbaz',
				},
			}),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);
	});

	it('a triggered action can update a dynamic list of cards (ids as array of strings)', async () => {
		const cardIds: string[] = [];
		const slug = context.generateRandomSlug();
		await Bluebird.each([1, 2, 3], async (idx) => {
			const card = await context.jellyfish.insertCard(
				context.context,
				context.session,
				{
					slug: `${slug}${idx}`,
					type: 'card@1.0.0',
					version: '1.0.0',
					data: {
						id: `id${idx}`,
					},
				},
			);
			cardIds.push(card.id);
		});

		context.worker.setTriggers(context.context, [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
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
		]);

		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);

		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: context.context,
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

		await context.flush(context.session);
		const result = await context.queue.producer.waitResults(
			context.context,
			request,
		);
		expect(result.error).toBe(false);

		await Bluebird.each([1, 2, 3], async (idx) => {
			const card = await context.jellyfish.getCardBySlug(
				context.context,
				context.session,
				`${slug}${idx}@latest`,
			);
			expect(card.data.updated).toBe(true);
		});
	});

	test('a triggered action can update a dynamic list of cards (ids as array of objects with field id)', async () => {
		const cardsWithId: Array<{ [id: string]: string }> = [];
		const slug = context.generateRandomSlug();
		await Bluebird.each([1, 2, 3], async (idx) => {
			const card = await context.jellyfish.insertCard(
				context.context,
				context.session,
				{
					slug: `${slug}${idx}`,
					type: 'card@1.0.0',
					version: '1.0.0',
					data: {
						id: `id${idx}`,
					},
				},
			);
			cardsWithId.push({ id: card.id });
		});

		context.worker.setTriggers(context.context, [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
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
		]);

		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);

		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: context.context,
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

		await context.flush(context.session);
		const result = await context.queue.producer.waitResults(
			context.context,
			request,
		);
		expect(result.error).toBe(false);

		await Bluebird.each([1, 2, 3], async (idx) => {
			const card = await context.jellyfish.getCardBySlug(
				context.context,
				context.session,
				`${slug}${idx}@latest`,
			);
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
			context.jellyfish.insertCard(context.context, context.session, trigger),
		).rejects.toThrow(context.backend.errors.JellyfishSchemaMismatch);
	});

	it('should fail to set a trigger when the list of card ids contains duplicates', async () => {
		const card = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				slug: context.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
				data: {
					id: 'id1',
				},
			},
		);

		const triggers = [
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
									const: 'foo-bar-baz',
								},
							},
						},
					},
				},
				action: 'action-update-card@1.0.0',
				target: [card.id, card.id, card.id],
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
		];

		expect(() => {
			context.worker.setTriggers(context.context, triggers);
		}).toThrow(context.worker.errors.WorkerInvalidTrigger);
	});

	test('trigger should update card if triggered by a user not owning the card', async () => {
		const card = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				slug: context.generateRandomSlug({
					prefix: 'user',
				}),
				type: 'card@1.0.0',
				version: '1.0.0',
				data: {
					id: 'id-admin',
				},
			},
		);

		context.worker.setTriggers(context.context, [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
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
		]);

		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);

		const userJohnDoe = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'user@1.0.0',
				version: '1.0.0',
				slug: context.generateRandomSlug({
					prefix: 'user',
				}),
				data: {
					email: 'accounts+jellyfish@resin.io',
					roles: ['user-community'],
					hash: 'PASSWORDLESS',
				},
			},
		);

		const sessionOfJohnDoe = await context.jellyfish.insertCard(
			context.context,
			context.session,
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

		await context.queue.producer.enqueue(
			context.worker.getId(),
			sessionIdOfJohnDoe,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: context.context,
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
			},
		);

		await context.flush(sessionIdOfJohnDoe);
		const result = await context.jellyfish.getCardById(
			context.context,
			context.session,
			card.id,
		);
		expect(result).toBeTruthy();
		expect(result.data.updated).toBe(true);
	});
});

describe('.getTriggers()', () => {
	it('should initially be an empty array', async () => {
		const newContext = await helpers.worker.before();

		const triggers = newContext.worker.getTriggers();
		expect(triggers).toEqual([]);
	});
});
