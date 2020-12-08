/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const ava = require('ava')
const sinon = require('sinon')
const jsonpatch = require('fast-json-patch')
const _ = require('lodash')
const uuid = require('@balena/jellyfish-uuid')
const executor = require('../executor')
const user = require('./fixtures/user.json')
const user1 = require('./fixtures/user1.json')

const privilegedSession = {}

const getContext = async () => {
	const id = await uuid.random()
	return {
		id,
		privilegedSession
	}
}

const session = {}

const sandbox = sinon.createSandbox()

ava.beforeEach(async (test) => {
	const oldUser = _.merge({}, user1, {
		data: {
			email: 'old@balena.io'
		}
	})
	const context = await getContext()
	test.context = {
		...test.context,
		oldUser,
		context,
		jellyfish: {
			getCardById: sandbox.stub().resolves(oldUser),
			getCardBySlug: sandbox.stub().resolves(oldUser)
		},
		commonOptions: {}
	}
})

ava.afterEach(() => {
	sandbox.restore()
})

ava('insertCard updates $$formula fields before inserting', async (test) => {
	const {
		context,
		jellyfish,
		commonOptions
	} = test.context
	const options = {
		...commonOptions,
		attachEvents: false
	}
	const expectedInsertedCard = _.merge({}, user1, {
		data: {
			profile: {
				name: {
					fullName: 'John Doe',
					initials: 'JD'
				}
			}
		}
	})
	jellyfish.insertCard = (ctx, sess, res) => {
		return res
	}

	const insertedCard = await executor.insertCard(context, jellyfish, session, user, options, user1)
	test.deepEqual(insertedCard, expectedInsertedCard)
})

ava('replaceCard updates $$formula fields before replacing', async (test) => {
	const {
		context,
		jellyfish,
		commonOptions
	} = test.context
	const options = {
		...commonOptions,
		attachEvents: false
	}
	const expectedReplacedCard = _.merge({}, user1, {
		data: {
			profile: {
				name: {
					fullName: 'John Doe',
					initials: 'JD'
				}
			}
		}
	})
	jellyfish.replaceCard = (ctx, sess, res) => {
		return res
	}

	const replacedCard = await executor.replaceCard(context, jellyfish, session, user, options, user1)
	test.deepEqual(replacedCard, expectedReplacedCard)
})

ava('patchCard updates $$formula fields before patching', async (test) => {
	const {
		context,
		jellyfish,
		commonOptions
	} = test.context
	const patchOptions = {
		...commonOptions,
		attachEvents: false
	}
	jellyfish.getCardBySlug = sandbox.stub().resolves(user1)
	const userPatch = [
		{
			op: 'replace',
			path: '/data/profile/name/first',
			value: 'Bob'
		}
	]
	const expectedPatchedCard = _.merge({}, user1, {
		data: {
			profile: {
				name: {
					first: 'Bob',
					fullName: 'Bob Doe',
					initials: 'BD'
				}
			}
		}
	})
	jellyfish.patchCardBySlug = (ctx, sess, version, patch, options) => {
		return jsonpatch.applyPatch(user1, patch, false, false).newDocument
	}

	const patchedCard = await executor.patchCard(context, jellyfish, session, user, patchOptions, user1, userPatch)
	test.deepEqual(patchedCard, expectedPatchedCard)
})
