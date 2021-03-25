/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const ava = require('ava')
const {
	Worker
} = require('./index')

ava('Worker: updateCurrentTransformers() should generate properly filtered list of transformers', async (test) => {
	const transformers = [
		{
			id: 'a1.0.0',
			slug: 'a-transformer',
			version: '1.0.0'
		},
		{
			id: 'a1.1.0',
			slug: 'a-transformer',
			version: '1.1.0'
		},
		{
			id: 'a1.1.0',
			slug: 'a-transformer',
			version: '1.1.1-someprerelease'
		},
		{
			id: 'a2.0.0',
			slug: 'a-transformer',
			version: '2.0.0'
		},
		{
			id: 'b1.0.0',
			slug: 'b-transformer',
			version: '1.0.0'
		}
	]

	const worker = new Worker()
	worker.transformers = transformers
	worker.updateLatestTransformers()
	const currentTransformers = worker.getLatestTransformers()

	test.is(currentTransformers.length, 3)
	test.true(currentTransformers.some((tf) => {
		return tf.id === 'a1.1.0'
	}))
	test.true(currentTransformers.some((tf) => {
		return tf.id === 'a2.0.0'
	}))
	test.true(currentTransformers.some((tf) => {
		return tf.id === 'b1.0.0'
	}))
})
