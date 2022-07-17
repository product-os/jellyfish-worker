import { strict as assert } from 'assert';
import { testUtils as autumndbTestUtils } from 'autumndb';
import { pick } from 'lodash';
import { testUtils } from '../../../lib';
import { actionIncrementTag } from '../../../lib/actions/action-increment-tag';
import type { ActionRequestContract, WorkerContext } from '../../../lib/types';

const handler = actionIncrementTag.handler;
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

describe('action-increment-tag', () => {
	test('should increment a tag', async () => {
		const tag = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'tag@1.0.0',
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
				name: tag.slug.replace(/^tag-/, ''),
			},
		};

		const result = await handler(ctx.session, actionContext, tag, request);
		expect(result).toEqual([pick(tag, ['id', 'type', 'version', 'slug'])]);

		let updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			tag.id,
		);
		assert(updated);
		expect(updated.data.count).toEqual(1);

		await handler(ctx.session, actionContext, tag, request);
		updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			tag.id,
		);
		assert(updated);
		expect(updated.data.count).toEqual(2);
	});

	test('should create a new tag if one does not exist', async () => {
		const name = `tag-${autumndbTestUtils.generateRandomId()}`;
		const typeContract = ctx.worker.typeContracts['tag@1.0.0'];
		const actionRequest = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{
				attachEvents: false,
				timestamp: new Date().toISOString(),
			},
			{
				type: 'action-request@1.0.0',
				data: {
					action: 'action-increment-tag@1.0.0',
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
						name,
					},
				},
			},
		);
		assert(actionRequest);

		await ctx.flushAll(ctx.session);
		const result = await ctx.worker.producer.waitResults(
			ctx.logContext,
			actionRequest as ActionRequestContract,
		);
		expect(result.error).toBe(false);

		const tagContract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			(result as any).data[0].id,
		);
		assert(tagContract);
		expect(tagContract.type).toBe('tag@1.0.0');
		expect(tagContract.name).toBe(name);
		expect(tagContract.data.count).toBe(1);
	});
});
