import { defaultEnvironment } from '@balena/jellyfish-environment';
import { testUtils as autumndbTestUtils } from 'autumndb';
import { isArray } from 'lodash';
import sinon from 'sinon';
import { testUtils, WorkerContext } from '../../../lib';
import { actionIntegrationImportEvent } from '../../../lib/actions/action-integration-import-event';
import { makeHandlerRequest } from './helpers';
import { foobarPlugin } from './plugin';

const source = 'foobar';
let supportThread: any;

const handler = actionIntegrationImportEvent.handler;
let ctx: testUtils.TestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await testUtils.newContext({
		plugins: [foobarPlugin()],
	});
	actionContext = ctx.worker.getActionContext({
		id: `test-${autumndbTestUtils.generateRandomId()}`,
	});

	supportThread = await ctx.createSupportThread(
		ctx.adminUserId,
		ctx.session,
		autumndbTestUtils.generateRandomSlug(),
		{
			status: 'open',
			source,
		},
	);
});

afterAll(async () => {
	return testUtils.destroyContext(ctx);
});

beforeEach(() => {
	sinon.restore();
});

describe('action-integration-import-event', () => {
	test('should return a list of cards', async () => {
		sinon.stub(defaultEnvironment, 'getIntegration').callsFake(() => {
			return {};
		});

		const result = await handler(
			ctx.session,
			actionContext,
			supportThread,
			makeHandlerRequest(ctx, actionIntegrationImportEvent.contract),
		);
		expect(isArray(result)).toBe(true);
		if (isArray(result)) {
			expect(Object.keys(result[0])).toEqual(['id', 'type', 'version', 'slug']);
		}
	});
});
