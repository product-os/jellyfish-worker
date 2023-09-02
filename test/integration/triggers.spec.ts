import { strict as assert } from 'assert';
import {
	Contract,
	Kernel,
	testUtils as autumndbTestUtils,
	TypeContract,
} from 'autumndb';
import _ from 'lodash';
import {
	errors,
	testUtils,
	TriggeredActionContract,
	TriggeredActionData,
	triggersLib as triggers,
} from '../../lib';

let ctx: testUtils.TestContext;
let typeContract: TypeContract;

beforeAll(async () => {
	ctx = await testUtils.newContext();

	const contract = (await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'card@latest',
	)) as TypeContract;

	assert(contract !== null);

	typeContract = contract;

	await ctx.kernel.insertContract(ctx.logContext, ctx.session, {
		slug: 'foo',
		type: 'type@1.0.0',
		name: 'The test foo contract',
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
	});

	await ctx.kernel.insertContract(ctx.logContext, ctx.session, {
		slug: 'bar',
		type: 'type@1.0.0',
		name: 'The test bar contract',
		data: {
			schema: {
				type: 'object',
				properties: {},
			},
		},
	});
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('.getRequest()', () => {
	it('should return null if the filter only has a type but there is no match', async () => {
		const trigger = Kernel.defaults<TriggeredActionData>({
			type: 'triggered-action@1.0.0',
			data: {
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
				card: typeContract.id,
				arguments: {
					properties: {
						slug: 'foo-bar-baz',
					},
				},
			},
		}) as TriggeredActionContract;

		const insertedContract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {},
			},
		);

		// TS-TODO: fix cast to any
		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedContract,
			{
				currentDate: new Date(),
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toBeFalsy();
	});

	it('should return a request if the filter only has a type and there is a match', async () => {
		const trigger = Kernel.defaults<TriggeredActionData>({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			type: 'triggered-action@1.0.0',
			data: {
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
				target: typeContract.id,
				arguments: {
					properties: {
						slug: 'foo-bar-baz',
					},
				},
			},
		}) as TriggeredActionContract;

		const date = new Date();

		const insertedContract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'foo@1.0.0',
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedContract,
			{
				currentDate: date,
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			currentDate: date,
			card: typeContract.id,
			logContext: ctx.logContext,
			originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			arguments: {
				properties: {
					slug: 'foo-bar-baz',
				},
			},
		});
	});

	it('should return a request if the filter use type.not and there is a match', async () => {
		const trigger = Kernel.defaults<TriggeredActionData>({
			type: 'triggered-action@1.0.0',
			data: {
				mode: 'insert',
				filter: {
					type: 'object',
					required: ['type'],
					properties: {
						type: {
							not: {
								type: 'string',
								const: 'foo@1.0.0',
							},
						},
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeContract.id,
				arguments: {
					properties: {
						slug: 'foo-bar-baz',
					},
				},
			},
		}) as TriggeredActionContract;

		const date = new Date();

		const insertedContract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'bar@1.0.0',
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedContract,
			{
				currentDate: date,
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			currentDate: date,
			card: typeContract.id,
			logContext: ctx.logContext,
			originator: trigger.id,
			arguments: {
				properties: {
					slug: 'foo-bar-baz',
				},
			},
		});
	});

	it('should return a request if the filter use type.not and there is a match via link', async () => {
		const trigger = Kernel.defaults<TriggeredActionData>({
			type: 'triggered-action@1.0.0',
			data: {
				mode: 'insert',
				filter: {
					type: 'object',
					required: ['type'],
					properties: {
						type: {
							not: {
								type: 'string',
								const: 'foo@1.0.0',
							},
						},
					},
					$$links: {
						'is attached to': {
							type: 'object',
							properties: {
								type: {
									const: 'contact@1.0.0',
								},
							},
						},
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeContract.id,
				arguments: {
					properties: {
						slug: 'foo-bar-baz',
					},
				},
			},
		}) as TriggeredActionContract;

		const date = new Date();

		const insertedContract1 = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'contact@1.0.0',
				version: '1.0.0',
			},
		);
		const insertedContract2 = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'create@1.0.0',
				data: {
					actor: ctx.adminUserId,
					target: insertedContract1.id,
					timestamp: new Date().toISOString(),
				},
			},
		);

		const linkContract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'link@1.0.0',
				name: 'has attached element',
				data: {
					inverseName: 'is attached to',
					from: {
						type: insertedContract1.type,
						id: insertedContract1.id,
					},
					to: {
						type: insertedContract2.type,
						id: insertedContract2.id,
					},
				},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			linkContract,
			{
				currentDate: date,
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			currentDate: date,
			card: typeContract.id,
			logContext: ctx.logContext,
			originator: trigger.id,
			arguments: {
				properties: {
					slug: 'foo-bar-baz',
				},
			},
		});
	});

	it('should return null if there is no relevant from the old contract state', async () => {
		const trigger = Kernel.defaults<TriggeredActionData>({
			type: 'triggered-action@1.0.0',
			data: {
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
				card: typeContract.id,
				arguments: {
					properties: {
						slug: 'foo-bar-baz',
					},
				},
			},
		}) as TriggeredActionContract;

		const insertedContract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {},
			},
		);
		const oldContract = _.cloneDeep(insertedContract);
		oldContract.data.randomField = 42;

		// TS-TODO: fix cast to any
		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			oldContract,
			insertedContract,
			{
				currentDate: new Date(),
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toBeFalsy();
	});

	it('should return a request if a relevant field did change', async () => {
		const trigger = Kernel.defaults<TriggeredActionData>({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			type: 'triggered-action@1.0.0',
			data: {
				mode: 'insert',
				filter: {
					type: 'object',
					required: ['type'],
					properties: {
						type: {
							type: 'string',
							const: 'foo@1.0.0',
						},
						name: {
							type: 'string',
							pattern: 'x',
						},
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeContract.id,
				arguments: {
					properties: {
						slug: 'foo-bar-baz',
					},
				},
			},
		}) as TriggeredActionContract;

		const date = new Date();

		const insertedContract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				name: 'x2',
				type: 'foo@1.0.0',
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {},
			},
		);
		const oldContract = _.cloneDeep(insertedContract);
		oldContract.name = 'x1';

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			oldContract,
			insertedContract,
			{
				currentDate: date,
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			currentDate: date,
			card: typeContract.id,
			logContext: ctx.logContext,
			originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			arguments: {
				properties: {
					slug: 'foo-bar-baz',
				},
			},
		});
	});

	it('should return a request given a complex matching filter', async () => {
		const trigger = Kernel.defaults<TriggeredActionData>({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			type: 'triggered-action@1.0.0',
			data: {
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
				target: typeContract.id,
				arguments: {
					properties: {
						slug: 'foo-bar-baz',
					},
				},
			},
		}) as TriggeredActionContract;

		const date = new Date();

		const insertedContract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'foo@1.0.0',
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomId(),
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
			ctx.kernel,
			trigger,
			null,
			insertedContract,
			{
				currentDate: date,
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			currentDate: date,
			card: typeContract.id,
			logContext: ctx.logContext,
			originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			arguments: {
				properties: {
					slug: 'foo-bar-baz',
				},
			},
		});
	});

	it('should return null given a complex non-matching filter', async () => {
		const trigger = Kernel.defaults<TriggeredActionData>({
			type: 'triggered-action@1.0.0',
			data: {
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
				target: typeContract.id,
				arguments: {
					properties: {
						slug: 'foo-bar-baz',
					},
				},
			},
		}) as TriggeredActionContract;

		const insertedContract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'foo@1.0.0',
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					foo: '4',
				},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedContract,
			{
				currentDate: new Date(),
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toBeFalsy();
	});

	it('should parse source templates in the triggered action arguments', async () => {
		const trigger = Kernel.defaults<TriggeredActionData>({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			type: 'triggered-action@1.0.0',
			data: {
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
				target: typeContract.id,
				arguments: {
					properties: {
						slug: {
							$eval: 'source.data.slug',
						},
						data: {
							bar: {
								$eval: 'source.data.bar',
							},
						},
					},
				},
			},
		}) as TriggeredActionContract;

		const date = new Date();

		const insertedContract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					command: 'foo-bar-baz',
					slug: 'hello-world',
					bar: 6,
				},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedContract,
			{
				currentDate: date,
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			card: typeContract.id,
			logContext: ctx.logContext,
			originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			currentDate: date,
			arguments: {
				properties: {
					slug: 'hello-world',
					data: {
						bar: 6,
					},
				},
			},
		});
	});

	it('should return the request if the mode matches on update', async () => {
		const trigger = Kernel.defaults<TriggeredActionData>({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
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
									const: 'foo-bar-baz',
								},
							},
						},
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeContract.id,
				mode: 'update',
				arguments: {
					properties: {
						slug: {
							$eval: 'source.data.slug',
						},
						data: {
							bar: {
								$eval: 'source.data.bar',
							},
						},
					},
				},
			},
		}) as TriggeredActionContract;

		const date = new Date();

		const insertedContract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					command: 'foo-bar-baz',
					slug: 'hello-world',
					bar: 6,
				},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedContract,
			{
				currentDate: date,
				logContext: ctx.logContext,
				session: ctx.session,
				mode: 'update',
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			card: typeContract.id,
			logContext: ctx.logContext,
			originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			currentDate: date,
			arguments: {
				properties: {
					slug: 'hello-world',
					data: {
						bar: 6,
					},
				},
			},
		});
	});

	it('should return the request if the mode matches on insert', async () => {
		const trigger = Kernel.defaults<TriggeredActionData>({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
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
									const: 'foo-bar-baz',
								},
							},
						},
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeContract.id,
				mode: 'insert',
				arguments: {
					properties: {
						slug: {
							$eval: 'source.data.slug',
						},
						data: {
							bar: {
								$eval: 'source.data.bar',
							},
						},
					},
				},
			},
		}) as TriggeredActionContract;

		const date = new Date();

		const insertedContract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomId(),
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					command: 'foo-bar-baz',
					slug: 'hello-world',
					bar: 6,
				},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedContract,
			{
				currentDate: date,
				logContext: ctx.logContext,
				session: ctx.session,
				mode: 'insert',
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			card: typeContract.id,
			logContext: ctx.logContext,
			originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			currentDate: date,
			arguments: {
				properties: {
					slug: 'hello-world',
					data: {
						bar: 6,
					},
				},
			},
		});
	});

	it('should return null if the mode does not match', async () => {
		const trigger = Kernel.defaults<TriggeredActionData>({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
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
									const: 'foo-bar-baz',
								},
							},
						},
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeContract.id,
				mode: 'update',
				arguments: {
					properties: {
						slug: {
							$eval: 'source.data.slug',
						},
						data: {
							bar: {
								$eval: 'source.data.bar',
							},
						},
					},
				},
			},
		}) as TriggeredActionContract;

		const date = new Date();

		const insertedContract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				slug: autumndbTestUtils.generateRandomId(),
				type: 'card@1.0.0',
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					command: 'foo-bar-baz',
					slug: 'hello-world',
					bar: 6,
				},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedContract,
			{
				currentDate: date,
				logContext: ctx.logContext,
				session: ctx.session,
				mode: 'insert',
			},
		);

		expect(request).toBe(null);
	});

	it('should parse timestamp templates in the triggered action arguments', async () => {
		const trigger = Kernel.defaults<TriggeredActionData>({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			type: 'triggered-action@1.0.0',
			data: {
				mode: 'insert',
				filter: {
					type: 'object',
					required: ['type'],
					properties: {
						type: { const: 'card@1.0.0' },
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeContract.id,
				arguments: {
					properties: {
						data: {
							timestamp: {
								$eval: 'timestamp',
							},
						},
					},
				},
			},
		}) as TriggeredActionContract;

		const currentDate = new Date();

		const insertedContract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				slug: autumndbTestUtils.generateRandomId(),
				type: 'card@1.0.0',
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				data: {
					command: 'foo-bar-baz',
					slug: 'hello-world',
					bar: 6,
				},
			},
		);

		const request = await triggers.getRequest(
			ctx.kernel,
			trigger,
			null,
			insertedContract,
			{
				currentDate,
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toEqual({
			action: 'action-create-card@1.0.0',
			currentDate,
			card: typeContract.id,
			logContext: ctx.logContext,
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
		const trigger = Kernel.defaults<TriggeredActionData>({
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			slug: 'triggered-action-cb3523c5',
			type: 'triggered-action@1.0.0',
			data: {
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
				target: typeContract.id,
				arguments: {
					properties: {
						slug: {
							$eval: 'source.data.slug',
						},
						data: {
							bar: {
								$eval: 'source.data.bar',
							},
						},
					},
				},
			},
		}) as TriggeredActionContract;

		const insertedContract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				slug: autumndbTestUtils.generateRandomSlug(),
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
			ctx.kernel,
			trigger,
			null,
			insertedContract,
			{
				currentDate: new Date(),
				mode: 'insert',
				logContext: ctx.logContext,
				session: ctx.session,
			},
		);

		expect(request).toBeFalsy();
	});
});

describe('.getTypeTriggers()', () => {
	it('should return a trigger contract with a matching type', async () => {
		const contracts = [
			{
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
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

		const updatedContract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			insertedContracts[0].id,
		);

		const result = await triggers.getTypeTriggers(
			ctx.logContext,
			ctx.kernel,
			ctx.session,
			'foo@1.0.0',
		);

		expect(result).toEqual([
			Object.assign({}, updatedContract, {
				id: result[0].id,
			}),
		]);
	});

	it('should not return inactive contracts', async () => {
		const typeSlug = autumndbTestUtils.generateRandomSlug();
		const contracts = [
			{
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
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

		for (const contract of contracts) {
			await ctx.kernel.insertContract(
				ctx.logContext,
				ctx.session,
				contract as Contract,
			);
		}

		const result = await triggers.getTypeTriggers(
			ctx.logContext,
			ctx.kernel,
			ctx.session,
			`${typeSlug}@1.0.0`,
		);

		expect(result).toEqual([]);
	});

	it('should ignore non-matching contracts', async () => {
		const typeSlug = autumndbTestUtils.generateRandomSlug();
		const contracts = [
			{
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
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

		const result = await triggers.getTypeTriggers(
			ctx.logContext,
			ctx.kernel,
			ctx.session,
			`${typeSlug}@1.0.0`,
		);

		const updatedContract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			insertedContracts[0].id,
		);

		expect(result).toEqual([
			Object.assign({}, updatedContract, {
				id: result[0].id,
			}),
		]);
	});

	it('should ignore contracts that are not triggered actions', async () => {
		const typeSlug = autumndbTestUtils.generateRandomSlug();
		const contracts = [
			{
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
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
				type: 'card@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
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

		const result = await triggers.getTypeTriggers(
			ctx.logContext,
			ctx.kernel,
			ctx.session,
			`${typeSlug}@1.0.0`,
		);

		const updatedContract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			insertedContracts[0].id,
		);

		expect(result).toEqual([
			Object.assign({}, updatedContract, {
				id: result[0].id,
			}),
		]);
	});

	it('should not return triggered actions not associated with a type', async () => {
		const contracts = [
			{
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: {
								$eval: 'source.data.slug',
							},
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

		for (const contract of contracts) {
			await ctx.kernel.insertContract(
				ctx.logContext,
				ctx.session,
				contract as Contract,
			);
		}

		const result = await triggers.getTypeTriggers(
			ctx.logContext,
			ctx.kernel,
			ctx.session,
			`${autumndbTestUtils.generateRandomSlug()}@1.0.0`,
		);
		expect(result).toEqual([]);
	});
});

describe('.getStartDate()', () => {
	it('should return epoch if the trigger has no start date', async () => {
		// TS-TODO: remove the cast to "any"
		const result = triggers.getStartDate(
			Kernel.defaults<TriggeredActionData>({
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
		);

		expect(result.getTime()).toBe(0);
	});

	it('should return epoch if the trigger has an invalid date', async () => {
		// TS-TODO: remove the cast to "any"
		const result = triggers.getStartDate(
			Kernel.defaults<TriggeredActionData>({
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
		);

		expect(result.getTime()).toBe(0);
	});

	it('should return the specified date if valid', async () => {
		const date = new Date();
		// TS-TODO: Remove the cast to "any"
		const result = triggers.getStartDate(
			Kernel.defaults<TriggeredActionData>({
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
		);

		expect(result.getTime()).toBe(date.getTime());
	});
});

describe('.getNextExecutionDate()', () => {
	it('should return null if no interval', async () => {
		const date = new Date();

		// TS-TODO: fix the cast to any here
		const result = triggers.getNextExecutionDate(
			Kernel.defaults<TriggeredActionData>({
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
			date,
		);

		expect(result).toEqual(null);
	});

	it('should return epoch if no last execution date', async () => {
		// TS-TODO: fix the cast to any here
		const result = triggers.getNextExecutionDate(
			Kernel.defaults<TriggeredActionData>({
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
		);

		expect(result!.getTime()).toBe(0);
	});

	it('should return epoch if last execution date is not a valid date', async () => {
		// TS-TODO: Remove cast to any
		const result = triggers.getNextExecutionDate(
			Kernel.defaults<TriggeredActionData>({
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
			new Date('foobar'),
		);

		expect(result!.getTime()).toBe(0);
	});

	it('should return epoch if last execution date is not a date', async () => {
		// TS-TODO: fix cast
		const result = triggers.getNextExecutionDate(
			Kernel.defaults<TriggeredActionData>({
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
			'foobar' as any,
		);

		expect(result!.getTime()).toBe(0);
	});

	it('should throw if the interval is invalid', async () => {
		const date = new Date();

		expect(() => {
			// TS-TODO: fix cast
			triggers.getNextExecutionDate(
				Kernel.defaults<TriggeredActionData>({
					type: 'triggered-action@1.0.0',
					slug: autumndbTestUtils.generateRandomSlug({
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
						target: typeContract.id,
						arguments: {
							properties: {
								slug: 'foo',
							},
						},
					},
				}) as TriggeredActionContract,
				date,
			);
		}).toThrow(errors.WorkerInvalidDuration);
	});

	it('should return the next interval after the last execution', async () => {
		// TS-TODO: fix cast
		const result = triggers.getNextExecutionDate(
			Kernel.defaults<TriggeredActionData>({
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
			new Date('2018-01-01T05:30:00.000Z'),
		);

		expect(result!.toISOString()).toBe('2018-01-01T06:00:00.000Z');
	});

	it('should return the start date if the last execution happened way before the start date', async () => {
		// TS-TODO: fix cast to any
		const result = triggers.getNextExecutionDate(
			Kernel.defaults<TriggeredActionData>({
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
			new Date('2018-01-01T01:00:00.000Z'),
		);

		expect(result!.toISOString()).toBe('2018-01-01T05:00:00.000Z');
	});

	it('should return the subsequent interval if the last execution happened just before the start date', async () => {
		// TS-TODO: fix cast to any
		const result = triggers.getNextExecutionDate(
			Kernel.defaults<TriggeredActionData>({
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
			new Date('2018-01-01T04:50:00.000Z'),
		);

		expect(result!.toISOString()).toBe('2018-01-01T06:00:00.000Z');
	});

	it('should return the next interval if the last execution is the start date', async () => {
		// TS-TODO: Fix cast to any
		const result = triggers.getNextExecutionDate(
			Kernel.defaults<TriggeredActionData>({
				type: 'triggered-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
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
					target: typeContract.id,
					arguments: {
						properties: {
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
			new Date('2018-01-01T05:00:00.000Z'),
		);

		expect(result!.toISOString()).toBe('2018-01-01T06:00:00.000Z');
	});
});
