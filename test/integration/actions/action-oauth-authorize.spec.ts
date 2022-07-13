import { testUtils as autumndbTestUtils } from 'autumndb';
import { isEmpty, isString } from 'lodash';
import nock from 'nock';
import sinon from 'sinon';
import { testUtils, WorkerContext } from '../../../lib';
import { actionOAuthAuthorize } from '../../../lib/actions/action-oauth-authorize';
import { foobarPlugin } from './plugin';

const handler = actionOAuthAuthorize.handler;
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

beforeEach(() => {
	sinon.restore();
});

afterEach(() => {
	nock.cleanAll();
});

describe('action-oauth-authorize', () => {
	test('should return token string', async () => {
		const oauthProvider = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'oauth-provider@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				authorizeUrl: 'http://api.foobar.com/auth/foobar',
				tokenUrl: 'http://api.foobar.com/oauth/token',
				clientId: 'someclient',
				clientSecret: 'somesecret',
				integration: 'foobar',
			},
		);

		nock('http://api.foobar.com')
			.post('/oauth/token')
			.reply(200, autumndbTestUtils.generateRandomId());

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

		const result = await handler(ctx.session, actionContext, user, {
			context: {
				id: `TEST-${autumndbTestUtils.generateRandomId()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.adminUserId,
			originator: autumndbTestUtils.generateRandomId(),
			arguments: {
				provider: `${oauthProvider.slug}@${oauthProvider.version}`,
				code: autumndbTestUtils.generateRandomId(),
			},
		} as any);
		expect(isString(result)).toBe(true);
		expect(isEmpty(result)).toBe(false);
	});
});
