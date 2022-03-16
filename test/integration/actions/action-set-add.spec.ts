import { strict as assert } from 'assert';
import { testUtils as coreTestUtils } from 'autumndb';
import _ from 'lodash';
import { actionSetAdd } from '../../../lib/actions/action-set-add';
import { testUtils, WorkerContext } from '../../../lib';

const handler = actionSetAdd.handler;
let ctx: testUtils.TestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
	actionContext = ctx.worker.getActionContext({
		id: `test-${coreTestUtils.generateRandomId()}`,
	});
});

afterAll(async () => {
	return testUtils.destroyContext(ctx);
});

describe('action-set-add', () => {
	test('should add value to array when property path is an array', async () => {
		const foo = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'card@1.0.0',
			'foobar',
			{
				tags: [],
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
				property: ['data', 'tags'],
				value: 'foo',
			},
		};

		expect.assertions(2);
		const result = await handler(ctx.session, actionContext, foo, request);
		if (!_.isNull(result) && !_.isArray(result)) {
			expect(result.id).toEqual(foo.id);
		}

		const updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			foo.id,
		);
		assert(updated);
		expect(updated.data.tags).toEqual([request.arguments.value]);
	});

	test('should add an array of strings to an array', async () => {
		const foo = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'card@1.0.0',
			'fooobar',
			{
				tags: [],
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
				property: ['data', 'tags'],
				value: ['foo', 'bar'],
			},
		};

		expect.assertions(2);
		const result = await handler(ctx.session, actionContext, foo, request);
		if (!_.isNull(result) && !_.isArray(result)) {
			expect(result.id).toEqual(foo.id);
		}

		const updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			foo.id,
		);
		assert(updated);
		expect(updated.data.tags).toEqual(request.arguments.value);
	});

	test('should add value to array when property path is a string', async () => {
		const foo = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'card@1.0.0',
			'foobar',
			{
				tags: [],
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
				property: 'data.tags',
				value: 'foo',
			},
		};

		const result = await handler(ctx.session, actionContext, foo, request);
		if (!_.isNull(result) && !_.isArray(result)) {
			expect(result.id).toEqual(foo.id);
		}

		const updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			foo.id,
		);
		assert(updated);
		expect(updated.data.tags).toEqual([request.arguments.value]);
	});
});
