import { strict as assert } from 'assert';
import { testUtils as autumndbTestUtils } from 'autumndb';
import _ from 'lodash';
import { testUtils } from '../../../lib';
import { actionIncrement } from '../../../lib/actions/action-increment';
import type { WorkerContext } from '../../../lib/types';

const handler = actionIncrement.handler;
let ctx: testUtils.TestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
	actionContext = ctx.worker.getActionContext({
		id: `test-${autumndbTestUtils.generateRandomId()}`,
	});
});

afterAll(async () => {
	return testUtils.destroyContext(ctx);
});

describe('action-increment', () => {
	test('should throw an error on invalid type', async () => {
		const contract = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'card@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{},
		);
		contract.type = 'foobar@1.0.0';

		await expect(
			handler(ctx.session, actionContext, contract, {
				context: {
					id: `TEST-${autumndbTestUtils.generateRandomId()}`,
				},
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				originator: autumndbTestUtils.generateRandomId(),
				arguments: {},
			} as any),
		).rejects.toThrow();
	});

	test('should increment specified path if number', async () => {
		const contract = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'card@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				count: 0,
			},
		);

		const request: any = {
			context: {
				id: `TEST-${autumndbTestUtils.generateRandomId()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.adminUserId,
			originator: autumndbTestUtils.generateRandomId(),
			arguments: {
				path: ['data', 'count'],
			},
		};

		expect.assertions(3);
		const result = await handler(ctx.session, actionContext, contract, request);
		if (!_.isNull(result) && !_.isArray(result)) {
			expect(result.id).toEqual(contract.id);
		}

		let updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			contract.id,
		);
		assert(updated);
		expect(updated.data.count).toEqual(1);

		await handler(ctx.session, actionContext, updated, request);
		updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			contract.id,
		);
		assert(updated);
		expect(updated.data.count).toEqual(2);
	});

	test('should increment specified path if string', async () => {
		const contract = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'card@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				count: 'foobar',
			},
		);

		const request: any = {
			context: {
				id: `TEST-${autumndbTestUtils.generateRandomId()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.adminUserId,
			originator: autumndbTestUtils.generateRandomId(),
			arguments: {
				path: ['data', 'count'],
			},
		};

		expect.assertions(3);
		const result = await handler(ctx.session, actionContext, contract, request);
		if (!_.isNull(result) && !_.isArray(result)) {
			expect(result.id).toEqual(contract.id);
		}

		let updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			contract.id,
		);
		assert(updated);
		expect(updated.data.count).toEqual(1);

		await handler(ctx.session, actionContext, updated, request);
		updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			contract.id,
		);
		assert(updated);
		expect(updated.data.count).toEqual(2);
	});
});
