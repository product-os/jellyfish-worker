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

test('should close a thread with a #summary whisper', async () => {
	const supportThread = await ctx.createSupportThread(
		user.id,
		session.id,
		'foobar',
		{
			status: 'open',
		},
	);
	await ctx.createWhisper(user.id, session.id, supportThread, '#summary buz');

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
						const: 'closed',
					},
				},
			},
		},
	});
});
