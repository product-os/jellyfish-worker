import { strict as assert } from 'assert';
import { Kernel, testUtils as autumndbTestUtils } from 'autumndb';
import _ from 'lodash';
import {
	ActionRequestContract,
	testUtils,
	TriggeredActionContract,
	TriggeredActionData,
} from '../../lib';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('.execute()', () => {
	test('should execute an action', async () => {
		const typeContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		assert(typeContract);

		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							slug: autumndbTestUtils.generateRandomSlug({
								prefix: 'execute-test',
							}),
							version: '1.0.0',
							data: {
								foo: 'bar',
							},
						},
					},
				},
			},
		);
		assert(request);

		await ctx.flush(ctx.session);
		const result: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);

		expect(result.error).toBe(false);
		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			result.data.id,
		);
		assert(contract !== null);
		expect(contract.data.foo).toBe('bar');
	});

	test('should safely handle circular references in action handler errors', async () => {
		const typeContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeContract !== null);

		// Add our test action and handler function
		const slug = 'action-throw-circular-error';
		await ctx.kernel.replaceContract(ctx.logContext, ctx.session, {
			slug,
			version: '1.0.0',
			type: 'action@1.0.0',
			name: 'Action Throw Circular Error',
			data: {
				filter: {
					type: 'object',
				},
				arguments: {
					reason: {
						type: ['null', 'string'],
					},
					properties: {
						type: 'object',
					},
				},
			},
		});

		ctx.worker.library[slug] = {
			handler: async (_session, _context, _typeContract, _request) => {
				const err = new Error('circular error');
				(err as any).circularRef = err;
				throw err;
			},
		};

		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: `${slug}@1.0.0`,
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							slug: autumndbTestUtils.generateRandomSlug({
								prefix: 'execute-test',
							}),
							version: '1.0.0',
							data: {
								foo: 'bar',
							},
						},
					},
				},
			},
		);
		assert(request);

		try {
			await ctx.flush(ctx.session);
		} catch (err) {
			// we're expecting an error here, so just ignore it
		}
		const result: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);

		expect(result.error).toBe(true);
	});

	test('should execute a triggered action given a matching mode', async () => {
		const typeContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		const actionContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'action-create-card@latest',
		);

		assert(typeContract !== null);
		assert(actionContract !== null);

		const command = autumndbTestUtils.generateRandomSlug();
		ctx.worker.upsertTrigger(
			ctx.logContext,
			Kernel.defaults<TriggeredActionData>({
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
					mode: 'insert',
					action: 'action-create-card@1.0.0',
					target: typeContract.id,
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug: command,
						},
					},
				},
			}) as TriggeredActionContract,
		);

		const slug = autumndbTestUtils.generateRandomSlug();
		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: `${actionContract.slug}@${actionContract.version}`,
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							slug,
							version: '1.0.0',
							data: {
								command,
							},
						},
					},
				},
			},
		);
		assert(request);

		await ctx.flush(ctx.session);
		const result = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);

		expect(result.error).toBe(false);

		await ctx.flushAll(ctx.session);

		const contract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command}@latest`,
		);

		expect(contract).toBeTruthy();

		const resultContract = await ctx.waitForMatch({
			type: 'object',
			properties: {
				slug: {
					const: slug,
				},
				data: {
					type: 'object',
					properties: {
						command: {
							const: command,
						},
					},
				},
			},
		});

		assert(resultContract !== null);

		expect(resultContract.data.command).toBe(command);
	});

	test('should not execute a triggered action given a non matching mode', async () => {
		const typeContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		const actionContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'action-create-card@latest',
		);

		assert(typeContract !== null);
		assert(actionContract !== null);

		const command = autumndbTestUtils.generateRandomSlug();
		ctx.worker.upsertTrigger(
			ctx.logContext,
			Kernel.defaults<TriggeredActionData>({
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
					mode: 'update',
					action: 'action-create-card@1.0.0',
					target: typeContract.id,
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug: command,
						},
					},
				},
			}) as TriggeredActionContract,
		);

		const slug = autumndbTestUtils.generateRandomSlug();
		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: `${actionContract.slug}@${actionContract.version}`,
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							slug,
							version: '1.0.0',
							data: {
								command,
							},
						},
					},
				},
			},
		);
		assert(request);

		await ctx.flush(ctx.session);
		const result = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);

		expect(result.error).toBe(false);

		const contract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command}@latest`,
		);

		expect(contract).toBeFalsy();

		const resultContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${slug}@latest`,
		);

		assert(resultContract !== null);

		expect(resultContract.data.command).toBe(command);
	});

	test('should execute a triggered action with a top level anyOf', async () => {
		const typeContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		const actionContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'action-create-card@latest',
		);

		assert(typeContract !== null);
		assert(actionContract !== null);

		const command = autumndbTestUtils.generateRandomSlug();
		ctx.worker.upsertTrigger(
			ctx.logContext,
			Kernel.defaults<TriggeredActionData>({
				id: autumndbTestUtils.generateRandomId(),
				slug: `triggered-action-${autumndbTestUtils.generateRandomId()}`,
				type: 'triggered-action@1.0.0',
				data: {
					filter: {
						type: 'object',
						required: ['data'],
						anyOf: [
							{
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
							{
								properties: {
									data: {
										type: 'string',
									},
								},
							},
						],
					},
					action: 'action-create-card@1.0.0',
					target: typeContract.id,
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug: command,
						},
					},
				},
			}) as TriggeredActionContract,
		);

		const slug = autumndbTestUtils.generateRandomSlug();

		await new Promise((resolve) => {
			setTimeout(resolve, 5000);
		});

		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: `${actionContract.slug}@${actionContract.version}`,
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug,
							data: {
								command,
							},
						},
					},
				},
			},
		);
		assert(request);
		await ctx.flush(ctx.session);

		const result = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);

		expect(result.error).toBe(false);

		await ctx.flushAll(ctx.session);

		const contract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command}@latest`,
		);
		expect(contract).toBeTruthy();
	});

	test('should add a create event when creating a contract', async () => {
		const typeContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		const actionContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'action-create-card@latest',
		);

		assert(typeContract !== null);
		assert(actionContract !== null);

		const slug = autumndbTestUtils.generateRandomSlug();
		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: `${actionContract.slug}@${actionContract.version}`,
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug,
							data: {
								foo: 'bar',
							},
						},
					},
				},
			},
		);
		assert(request);
		await ctx.flush(ctx.session);
		const result: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);

		expect(result.error).toBe(false);

		const timeline = await ctx.kernel.query(ctx.logContext, ctx.session, {
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
							const: result.data.id,
						},
					},
				},
			},
		});

		expect(timeline.length).toBe(1);
		expect(timeline[0].type).toBe('create@1.0.0');
	});

	test('should create a message with tags', async () => {
		const typeType = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = autumndbTestUtils.generateRandomSlug();
		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeType.id,
					type: typeType.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeType.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
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
									},
									additionalProperties: true,
									required: ['type'],
								},
							},
						},
					},
				},
			},
		);
		assert(request);
		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(typeResult.error).toBe(false);

		const threadRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeResult.data.id,
					type: typeResult.data.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeResult.data.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							slug: autumndbTestUtils.generateRandomSlug(),
							version: '1.0.0',
						},
					},
				},
			},
		);
		assert(threadRequest);
		await ctx.flush(ctx.session);
		const threadResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			threadRequest,
		);
		expect(threadResult.error).toBe(false);

		const messageRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-event@1.0.0',
					context: ctx.logContext,
					card: threadResult.data.id,
					type: threadResult.data.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: threadResult.data.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						type: 'card',
						tags: ['testtag'],
						payload: {
							$$mentions: ['johndoe'],
							message: 'Hello',
						},
					},
				},
			},
		);
		assert(messageRequest);
		await ctx.flush(ctx.session);
		const messageResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			messageRequest,
		);

		expect(messageResult.error).toBe(false);

		const element = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			messageResult.data.id,
		);

		assert(element !== null);

		expect(element.tags).toEqual(['testtag']);
	});

	test('should add an execution event to the action request', async () => {
		const typeContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		const actionContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'action-create-card@latest',
		);
		assert(typeContract !== null);
		assert(actionContract !== null);

		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: `${actionContract.slug}@${actionContract.version}`,
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							slug: autumndbTestUtils.generateRandomSlug(),
							version: '1.0.0',
							data: {
								foo: 'bar',
							},
						},
					},
				},
			},
		);
		assert(request);
		await ctx.flush(ctx.session);
		const result = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(result.error).toBe(false);

		const timeline = await ctx.kernel.query(ctx.logContext, ctx.session, {
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
							const: request.id,
						},
					},
				},
			},
		});

		expect(timeline.length).toBe(1);
		expect(timeline[0].type).toBe('execute@1.0.0');
	});

	test('should execute a triggered action', async () => {
		const typeContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		const actionContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'action-create-card@latest',
		);
		assert(typeContract !== null);
		assert(actionContract !== null);

		const command = autumndbTestUtils.generateRandomSlug();
		ctx.worker.upsertTrigger(
			ctx.logContext,
			Kernel.defaults<TriggeredActionData>({
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
					target: typeContract.id,
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug: command,
						},
					},
				},
			}) as TriggeredActionContract,
		);

		const slug = autumndbTestUtils.generateRandomSlug();
		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: `${actionContract.slug}@${actionContract.version}`,
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							slug,
							version: '1.0.0',
							data: {
								command,
							},
						},
					},
				},
			},
		);
		assert(request);
		await ctx.flush(ctx.session);
		const result = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);

		expect(result.error).toBe(false);

		await ctx.flushAll(ctx.session);

		const contract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command}@latest`,
		);

		expect(contract).toBeTruthy();

		await ctx.flushAll(ctx.session);

		const resultContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${slug}@latest`,
		);

		assert(resultContract !== null);

		expect(resultContract.data.command).toBe(command);
	});

	test('should create a contract', async () => {
		const typeContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeContract !== null);

		const slug = autumndbTestUtils.generateRandomSlug();
		const actionRequest =
			await ctx.kernel.insertContract<ActionRequestContract>(
				ctx.logContext,
				ctx.session,
				{
					slug: `action-request-${autumndbTestUtils.generateRandomId()}`,
					type: 'action-request@1.0.0',
					data: {
						actor: ctx.adminUserId,
						context: ctx.logContext,
						action: 'action-create-card@1.0.0',
						epoch: 1530663772247,
						timestamp: '2018-07-04T00:22:52.247Z',
						input: {
							id: typeContract.id,
							type: typeContract.type,
						},
						arguments: {
							reason: null,
							properties: {
								slug,
								version: '1.0.0',
							},
						},
					},
				},
			);

		const result = await ctx.worker.execute(ctx.session, actionRequest);

		expect(result.data).toEqual({
			id: result.data.id,
			type: 'card@1.0.0',
			version: '1.0.0',
			slug,
		});
	});

	test('should throw if the input contract does not exist', async () => {
		const actionRequest =
			await ctx.kernel.insertContract<ActionRequestContract>(
				ctx.logContext,
				ctx.session,
				{
					slug: `action-request-${autumndbTestUtils.generateRandomId()}`,
					type: 'action-request@1.0.0',
					data: {
						actor: ctx.adminUserId,
						context: ctx.logContext,
						action: 'action-create-card@1.0.0',
						epoch: 1530663772247,
						timestamp: '2018-07-04T00:22:52.247Z',
						input: {
							// Make up a new UUID that doesn't correspond to any contract
							id: autumndbTestUtils.generateRandomId(),
							type: 'card@1.0.0',
						},
						arguments: {
							reason: null,
							properties: {
								slug: autumndbTestUtils.generateRandomSlug(),
								version: '1.0.0',
							},
						},
					},
				},
			);

		const result = await ctx.worker.execute(ctx.session, actionRequest);
		expect(result.error).toBe(true);
		expect(result.data.name).toBe('WorkerNoElement');
	});

	test('should throw if the actor does not exist', async () => {
		const typeContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeContract !== null);

		const actionRequest =
			await ctx.kernel.insertContract<ActionRequestContract>(
				ctx.logContext,
				ctx.session,
				{
					slug: `action-request-${autumndbTestUtils.generateRandomId()}`,
					type: 'action-request@1.0.0',
					data: {
						actor: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
						context: ctx.logContext,
						action: 'action-create-card@1.0.0',
						epoch: 1530663772247,
						timestamp: '2018-07-04T00:22:52.247Z',
						input: {
							id: typeContract.id,
							type: typeContract.type,
						},
						arguments: {
							reason: null,
							properties: {
								slug: autumndbTestUtils.generateRandomSlug(),
								version: '1.0.0',
							},
						},
					},
				},
			);

		const result = await ctx.worker.execute(ctx.session, actionRequest);
		expect(result.error).toBe(true);
		expect(result.data.name).toBe('WorkerNoElement');
	});

	test('should throw if input contract does not match the action filter', async () => {
		const actionContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'action-create-card@latest',
		);

		assert(actionContract !== null);

		const actionRequest =
			await ctx.kernel.insertContract<ActionRequestContract>(
				ctx.logContext,
				ctx.session,
				{
					slug: `action-request-${autumndbTestUtils.generateRandomId()}`,
					type: 'action-request@1.0.0',
					data: {
						actor: ctx.adminUserId,
						context: ctx.logContext,
						action: 'action-create-card@1.0.0',
						epoch: 1530663772247,
						timestamp: '2018-07-04T00:22:52.247Z',
						input: {
							id: actionContract.id,
							type: actionContract.type,
						},
						arguments: {
							reason: null,
							properties: {
								slug: autumndbTestUtils.generateRandomSlug(),
								version: '1.0.0',
							},
						},
					},
				},
			);

		// The input filter on action-create-card checks that the input contracts has
		// a type of "type". If it doesn't, the action request is rejected.
		const result = await ctx.worker.execute(ctx.session, actionRequest);
		expect(result.error).toBe(true);
		expect(result.data.name).toBe('WorkerSchemaMismatch');
	});

	test('should return an error if the arguments do not match the action', async () => {
		const typeContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeContract !== null);

		const actionRequest =
			await ctx.kernel.insertContract<ActionRequestContract>(
				ctx.logContext,
				ctx.session,
				{
					slug: `action-request-${autumndbTestUtils.generateRandomId()}`,
					type: 'action-request@1.0.0',
					data: {
						actor: ctx.adminUserId,
						context: ctx.logContext,
						action: 'action-create-card@1.0.0',
						epoch: 1530663772247,
						timestamp: '2018-07-04T00:22:52.247Z',
						input: {
							id: typeContract.id,
							type: typeContract.type,
						},
						arguments: {
							foo: 'bar',
							bar: 'baz',
						},
					},
				},
			);

		const result = await ctx.worker.execute(ctx.session, actionRequest);
		expect(result.error).toBe(true);
		expect(result.data.name).toBe('WorkerSchemaMismatch');
	});

	test('should return an error if the action has no corresponding implementation', async () => {
		const localCtx = await testUtils.newContext();

		const action = 'action-create-card@1.0.0';

		// Remove the library function from the worker instance
		Reflect.deleteProperty(localCtx.worker.library, action.split('@')[0]);

		const typeContract = await localCtx.kernel.getContractBySlug(
			localCtx.logContext,
			localCtx.session,
			'card@latest',
		);
		assert(typeContract !== null);

		const actionRequest =
			await localCtx.kernel.insertContract<ActionRequestContract>(
				localCtx.logContext,
				localCtx.session,
				{
					slug: `action-request-${autumndbTestUtils.generateRandomId()}`,
					type: 'action-request@1.0.0',
					data: {
						actor: localCtx.adminUserId,
						context: localCtx.logContext,
						action,
						epoch: 1530663772247,
						timestamp: '2018-07-04T00:22:52.247Z',
						input: {
							id: typeContract.id,
							type: typeContract.type,
						},
						arguments: {
							reason: null,
							properties: {
								slug: autumndbTestUtils.generateRandomSlug(),
								version: '1.0.0',
							},
						},
					},
				},
			);

		const result = await localCtx.worker.execute(
			localCtx.session,
			actionRequest,
		);
		expect(result.error).toBe(true);
		expect(result.data.name).toBe('WorkerInvalidAction');

		await testUtils.destroyContext(localCtx);
	});
});
