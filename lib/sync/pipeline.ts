import * as assert from '@balena/jellyfish-assert';
import type { Contract } from '@balena/jellyfish-types/build/core';
import Bluebird from 'bluebird';
import jsone from 'json-e';
import _ from 'lodash';
import * as errors from './errors';
import * as instance from './instance';
import type {
	Integration,
	IntegrationDefinition,
	PipelineOpts,
	SequenceItem,
} from './types';

const runIntegration = async (
	integration: IntegrationDefinition,
	options: PipelineOpts,
	fn: 'translate' | 'mirror',
	contract: Contract,
): Promise<Contract[]> => {
	return instance.run(
		integration,
		options.token,
		async (integrationInstance: Integration) => {
			const sequence = await integrationInstance[fn](contract, {
				actor: options.actor,
			});

			options.context.log.debug('Processing pipeline sequence', {
				type: fn,
				sequence,
			});

			return importCards(options.context, sequence, {
				origin: contract,
			});
		},
		{
			actor: options.actor,
			origin: options.origin,
			defaultUser: options.defaultUser,
			provider: options.provider,
			context: options.context,
		},
	);
};

/**
 * @summary Evaluate an object template
 * @function
 * @private
 *
 * @param object - object
 * @param environment - evaluation context
 * @returns evaluated object
 *
 * @example
 * const result = evaluateObject({
 *   foo: {
 *     $eval: 'hello',
 *   }
 * }, {
 *   hello: 1,
 * });
 *
 * console.log(result);
 * > {
 * >   foo: 1
 * > }
 */
const evaluateObject = (object: any, environment: any) => {
	if (!object) {
		return object;
	}

	if (object.$eval) {
		try {
			return jsone(object, environment);
		} catch (error: any) {
			if (error.name === 'InterpreterError') {
				return null;
			}

			throw error;
		}
	}

	for (const key of Object.keys(object)) {
		// For performance reasons
		// eslint-disable-next-line lodash/prefer-lodash-typecheck
		if (typeof object[key] !== 'object' || object[key] === null) {
			continue;
		}

		const result = evaluateObject(object[key], environment);
		if (!result) {
			return null;
		}

		object[key] = result;
	}

	return object;
};

/**
 * @summary Import a sequence of contracts
 * @function
 * @public
 *
 * @param context - worker execution context
 * @param sequence - card sequence
 * @param options - options object
 * @param options.origin - origin id
 * @returns inserted cards
 *
 * @example
 * const result = await pipeline.importCards({ ... }, [
 *   {
 *     time: new Date(),
 *     card: { ... },
 *   },
 *   {
 *     time: new Date(),
 *     card: { ... },
 *   },
 *   {
 *     time: new Date(),
 *     card: { ... },
 *   },
 * ], {
 *   origin: 'e9b74e2a-3553-4188-8ab8-a67e92aedbe2',
 * });
 */
export const importCards = async (
	context: PipelineOpts['context'],
	sequence: Array<SequenceItem | SequenceItem[]>,
	options: any = {},
) => {
	// TODO: AFAICT the references option is never provided and can probably be removed
	const references = options.references || {};
	const insertedContracts: Contract[] = [];

	for (const [index, value] of sequence.entries()) {
		const step = _.castArray(value);
		await Bluebird.map(
			step,
			async (segment, subindex, length) => {
				const path = ['cards', index];
				if (length !== 1) {
					path.push(subindex);
				}

				let object = {};
				let finalObject: Partial<Contract> = {};
				const type = segment.card.type;

				// Check if this is a JSONpatch or a slug-based upsert
				if ('patch' in segment.card) {
					// If the patch doesn't update the origin, add it now
					if (
						!_.find(segment.card.patch, {
							path: '/data/origin',
						})
					) {
						if (
							options.origin &&
							options.origin.type === 'external-event@1.0.0'
						) {
							segment.card.patch.push({
								op: 'add',
								path: '/data/origin',
								value: `${options.origin.slug}@${options.origin.version}`,
							});
						}
					}
					finalObject = evaluateObject(
						_.omit(segment.card, ['links']),
						references,
					);
				} else {
					object = evaluateObject(_.omit(segment.card, ['links']), references);
					assert.INTERNAL(context, !!object, errors.SyncInvalidTemplate, () => {
						return `Could not evaluate template in: ${JSON.stringify(
							segment.card,
							null,
							2,
						)}`;
					});

					finalObject = Object.assign(
						{
							active: true,
							version: '1.0.0',
							tags: [],
							markers: [],
							links: {},
							requires: [],
							capabilities: [],
							data: {},
						},
						object,
					);

					if (
						options.origin &&
						options.origin.type === 'external-event@1.0.0' &&
						!segment.skipOriginator
					) {
						finalObject.data!.origin = `${options.origin.slug}@${options.origin.version}`;
					}
				}

				assert.INTERNAL(context, !!segment.actor, errors.SyncNoActor, () => {
					return `No actor in segment: ${JSON.stringify(segment)}`;
				});

				const result = await context.upsertElement(type, finalObject, {
					timestamp: segment.time,
					actor: segment.actor,
					originator: segment.skipOriginator
						? null
						: _.get(options, ['origin', 'id']),
				});

				if (result) {
					insertedContracts.push(result);
				}

				_.set(references, path, result);
			},
			{
				concurrency: 3,
			},
		);
	}

	return insertedContracts;
};

/**
 * @summary Translate an external event
 * @function
 * @public
 *
 * @param integration - integration class
 * @param externalEvent - external event contract
 * @param options - options
 * @param options.context - execution context
 * @returns inserted contracts
 *
 * @example
 * const contracts = await pipeline.translateExternalEvent(MyIntegration, {
 *   type: 'external-event',
 *   ...
 * }, {
 *   context: { ... },
 * });
 */
export const translateExternalEvent = async (
	integration: IntegrationDefinition,
	externalEvent: Contract,
	options: PipelineOpts,
) => {
	return runIntegration(integration, options, 'translate', externalEvent);
};

/**
 * @summary Mirror a contract back
 * @function
 * @public
 *
 * @param integration - integration class
 * @param contract - local contract
 * @param options - options object
 * @param options.context - execution context
 * @param options.actor - actor id
 * @returns inserted contracts
 *
 * @example
 * const contracts = await pipeline.mirrorCard(MyIntegration, {
 *   type: 'card',
 *   ...
 * }, {
 *   context: { ... },
 *   actor: 'b76a4589-cac6-4293-b448-0440b5c66498',
 * });
 */
export const mirrorCard = async (
	integration: IntegrationDefinition,
	contract: Contract,
	options: PipelineOpts,
) => {
	return runIntegration(integration, options, 'mirror', contract);
};
