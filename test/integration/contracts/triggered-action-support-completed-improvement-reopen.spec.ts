import { testUtils as autumndbTestUtils } from 'autumndb';
import { testUtils } from '../../../lib';

let ctx: testUtils.TestContext;
let user: any = {};
let session: any = {};

beforeAll(async () => {
	ctx = await testUtils.newContext();
	user = await ctx.createUser(autumndbTestUtils.generateRandomId());
	session = await ctx.createSession(user);
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

test('should re-open a closed support thread if an improvement attached to an attached pattern is completed', async () => {
	const supportThread = await ctx.createSupportThread(
		user.id,
		session.id,
		'foobar',
		{
			status: 'closed',
		},
	);
	const pattern = await ctx.createContract(
		user.id,
		session.id,
		'pattern@1.0.0',
		'My pattern',
		{
			status: 'open',
		},
	);
	await ctx.createLinkThroughWorker(
		user.id,
		session.id,
		supportThread,
		pattern,
		'has attached',
		'is attached to',
	);
	const improvement = await ctx.createContract(
		user.id,
		session.id,
		'improvement@1.0.0',
		'My improvement',
		{
			status: 'proposed',
		},
	);
	await ctx.createLinkThroughWorker(
		user.id,
		session.id,
		pattern,
		improvement,
		'has attached',
		'is attached to',
	);

	// Complete the improvement, and then wait for the support thread to be re-opened
	await ctx.worker.patchCard(
		ctx.logContext,
		session.id,
		ctx.worker.typeContracts[improvement.type],
		{
			attachEvents: true,
			actor: user.id,
		},
		improvement,
		[
			{
				op: 'replace',
				path: '/data/status',
				value: 'completed',
			},
		],
	);
	await ctx.flushAll(session.id);

	await ctx.waitForMatch({
		type: 'object',
		required: ['id', 'data'],
		properties: {
			id: {
				const: supportThread.id,
			},
			data: {
				type: 'object',
				required: ['status'],
				properties: {
					status: {
						const: 'open',
					},
				},
			},
		},
	});
});
