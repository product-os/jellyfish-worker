import { strict as assert } from 'assert';
import {
	errors as autumndbErrors,
	Kernel,
	testUtils as autumndbTestUtils,
} from 'autumndb';
import { ActionRequestContract, testUtils, WorkerContext } from '../../../lib';
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
		const contract = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'card@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{ payload: 'test' },
		);
		const request = {
			context: {
				id: `TEST-${autumndbTestUtils.generateRandomId()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.adminUserId,
			originator: autumndbTestUtils.generateRandomId(),
			arguments: {
				type: 'foobar',
				payload: contract.data.payload,
			},
		};

		await expect(
			actionCreateEvent.handler(
				ctx.session,
				actionContext,
				contract,
				request as any,
			),
		).rejects.toThrow(`No such type: ${request.arguments.type}`);
	});

	test('should return event contract', async () => {
		const contract = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'card@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{ payload: 'test' },
		);
		const request = {
			context: {
				id: `TEST-${autumndbTestUtils.generateRandomId()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.adminUserId,
			originator: autumndbTestUtils.generateRandomId(),
			arguments: {
				type: 'card',
				payload: contract.data.payload,
			},
		};

		const results = await actionCreateEvent.handler(
			ctx.session,
			actionContext,
			contract,
			request as any,
		);
		expect((results as any).slug).toMatch(/^card-/);
	});

	test('should throw an error on attempt to insert existing contract', async () => {
		const contract = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'card@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{ payload: 'test' },
		);
		const request = {
			context: {
				id: `TEST-${autumndbTestUtils.generateRandomId()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.adminUserId,
			originator: autumndbTestUtils.generateRandomId(),
			arguments: {
				type: 'card',
				slug: contract.slug,
				payload: contract.data.payload,
			},
		};

		await expect(
			actionCreateEvent.handler(
				ctx.session,
				actionContext,
				contract,
				request as any,
			),
		).rejects.toThrow(autumndbErrors.JellyfishElementAlreadyExists);
	});

	test('should create a link contract', async () => {
		const root = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'card@1.0.0',
			null,
			{ payload: 'test' },
		);

		const eventRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-event@1.0.0',
					context: ctx.logContext,
					card: root.id,
					type: root.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: root.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						type: 'card',
						tags: [],
						payload: {
							message: 'johndoe',
						},
					},
				},
			},
		);
		assert(eventRequest);
		await ctx.flushAll(ctx.session);
		const eventResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			eventRequest,
		);
		expect(eventResult.error).toBe(false);

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
									const: eventResult.data.id,
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
						id: eventResult.data.id,
						type: 'card@1.0.0',
					},
					to: {
						id: root.id,
						type: root.type,
					},
				},
			}),
		);
	});

	test('should be able to add an event name', async () => {
		const root = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'card@1.0.0',
			null,
			{ payload: 'test' },
		);

		const eventRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-event@1.0.0',
					context: ctx.logContext,
					card: root.id,
					type: root.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: root.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						type: 'card',
						name: 'Hello world',
						tags: [],
						payload: {
							message: 'johndoe',
						},
					},
				},
			},
		);
		assert(eventRequest);
		await ctx.flushAll(ctx.session);
		const eventResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			eventRequest,
		);
		expect(eventResult.error).toBe(false);

		const event = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			eventResult.data.id,
		);
		assert(event);
		expect(event.name).toBe('Hello world');
	});

	test("events should always inherit their parent's markers", async () => {
		const marker = 'org-test';
		const contract = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['card@1.0.0'],
			{
				attachEvents: true,
				actor: ctx.adminUserId,
			},
			{
				name: autumndbTestUtils.generateRandomSlug(),
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'card',
				}),
				version: '1.0.0',
				markers: [marker],
				data: {
					status: 'open',
				},
			},
		);
		assert(contract);

		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-event@1.0.0',
					context: ctx.logContext,
					card: contract.id,
					type: contract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: contract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						type: 'card',
						tags: [],
						payload: {
							message: 'johndoe',
						},
					},
				},
			},
		);
		assert(request);
		await ctx.flushAll(ctx.session);
		const contractResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(contractResult.error).toBe(false);

		const result = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			contractResult.data.id,
		);
		assert(result);
		expect(result.markers).toEqual([marker]);
	});
});
