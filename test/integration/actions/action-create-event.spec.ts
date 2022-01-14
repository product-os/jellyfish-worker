import { strict as assert } from 'assert';
import { Kernel, testUtils as coreTestUtils } from '@balena/jellyfish-core';
import { isArray, isNull } from 'lodash';
import { testUtils, WorkerContext } from '../../../lib';
import { actionCreateEvent } from '../../../lib/actions/action-create-event';

let ctx: testUtils.TestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
	actionContext = ctx.worker.getActionContext(ctx.logContext);
});

afterAll(async () => {
	await testUtils.destroyContext(ctx);
});

describe('action-create-event', () => {
	test('should throw an error on invalid type', async () => {
		const message = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'message@1.0.0',
			coreTestUtils.generateRandomSlug(),
			{
				actor: ctx.adminUserId,
				payload: {
					message: coreTestUtils.generateRandomSlug(),
				},
				timestamp: new Date().toISOString(),
			},
		);
		const request: any = {
			context: {
				id: `TEST-${coreTestUtils.generateRandomId()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.adminUserId,
			originator: coreTestUtils.generateRandomId(),
			arguments: {
				type: 'foobar',
				payload: message.data.payload,
			},
		} as any;

		expect.assertions(1);
		try {
			await actionCreateEvent.handler(
				ctx.session,
				actionContext,
				message,
				request,
			);
		} catch (error: any) {
			expect(error.message).toEqual(`No such type: ${request.arguments.type}`);
		}
	});

	test('should return event card', async () => {
		const message = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'message@1.0.0',
			coreTestUtils.generateRandomSlug(),
			{
				actor: ctx.adminUserId,
				payload: {
					message: coreTestUtils.generateRandomSlug(),
				},
				timestamp: new Date().toISOString(),
			},
		);
		const request: any = {
			context: {
				id: `TEST-${coreTestUtils.generateRandomId()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.adminUserId,
			originator: coreTestUtils.generateRandomId(),
			arguments: {
				type: 'message',
				payload: message.data.payload,
			},
		} as any;

		expect.assertions(1);
		const result = await actionCreateEvent.handler(
			ctx.session,
			actionContext,
			message,
			request,
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toMatch(/^message-/);
		}
	});

	test('should throw an error on attempt to insert existing card', async () => {
		const message = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'message@1.0.0',
			coreTestUtils.generateRandomSlug(),
			{
				actor: ctx.adminUserId,
				payload: {
					message: coreTestUtils.generateRandomSlug(),
				},
				timestamp: new Date().toISOString(),
			},
		);
		const request: any = {
			context: {
				id: `TEST-${coreTestUtils.generateRandomId()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.adminUserId,
			originator: coreTestUtils.generateRandomId(),
			arguments: {
				type: 'message',
				slug: message.slug,
				payload: message.data.payload,
			},
		} as any;

		expect.assertions(1);
		try {
			await actionCreateEvent.handler(
				ctx.session,
				actionContext,
				message,
				request,
			);
		} catch (error: any) {
			expect(error.name).toEqual('JellyfishElementAlreadyExists');
		}
	});

	test('should create a link card', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.adminUserId,
			ctx.session,
			coreTestUtils.generateRandomSlug(),
			{
				status: 'open',
			},
		);

		const messageRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				logContext: ctx.logContext,
				card: supportThread.id,
				type: supportThread.type,
				arguments: {
					type: 'message',
					tags: [],
					payload: {
						message: 'johndoe',
					},
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const messageResult: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		const [link] = await ctx.kernel.query(ctx.logContext, ctx.session, {
			type: 'object',
			properties: {
				type: {
					type: 'string',
					const: 'link@1.0.0',
				},
				data: {
					type: 'object',
					properties: {
						from: {
							type: 'object',
							properties: {
								id: {
									type: 'string',
									const: messageResult.data.id,
								},
							},
							required: ['id'],
						},
					},
					required: ['from'],
				},
			},
			required: ['type', 'data'],
			additionalProperties: true,
		});

		expect(link).toEqual(
			Kernel.defaults({
				created_at: link.created_at,
				id: link.id,
				slug: link.slug,
				name: 'is attached to',
				type: 'link@1.0.0',
				data: {
					inverseName: 'has attached element',
					from: {
						id: messageResult.data.id,
						type: 'message@1.0.0',
					},
					to: {
						id: supportThread.id,
						type: supportThread.type,
					},
				},
			}),
		);
	});

	test('should be able to add an event name', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.adminUserId,
			ctx.session,
			coreTestUtils.generateRandomSlug(),
			{
				status: 'open',
			},
		);

		const messageRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				logContext: ctx.logContext,
				card: supportThread.id,
				type: supportThread.type,
				arguments: {
					type: 'message',
					name: 'Hello world',
					tags: [],
					payload: {
						message: 'johndoe',
					},
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const messageResult: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		const event = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			messageResult.data.id,
		);
		assert(event);
		expect(event.name).toBe('Hello world');
	});

	test("events should always inherit their parent's markers", async () => {
		const marker = 'org-test';
		const supportThread = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['support-thread@1.0.0'],
			{
				attachEvents: true,
				actor: ctx.adminUserId,
			},
			{
				name: coreTestUtils.generateRandomSlug(),
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'support-thread',
				}),
				version: '1.0.0',
				markers: [marker],
				data: {
					status: 'open',
				},
			},
		);
		assert(supportThread);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				logContext: ctx.logContext,
				card: supportThread.id,
				type: supportThread.type,
				arguments: {
					type: 'message',
					tags: [],
					payload: {
						message: 'johndoe',
					},
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const messageResult: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(messageResult.error).toBe(false);

		const card = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			messageResult.data.id,
		);
		assert(card);
		expect(card.markers).toEqual([marker]);
	});
});
