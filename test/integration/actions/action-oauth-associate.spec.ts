import { testUtils as autumndbTestUtils } from 'autumndb';
import { isArray, isNull } from 'lodash';
import { testUtils, WorkerContext } from '../../../lib';
import { actionOAuthAssociate } from '../../../lib/actions/action-oauth-associate';
import { foobarPlugin } from './plugin';

const handler = actionOAuthAssociate.handler;
let ctx: testUtils.TestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await testUtils.newContext({
		plugins: [foobarPlugin()],
	});
	actionContext = ctx.worker.getActionContext({
		id: `test-${autumndbTestUtils.generateRandomId()}`,
	});
});

afterAll(async () => {
	return testUtils.destroyContext(ctx);
});

describe('action-oauth-associate', () => {
	test('should return single user card', async () => {
		const user = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'user@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				hash: autumndbTestUtils.generateRandomId(),
				roles: [],
			},
		);

		const result: any = await handler(ctx.session, actionContext, user, {
			logContext: {
				id: `TEST-${autumndbTestUtils.generateRandomId()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.adminUserId,
			originator: autumndbTestUtils.generateRandomId(),
			arguments: {
				provider: 'foobar',
			},
		} as any);
		expect(isNull(result)).toBe(false);
		expect(isArray(result)).toBe(false);
		expect(result.type).toEqual('user@1.0.0');
	});
});
