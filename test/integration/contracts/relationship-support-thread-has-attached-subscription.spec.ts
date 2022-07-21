import { strict as assert } from 'assert';
import {
	AutumnDBSession,
	testUtils as autumndbTestUtils,
	UserContract,
} from 'autumndb';
import { testUtils } from '../../../lib';

let ctx: testUtils.TestContext;
let user: UserContract;
let session: AutumnDBSession;

beforeAll(async () => {
	ctx = await testUtils.newContext();

	user = await ctx.createUser(autumndbTestUtils.generateRandomId());
	session = { actor: user };
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

test('should allow a support thread to be linked to a subscription', async () => {
	const supportThread = await ctx.createSupportThread(
		user.id,
		session,
		'foobar',
		{
			status: 'open',
		},
	);

	const subscription = await ctx.createContract(
		user.id,
		session,
		'subscription@1.0.0',
		`Subscription to ${supportThread.slug}`,
		{},
	);
	await ctx.createLinkThroughWorker(
		user.id,
		session,
		supportThread,
		subscription,
		'has attached',
		'is attached to',
	);
});
