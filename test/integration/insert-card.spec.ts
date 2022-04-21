import type {
	Contract,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import { strict as assert } from 'assert';
import { Kernel, testUtils as autumndbTestUtils } from 'autumndb';
import _ from 'lodash';
import {
	testUtils,
	PluginDefinition,
	TriggeredActionContract,
	TriggeredActionData,
	TransformerContractDefinition,
} from '../../lib';
import { actionCreateCard } from '../../lib/actions/action-create-card';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	const foobarTransformer: TransformerContractDefinition = {
		slug: 'transformer-foobar',
		type: 'transformer@1.0.0',
		active: true,
		data: {
			requirements: {},
			inputFilter: {},
			workerFilter: {},
			$transformer: {
				artifactReady: true,
			},
		},
	};
	const foobarPlugin = (): PluginDefinition => {
		return {
			slug: 'plugin-foobar',
			name: 'Foobar Plugin',
			version: '1.0.0',
			actions: [
				{
					handler: async (
						session: string,
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
			contracts: [foobarTransformer],
		};
	};

	ctx = await testUtils.newContext({
		plugins: [foobarPlugin()],
	});

	await ctx.kernel.replaceContract(ctx.logContext, ctx.session, {
		slug: 'transformer-buzbaz',
		type: 'transformer@1.0.0',
		active: true,
		data: {
			requirements: {},
			inputFilter: {},
			workerFilter: {},
			$transformer: {
				artifactReady: true,
			},
		},
	});

	await new Promise((resolve) => {
		setTimeout(resolve, 3000);
	});

	console.log(
		'transformers:',
		JSON.stringify(ctx.worker.transformers, null, 4),
	);
	console.log(
		'latestTransformers:',
		JSON.stringify(ctx.worker.latestTransformers, null, 4),
	);
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('.insertCard()', () => {
	test.only('should pass a triggered action originator', async () => {
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
								number: {
									$eval: 'source.data.number',
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

	test('should execute a triggered action given a type with an contract.links["..."] formula', async () => {
		// This test
		// * creates a new type with a link formula
		// * creates two contracts of this type
		// * links the two contracts
		// * updates the contract that was linked from
		// * checks if formula in linked to contract was updated
		// (and lots of sanity checks in the middle)

		const typeType = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);
		const linkType = (await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'link@latest',
		))!;

		assert(typeType !== null);

		const typeSlug = autumndbTestUtils.generateRandomSlug();
		const initialValue = 1;
		const propValueBeforeUpdate = 2;
		const magicNumber = 3;

		const newType = (await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				slug: typeSlug,
				version: '1.0.0',
				data: {
					schema: {
						type: 'object',
						properties: {
							type: {
								type: 'string',
								const: `${typeSlug}@1.0.0`,
							},
							data: {
								type: 'object',
								properties: {
									linkedProperty: {
										type: 'number',
										$$formula:
											'contract.links["was built from"].length && contract.links["was built from"][0].data.prop',
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
		))! as TypeContract;

		const triggeredAction = await ctx.waitForMatch({
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
							const: `${typeSlug}@1.0.0`,
						},
					},
				},
			},
		});

		const testContract = (await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			newType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				data: {
					otherProp: 42,
					linkedProperty: initialValue, // should get overwritten immediately
				},
			},
		))!;

		const linkedContract = (await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			newType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				data: {
					otherProp: 23,
					prop: propValueBeforeUpdate,
				},
			},
		))!;

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			linkType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				name: 'was built into',
				data: {
					inverseName: 'was built from',
					from: {
						id: linkedContract.id,
						slug: linkedContract.slug,
						type: linkedContract.type,
					},
					to: {
						id: testContract.id,
						slug: testContract.slug,
						type: testContract.type,
					},
				},
			},
		);

		// sanity check that link and filter work as expected
		const triggerMatch = await ctx.waitForMatch(triggeredAction.data.filter);
		expect(triggerMatch.id).toEqual(linkedContract.id);

		// first test if linked formula works in when invoked directly
		await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			newType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: 'random change that should trigger formula re-eval',
			},
			testContract,
			[{ op: 'add', path: '/data/randomChange', value: 1 }],
		);

		const testContractAfterBogusUpdate = await ctx.waitForMatch({
			type: 'object',
			additionalProperties: true,
			required: ['id'],
			properties: {
				id: {
					type: 'string',
					const: testContract.id,
				},
				data: {
					type: 'object',
					required: ['linkedProperty'],
					properties: {
						linkedProperty: {
							type: 'number',
							const: propValueBeforeUpdate,
						},
					},
				},
			},
		});

		expect(testContractAfterBogusUpdate.data.linkedProperty).toEqual(
			propValueBeforeUpdate,
		);

		// force an update as linking doesn't seem to be enough
		await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			newType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: 'random change that should cause triggered action to run',
			},
			linkedContract,
			[{ op: 'replace', path: '/data/prop', value: magicNumber }],
		);

		await ctx.flush(ctx.session);

		const testContractAfterUpdate = await ctx.waitForMatch({
			type: 'object',
			additionalProperties: true,
			required: ['id'],
			properties: {
				id: {
					type: 'string',
					const: testContract.id,
				},
				data: {
					type: 'object',
					required: ['linkedProperty'],
					properties: {
						linkedProperty: {
							type: 'number',
							const: magicNumber,
						},
					},
				},
			},
		});

		expect(testContractAfterUpdate.data.linkedProperty).toEqual(magicNumber);
	});

	test('should correctly evaluate formula that consumes contract.links["..."] formula field', async () => {
		// This test
		// * creates a new type with a link formula and a formula that references this field
		// * creates two contracts
		// * links the two contracts
		// * updates the contract that was linked from
		// * checks if formula in linked to contract was updated

		const typeType = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);
		const linkType = (await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'link@latest',
		))!;

		assert(typeType !== null);

		const typeSlug = autumndbTestUtils.generateRandomSlug();
		const initialValue = 1;
		const propValueBeforeUpdate = 2;
		const magicNumber = 13;

		const newType = (await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				slug: typeSlug,
				version: '1.0.0',
				data: {
					schema: {
						type: 'object',
						properties: {
							type: {
								type: 'string',
								const: `${typeSlug}@1.0.0`,
							},
							data: {
								type: 'object',
								properties: {
									dependentProperty: {
										type: 'string',
										$$formula: `
												(contract.data.linkedProperty || 0) > 10 ?
													'greater than 10!' :
													'less than 10!'
											`,
									},
									linkedProperty: {
										type: 'number',
										$$formula:
											'contract.links["was built from"].length && contract.links["was built from"][0].data.prop',
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
		))! as TypeContract;

		// Wait for the formula trigger to be registered
		await ctx.waitForMatch({
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
							const: `${typeSlug}@1.0.0`,
						},
					},
				},
			},
		});

		const testContract = (await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			newType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				data: {
					otherProp: 42,
					linkedProperty: initialValue, // should get overwritten immediately
				},
			},
		))!;

		const linkedContract = (await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			newType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				data: {
					otherProp: 23,
					prop: propValueBeforeUpdate,
				},
			},
		))!;

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			linkType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				name: 'was built into',
				data: {
					inverseName: 'was built from',
					from: {
						id: linkedContract.id,
						slug: linkedContract.slug,
						type: linkedContract.type,
					},
					to: {
						id: testContract.id,
						slug: testContract.slug,
						type: testContract.type,
					},
				},
			},
		);

		await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			newType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: 'random change that should cause triggered action to run',
			},
			linkedContract,
			[{ op: 'replace', path: '/data/prop', value: magicNumber }],
		);

		await ctx.flushAll(ctx.session);

		const testContractAfterUpdate = await ctx.waitForMatch({
			type: 'object',
			additionalProperties: true,
			required: ['id'],
			properties: {
				id: {
					type: 'string',
					const: testContract.id,
				},
				data: {
					type: 'object',
					required: ['linkedProperty'],
					properties: {
						linkedProperty: {
							type: 'number',
							const: magicNumber,
						},
					},
				},
			},
		});

		expect(testContractAfterUpdate.data.linkedProperty).toEqual(magicNumber);
		expect(testContractAfterUpdate.data.dependentProperty).toEqual(
			'greater than 10!',
		);
	});
});
