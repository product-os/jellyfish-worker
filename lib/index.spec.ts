import type { Kernel } from 'autumndb';
import type { Pool } from 'pg';
import { Worker } from './index';
import { TransformerContract } from './types';

function makeTransformer(
	id: string,
	slug: string,
	version: string,
): TransformerContract {
	return {
		id,
		slug,
		type: 'transformer@1.0.0',
		version,
		active: true,
		data: {
			inputFilter: {},
			workerFilter: {},
			requirements: {},
		},
		created_at: new Date().toISOString(),
		tags: [],
		capabilities: [],
		requires: [],
		markers: [],
	};
}

describe('Worker.updateCurrentTransformers()', () => {
	test('should generate properly filtered list of transformers', async () => {
		const transformers: TransformerContract[] = [
			makeTransformer('a1.0.0', 'a-transformer', '1.0.0'),
			makeTransformer('a1.1.0', 'a-transformer', '1.1.0'),
			makeTransformer('a1.1.0', 'a-transformer', '1.1.1-someprerelease'),
			makeTransformer('a2.0.0', 'a-transformer', '2.0.0'),
			makeTransformer('b1.0.0', 'b-transformer', '1.0.0'),
			makeTransformer('b0.0.1', 'b-transformer', '0.0.1'),
		];

		// TS-TODO: is there a better way to instantiate a simple Worker?
		const worker = new Worker(
			{} as any as Kernel,
			'session-foo',
			{} as any as Pool,
			[],
		);
		worker.transformers = transformers;
		worker.updateLatestTransformers();
		const currentTransformers = worker.getLatestTransformers();

		expect(currentTransformers.length).toBe(3);
		expect(
			currentTransformers.some((tf) => {
				return tf.id === 'a1.1.0';
			}),
		).toBe(true);
		expect(
			currentTransformers.some((tf) => {
				return tf.id === 'a2.0.0';
			}),
		).toBe(true);
		expect(
			currentTransformers.some((tf) => {
				return tf.id === 'b1.0.0';
			}),
		).toBe(true);
	});
});
