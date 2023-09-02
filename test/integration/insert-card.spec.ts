import { strict as assert } from 'assert';
import {
	AutumnDBSession,
	Contract,
	errors as autumndbErrors,
	Kernel,
	testUtils as autumndbTestUtils,
	TypeContract,
} from 'autumndb';
import {
	PluginDefinition,
	testUtils,
	TriggeredActionContract,
	TriggeredActionData,
} from '../../lib';
import { actionCreateCard } from '../../lib/actions/action-create-card';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	const foobarPlugin = (): PluginDefinition => {
		return {
			slug: 'plugin-foobar',
			name: 'Foobar Plugin',
			version: '1.0.0',
			actions: [
				{
					handler: async (
						session: AutumnDBSession,
						handlerCtx: any,
						contract: any,
						request: any,
					) => {
						request.arguments.properties.data =
							request.arguments.properties.data || {};
						request.arguments.properties.data.originator = request.originator;
						return actionCreateCard.handler(
							session,
							handlerCtx,
							contract,
							request,
						);
					},
					contract: {
						slug: 'action-test-originator',
						version: '1.0.0',
						type: actionCreateCard.contract.type,
						name: actionCreateCard.contract.name,
						data: actionCreateCard.contract.data,
					},
				},
			],
		};
	};

	ctx = await testUtils.newContext({
		plugins: [foobarPlugin()],
	});
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('.insertCard()', () => {
	test('should pass a triggered action originator', async () => {
		const typeContract = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeContract !== null);

		const command = autumndbTestUtils.generateRandomSlug({
			prefix: 'originator-test',
		});
		const id = autumndbTestUtils.generateRandomId();

		ctx.worker.setTriggers(ctx.logContext, [
			...ctx.worker.getTriggers(),
			Kernel.defaults<TriggeredActionData>({
				id,
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
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
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command,
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const contract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command}@1.0.0`,
		);

		assert(contract !== null);
		expect(contract.data.originator).toBe(id);
	});

	test('should take an originator option', async () => {
		const typeContract = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeContract !== null);

		const command = autumndbTestUtils.generateRandomSlug();
		const id = autumndbTestUtils.generateRandomId();
		ctx.worker.setTriggers(ctx.logContext, [
			...ctx.worker.getTriggers(),
			Kernel.defaults<TriggeredActionData>({
				id,
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						reason: null,
						properties: {
							slug: command,
						},
					},
				},
			}) as TriggeredActionContract,
		]);

		const originatorId = autumndbTestUtils.generateRandomId();

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				originator: originatorId,
				attachEvents: false,
				reason: null,
			},
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command,
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const contract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command}@latest`,
		);
		assert(contract !== null);
		expect(contract.data.originator).toBe(originatorId);
	});

	test('should execute one matching triggered action', async () => {
		const typeContract = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeContract !== null);

		const command = autumndbTestUtils.generateRandomSlug();
		ctx.worker.setTriggers(ctx.logContext, [
			...ctx.worker.getTriggers(),
			Kernel.defaults<TriggeredActionData>({
				id: autumndbTestUtils.generateRandomId(),
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
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
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: true,
				reason: null,
			},
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command,
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const tail = await ctx.kernel.query(ctx.logContext, ctx.session, {
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

		const resultContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command}@1.0.0`,
		);

		expect(resultContract).toBeTruthy();
	});

	test('should not execute non-matching triggered actions', async () => {
		const typeContract = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeContract !== null);

		const command = autumndbTestUtils.generateRandomSlug();
		ctx.worker.setTriggers(ctx.logContext, [
			Kernel.defaults<TriggeredActionData>({
				id: autumndbTestUtils.generateRandomId(),
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: command,
						},
					},
				},
			}) as TriggeredActionContract,
		]);

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: true,
				reason: null,
			},
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command: autumndbTestUtils.generateRandomSlug(),
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const resultContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command}@1.0.0`,
		);

		expect(resultContract).toBeFalsy();
	});

	test('should execute more than one matching triggered action', async () => {
		const typeContract = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeContract !== null);

		const prefix = 'triggered-action-test';
		const command1 = autumndbTestUtils.generateRandomSlug({ prefix });
		const command2 = autumndbTestUtils.generateRandomSlug({ prefix });
		ctx.worker.setTriggers(ctx.logContext, [
			Kernel.defaults<TriggeredActionData>({
				id: autumndbTestUtils.generateRandomId(),
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						reason: null,
						properties: {
							slug: command1,
						},
					},
				},
			}) as TriggeredActionContract,
			Kernel.defaults<TriggeredActionData>({
				id: autumndbTestUtils.generateRandomId(),
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
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
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: true,
				reason: null,
			},
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command: command1,
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const resultContract1 = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command1}@1.0.0`,
		);

		const resultContract2 = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command2}@1.0.0`,
		);

		expect(resultContract1).toBeTruthy();
		expect(resultContract2).toBeTruthy();
	});

	test('should execute the matching triggered actions given more than one', async () => {
		const typeContract = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeContract !== null);

		const command1 = autumndbTestUtils.generateRandomSlug();
		const command2 = autumndbTestUtils.generateRandomSlug();
		ctx.worker.setTriggers(ctx.logContext, [
			Kernel.defaults<TriggeredActionData>({
				id: autumndbTestUtils.generateRandomId(),
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						reason: null,
						properties: {
							slug: command1,
						},
					},
				},
			}) as TriggeredActionContract,
			Kernel.defaults<TriggeredActionData>({
				id: autumndbTestUtils.generateRandomId(),
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
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
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: true,
				reason: null,
			},
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command: command1,
				},
			},
		);

		await ctx.flushAll(ctx.session);

		const resultContract1 = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command1}@1.0.0`,
		);

		const resultContract2 = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command2}@1.0.0`,
		);

		expect(resultContract1).toBeTruthy();
		expect(resultContract2).toBeFalsy();
	});

	test('should remove previously inserted type triggered actions if inserting a type', async () => {
		const typeContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeContract !== null);

		const fooType = autumndbTestUtils.generateRandomSlug({
			prefix: 'foo',
		});
		const barType = autumndbTestUtils.generateRandomSlug({
			prefix: 'bar',
		});
		const contracts = [
			{
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						reason: null,
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
							version: '1.0.0',
							data: {
								bar: {
									$eval: 'source.data.bar',
								},
							},
						},
					},
				},
			},
			{
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						reason: null,
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
							version: '1.0.0',
							data: {
								bar: {
									$eval: 'source.data.bar',
								},
							},
						},
					},
				},
			},
		].map((contract) => Kernel.defaults<TriggeredActionData>(contract));

		const insertedContracts = await Promise.all(
			contracts.map((contract) => {
				return ctx.kernel.insertContract(
					ctx.logContext,
					ctx.session,
					contract as Contract,
				);
			}),
		);

		await ctx.flushAll(ctx.session);

		const typeTypeContract = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);

		assert(typeTypeContract !== null);

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeTypeContract,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
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

		const triggers = await ctx.kernel.query(ctx.logContext, ctx.session, {
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

		const updatedContract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			insertedContracts[1].id,
		);

		expect(triggers).toEqual([
			Object.assign({}, updatedContract, {
				id: triggers[0].id,
			}),
		]);
	});

	test('should throw when contract with same slug already exists', async () => {
		const typeContract = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		assert(typeContract);

		// Insert initial contract
		const slug = autumndbTestUtils.generateRandomSlug();
		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				slug,
				version: '1.0.0',
				data: {},
			},
		);

		// Insert another contract with same slug, should throw
		await expect(() => {
			return ctx.worker.insertCard(
				ctx.logContext,
				ctx.session,
				typeContract,
				{
					timestamp: new Date().toISOString(),
					actor: ctx.adminUserId,
					attachEvents: false,
					reason: null,
				},
				{
					slug,
					version: '1.0.0',
					data: {},
				},
			);
		}).rejects.toThrowError(autumndbErrors.JellyfishElementAlreadyExists);
	});

	test('should throw when contract with same id already exists', async () => {
		const typeContract = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		assert(typeContract);

		// Insert initial contract
		const id = autumndbTestUtils.generateRandomId();
		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				id,
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'card',
				}),
				version: '1.0.0',
				data: {},
			},
		);

		// Insert another contract with same id, should throw
		await expect(() => {
			return ctx.worker.insertCard(
				ctx.logContext,
				ctx.session,
				typeContract,
				{
					timestamp: new Date().toISOString(),
					actor: ctx.adminUserId,
					attachEvents: false,
					reason: null,
				},
				{
					id,
					slug: autumndbTestUtils.generateRandomSlug({
						prefix: 'card',
					}),
					version: '1.0.0',
					data: {},
				},
			);
		}).rejects.toThrowError(autumndbErrors.JellyfishElementAlreadyExists);
	});

	test('should create actor links', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomId().split('-')[0],
		);

		// Insert contract
		const inserted = await ctx.worker.insertCard(
			ctx.logContext,
			{ actor: user },
			ctx.worker.typeContracts['card@1.0.0'],
			{
				timestamp: new Date().toISOString(),
				actor: user.id,
				attachEvents: false,
				reason: null,
			},
			{
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'card',
				}),
				version: '1.0.0',
				data: {},
			},
		);
		assert(inserted);

		// Assert that an actor link was created for this contract
		await ctx.waitForMatch({
			type: 'object',
			additionalProperties: true,
			required: ['type', 'name', 'data'],
			properties: {
				type: {
					const: 'link@1.0.0',
				},
				name: {
					const: 'is creator of',
				},
				data: {
					type: 'object',
					required: ['from', 'to'],
					properties: {
						from: {
							type: 'object',
							required: ['type', 'id'],
							properties: {
								type: {
									const: 'user@1.0.0',
								},
								id: {
									const: user.id,
								},
							},
						},
						to: {
							type: 'object',
							required: ['type', 'id'],
							properties: {
								type: {
									const: inserted.type,
								},
								id: {
									const: inserted.id,
								},
							},
						},
					},
				},
			},
		});
	});
});
