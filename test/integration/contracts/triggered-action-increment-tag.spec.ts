import { strict as assert } from 'assert';
import { testUtils as autumndbTestUtils, Contract } from 'autumndb';
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

async function waitForTag(tagName: string): Promise<Contract> {
	const match = ctx.waitForMatch({
		type: 'object',
		required: ['slug'],
		properties: {
			slug: {
				type: 'string',
				const: tagName,
			},
		},
	});
	assert(match);

	return match;
}

test('should sanely handle line breaks before tags in messages/whispers', async () => {
	const thread = await ctx.createContract(
		user.id,
		session.id,
		'thread@1.0.0',
		'foobar',
		{},
	);
	const tagName = autumndbTestUtils.generateRandomSlug({
		prefix: 'test-tag',
	});

	await ctx.createEvent(
		user.id,
		session.id,
		thread,
		`\n#${tagName}`,
		'whisper',
	);
	const tag = await waitForTag(`tag-${tagName}`);
	expect(tag).toEqual({
		created_at: tag.created_at,
		updated_at: tag.updated_at,
		version: '1.0.0',
		active: true,
		loop: null,
		markers: [],
		links: {},
		tags: [],
		requires: [],
		capabilities: [],
		data: {
			count: 1,
		},
		id: tag.id,
		linked_at: tag.linked_at,
		name: tagName,
		slug: tag.slug,
		type: tag.type,
	});
});

test('should sanely handle multiple tags in messages/whispers', async () => {
	const thread = await ctx.createContract(
		user.id,
		session.id,
		'thread@1.0.0',
		'foobar',
		{},
	);
	const tagName1 = autumndbTestUtils.generateRandomSlug({
		prefix: 'test-tag',
	});
	const tagName2 = autumndbTestUtils.generateRandomSlug({
		prefix: 'test-tag',
	});
	const tagName3 = autumndbTestUtils.generateRandomSlug({
		prefix: 'test-tag',
	});

	await ctx.createEvent(
		user.id,
		session.id,
		thread,
		`#${tagName1}\n#${tagName2}\n#${tagName3}`,
		'whisper',
	);
	const tag1 = await waitForTag(`tag-${tagName1}`);
	const tag2 = await waitForTag(`tag-${tagName2}`);
	const tag3 = await waitForTag(`tag-${tagName3}`);

	expect(tag1).toEqual({
		created_at: tag1.created_at,
		updated_at: tag1.updated_at,
		version: '1.0.0',
		active: true,
		loop: null,
		markers: [],
		links: {},
		tags: [],
		requires: [],
		capabilities: [],
		data: {
			count: 1,
		},
		id: tag1.id,
		linked_at: tag1.linked_at,
		name: tagName1,
		slug: tag1.slug,
		type: tag1.type,
	});

	expect(tag2).toEqual({
		created_at: tag2.created_at,
		updated_at: tag2.updated_at,
		version: '1.0.0',
		active: true,
		loop: null,
		markers: [],
		links: {},
		tags: [],
		requires: [],
		capabilities: [],
		data: {
			count: 1,
		},
		id: tag2.id,
		linked_at: tag2.linked_at,
		name: tagName2,
		slug: tag2.slug,
		type: tag2.type,
	});

	expect(tag3).toEqual({
		created_at: tag3.created_at,
		updated_at: tag3.updated_at,
		version: '1.0.0',
		active: true,
		loop: null,
		markers: [],
		links: {},
		tags: [],
		requires: [],
		capabilities: [],
		data: {
			count: 1,
		},
		id: tag3.id,
		linked_at: tag3.linked_at,
		name: tagName3,
		slug: tag3.slug,
		type: tag3.type,
	});
});

test('should create a new tag when one is found in a message', async () => {
	const thread = await ctx.createContract(
		user.id,
		session.id,
		'thread@1.0.0',
		'foobar',
		{},
	);
	const tagName = autumndbTestUtils.generateRandomSlug({
		prefix: 'test-tag',
	});

	await ctx.createEvent(user.id, session.id, thread, `#${tagName}`, 'whisper');
	const tag = await waitForTag(`tag-${tagName}`);
	expect(tag).toEqual({
		created_at: tag.created_at,
		updated_at: tag.updated_at,
		version: '1.0.0',
		active: true,
		loop: null,
		markers: [],
		links: {},
		tags: [],
		requires: [],
		capabilities: [],
		data: {
			count: 1,
		},
		id: tag.id,
		linked_at: tag.linked_at,
		name: tagName,
		slug: tag.slug,
		type: tag.type,
	});
});
