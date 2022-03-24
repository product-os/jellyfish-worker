import * as assert from '@balena/jellyfish-assert';
import { Jellyscript } from '@balena/jellyfish-jellyscript';
import { getLogger, LogContext } from '@balena/jellyfish-logger';
import {
	ActionContract,
	ActionRequestContract,
	Consumer,
	Producer,
	ProducerOptions,
} from '@balena/jellyfish-queue';
import type { JsonSchema } from '@balena/jellyfish-types';
import type {
	Contract,
	ContractData,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import { CARDS as CORE_CARDS, Kernel } from 'autumndb';
import { parseExpression } from 'cron-parser';
import * as fastEquals from 'fast-equals';
import type { Operation } from 'fast-json-patch';
import _ from 'lodash';
import * as semver from 'semver';
import { serializeError } from 'serialize-error';
import * as skhema from 'skhema';
import { v4 as uuidv4 } from 'uuid';
import { actions } from './actions';
import { contracts } from './contracts';
import * as errors from './errors';
import * as formulas from './formulas';
import * as subscriptionsLib from './subscriptions';
import { Sync } from './sync';
import { evaluate as evaluateTransformers, Transformer } from './transformers';
import * as triggersLib from './triggers';
import type {
	Action,
	Map,
	ScheduledActionContract,
	ScheduledActionData,
	TriggeredActionContract,
	TriggeredActionContractDefinition,
	WorkerContext,
} from './types';
import * as utils from './utils';

export { actions, triggersLib, errors, contracts, utils, Transformer, Sync };
export * as contractMixins from './contracts/mixins';
export {
	errors as syncErrors,
	Integration,
	IntegrationDefinition,
	IntegrationInitializationOptions,
	HttpRequestOptions,
	oauth,
	SequenceItem,
} from './sync';
export {
	ActionContractDefinition,
	ActionDefinition,
	PluginDefinition,
	PluginIdentity,
	PluginManager,
} from './plugin';
export * as testUtils from './test-utils';
export * from './types';

// TODO: use a single logger instance for the worker
const logger = getLogger('worker');

const formulaParser = new Jellyscript({
	formulas: {
		NEEDS: formulas.NEEDS,
		NEEDS_ALL: formulas.NEEDS_ALL,
	},
});

/**
 * @summary The "type" card type
 * @type {String}
 * @private
 */
const CARD_TYPE_TYPE = 'type@1.0.0';

/**
 * @summary Default insert concurrency
 * @type {Number}
 * @private
 */
const INSERT_CONCURRENCY = 3;

/**
 * @summary Get the request input card
 * @function
 * @private
 *
 * @param {LogContext} logContext - log context
 * @param {Object} kernel - kernel instance
 * @param {String} session - session id
 * @param {String} identifier - id or slug
 * @returns {(Object|Null)}
 *
 * @example
 * const card = await getInputCard({ ... }, kernel, session, 'foo-bar')
 * if (card) {
 *   console.log(card)
 * }
 */
const getInputCard = async (
	logContext: LogContext,
	kernel: Kernel,
	session: string,
	identifier: string,
): Promise<Contract | null> => {
	if (identifier.includes('@')) {
		return kernel.getContractBySlug(logContext, session, identifier);
	}
	return kernel.getContractById(logContext, session, identifier);
};

/**
 * Returns an object that will include all links referenced in evaluated fields
 * in the type card's schema.
 *
 * If no links are referenced in evaluated fields, the original object is returned
 * immediately.
 *
 * @param {LogContext} logContext - log context
 * @param {Object} kernel - kernel instance
 * @param {String} session - session id
 * @param {Object} card - card to fill with links
 * @param {Object} typeCard - type card
 *
 * @returns {Object} - the card with any links referenced in the evaluated fields
 * of it's type card's schema.
 */
export async function getObjectWithLinks<
	PContract extends Partial<TContract> | TContract,
	TContract extends Contract<TData>,
	TData extends ContractData,
>(
	logContext: LogContext,
	kernel: Kernel,
	session: string,
	card: PContract,
	typeCard: TypeContract,
): Promise<PContract> {
	const linkVerbs = formulas.getReferencedLinkVerbs(typeCard);
	if (!linkVerbs.length) {
		return card;
	}
	let queriedCard: TContract | null = null;
	if ((card.slug && card.version) || card.id) {
		const query = utils.getQueryWithOptionalLinks(card, linkVerbs);
		[queriedCard] = await kernel.query<TContract>(logContext, session, query);
	}
	const cardWithLinks = queriedCard || card;

	// Optional links may not be populated so explicitly set to an empty array here
	linkVerbs.forEach((linkVerb) => {
		if (!_.has(cardWithLinks, ['links', linkVerb])) {
			_.set(cardWithLinks, ['links', linkVerb], []);
		}
	});

	return cardWithLinks as PContract;
}

/**
 * @summary Get the next execute date-time for a scheduled action
 *
 * @param {ScheduledActionData['schedule']} schedule - schedule configuration
 * @returns {Date | null} next execution date, or null if no future date was found
 */
export function getNextExecutionDate(
	schedule: ScheduledActionData['schedule'],
): Date | null {
	const now = new Date();
	if (schedule.once) {
		const next = new Date(schedule.once.date);
		if (next > now) {
			return schedule.once.date;
		}
	} else if (schedule.recurring) {
		const endDate = new Date(schedule.recurring.end);
		const startDate = new Date(schedule.recurring.start);

		// Ignore anything that will have already ended
		if (endDate > now) {
			try {
				// Handle future start dates
				const options =
					startDate > now
						? {
								currentDate: startDate,
						  }
						: {
								startDate,
						  };

				// Create iterator based on provided configuration
				const iterator = parseExpression(schedule.recurring.interval, {
					endDate,
					...options,
				});

				// Return next execution date if available
				if (iterator.hasNext()) {
					return iterator.next().toDate();
				}
			} catch (error) {
				throw new errors.WorkerInvalidActionRequest(
					`Invalid recurring schedule configuration: ${error}`,
				);
			}
		}
	}

	return null;
}

/**
 * Jellyfish worker library module.
 *
 * @module worker
 */
export class Worker {
	kernel: Kernel;
	consumer: Consumer;
	producer: Producer;
	triggers: TriggeredActionContract[];
	transformers: Transformer[];
	latestTransformers: Transformer[];
	typeContracts: { [key: string]: TypeContract };
	session: string;
	library: Map<Action>;
	id: string = '0';
	// TS-TODO: use correct sync typings.
	// Starts off undefined, set to Sync with initialize().
	sync: undefined | Sync;

	/**
	 * @summary The Jellyfish Actions Worker
	 * @class
	 * @public
	 *
	 * @param {Object} jellyfish - jellyfish instance
	 * @param {String} session - worker privileged session id
	 * @param {Object} actionLibrary - action library
	 * @param {Object} consumer - action consumer
	 * @param {Object} producer - action producer
	 *
	 * @example
	 * const worker = new Worker({ ... }, '4a962ad9-20b5-4dd8-a707-bf819593cc84', {
	 *     'action-create-card': { ... },
	 *     'action-update-card': { ... },
	 *   },
	 *   consumer,
	 *   producer
	 * )
	 */
	constructor(
		kernel: Kernel,
		session: string,
		actionLibrary: Map<Action>,
		consumer: Consumer,
		producer: Producer,
	) {
		this.kernel = kernel;
		this.triggers = [];
		this.transformers = [];
		this.latestTransformers = [];
		this.typeContracts = {};
		this.session = session;
		this.library = actionLibrary;
		this.consumer = consumer;
		this.producer = producer;

		// Add actions defined in this repo
		Object.keys(actions).forEach((name) => {
			actionLibrary[name] = actions[name];
		});
	}

	/**
	 * @summary Get this worker's unique id
	 * @function
	 * @public
	 *
	 * @returns {String} unique worker id
	 *
	 * @example
	 * const worker = new Worker({ ... })
	 * const id = worker.getId()
	 * console.log(id)
	 */
	getId(): string {
		return this.id;
	}

	/**
	 * @summary Initialize the worker
	 * @function
	 * @public
	 *
	 * @param {LogContext} logContext - log context
	 *
	 * @example
	 * const worker = new Worker({ ... })
	 * await worker.initialize(logContext)
	 */
	// TS-TODO: this signature
	async initialize(logContext: LogContext, sync: Sync) {
		// TS-TODO: type this correctly
		this.id = uuidv4();
		this.sync = sync;

		// Insert worker specific cards
		await Promise.all(
			Object.values(contracts).map(async (contract) => {
				return this.kernel.replaceContract(logContext, this.session, contract);
			}),
		);
		await Promise.all(
			Object.values(actions).map(async (card) => {
				return this.kernel.replaceContract(
					logContext,
					this.session,
					card.contract,
				);
			}),
		);
	}

	/**
	 * @summary Get the action context
	 * @function
	 * @private
	 *
	 * @param {LogContext} logContext - log context
	 * @returns {Object} action context
	 *
	 * @example
	 * const actionContext = worker.getActionContext({ ... })
	 */
	getActionContext(logContext: LogContext): WorkerContext {
		const self = this;
		return {
			sync: this.sync,
			getEventSlug: utils.getEventSlug,
			getCardById: (lsession: string, id: string) => {
				return self.kernel.getContractById(logContext, lsession, id);
			},
			getCardBySlug: (lsession: string, slug: string) => {
				return self.kernel.getContractBySlug(logContext, lsession, slug);
			},
			query: (
				lsession: string,
				schema: Parameters<Kernel['query']>[2],
				options: Parameters<Kernel['query']>[3],
			) => {
				return self.kernel.query(logContext, lsession, schema, options);
			},
			privilegedSession: this.session,
			insertCard: (
				lsession: string,
				typeCard: Parameters<Worker['insertCard']>[2],
				options: Parameters<Worker['insertCard']>[3],
				card: Parameters<Worker['insertCard']>[4],
			) => {
				return self.insertCard(logContext, lsession, typeCard, options, card);
			},
			replaceCard: (
				lsession: string,
				typeCard: Parameters<Worker['replaceCard']>[2],
				options: Parameters<Worker['replaceCard']>[3],
				card: Parameters<Worker['replaceCard']>[4],
			) => {
				return self.replaceCard(logContext, lsession, typeCard, options, card);
			},
			patchCard: (
				lsession: string,
				typeCard: Parameters<Worker['patchCard']>[2],
				options: Parameters<Worker['patchCard']>[3],
				card: Parameters<Worker['patchCard']>[4],
				patch: Parameters<Worker['patchCard']>[5],
			) => {
				return self.patchCard(
					logContext,
					lsession,
					typeCard,
					options,
					card,
					patch,
				);
			},
			enqueueAction: (...args) => {
				return this.enqueueAction(...args);
			},
			cards: {
				...CORE_CARDS,
				...self.getTypeContracts(),
			},
		};
	}

	/**
	 * @summary Enqueus an action request
	 * @function
	 * @public
	 *
	 * @param {Object} session - The session with which to enqueue the action
	 * @param {Object} actionRequest - request values to be enqueued
	 * @param {Object} card - The card that should be inserted
	 *
	 * @returns {Object} The stored action request contract
	 */
	async enqueueAction(session: string, actionRequest: ProducerOptions) {
		return this.producer.enqueue(this.getId(), session, actionRequest);
	}

	/**
	 * @summary Insert a card
	 * @function
	 * @public
	 *
	 * @param {LogContext} logContext - log context
	 * @param {String} insertSession - The Jellyfish session to insert the card with
	 * @param {Object} typeCard - The type card for the card that will be inserted
	 * @param {Object} options - options
	 * @param {Date} [options.timestamp] - Upsert timestamp
	 * @param {Object} card - The card that should be inserted
	 *
	 * @returns {Object} inserted card
	 */
	async insertCard(
		logContext: LogContext,
		insertSession: string,
		typeCard: TypeContract,
		// TS-TODO: Use a common type for these options
		options: {
			timestamp?: any;
			reason?: any;
			actor?: any;
			originator?: any;
			attachEvents?: any;
		},
		object: Partial<Contract>,
	) {
		const instance = this;
		const kernel = instance.kernel;

		logger.debug(logContext, 'Inserting card', {
			slug: object.slug,
			type: typeCard.slug,
			attachEvents: options.attachEvents,
		});

		object.type = `${typeCard.slug}@${typeCard.version}`;

		let card: Contract | null = null;
		if (object.slug) {
			card = await kernel.getContractBySlug(
				logContext,
				insertSession,
				`${object.slug}@${object.version || 'latest'}`,
			);
		}

		if (!card && object.id) {
			card = await kernel.getContractById(logContext, insertSession, object.id);
		}

		if (typeof object.name !== 'string') {
			Reflect.deleteProperty(object, 'name');
		}

		return this.commit(
			logContext,
			insertSession,
			typeCard,
			card,
			{
				eventPayload: _.omit(object, ['id']),
				eventType: 'create',
				timestamp: options.timestamp,
				reason: options.reason,
				actor: options.actor,
				originator: options.originator,
				attachEvents: options.attachEvents,
			},
			async () => {
				// TS-TODO: Fix these "any" castings
				const objectWithLinks = await getObjectWithLinks(
					logContext,
					kernel,
					insertSession,
					object,
					typeCard,
				);
				const result = formulaParser.evaluateObject(
					typeCard.data.schema,
					objectWithLinks as any,
				);
				return kernel.insertContract(logContext, insertSession, result as any);
			},
		);
	}

	/**
	 * @summary Patch a card
	 * @function
	 * @public
	 *
	 * @param {LogContext} logContext - log context
	 * @param {String} insertSession - The Jellyfish session to insert the card with
	 * @param {Object} typeCard - The type card for the card that will be inserted
	 * @param {Object} options - options
	 * @param {Date} [options.timestamp] - Upsert timestamp
	 * @param {Object} card - The card that should be inserted
	 * @param {Object[]} patch - JSON Patch
	 *
	 * @returns {Object} inserted card
	 */
	patchCard(
		logContext: LogContext,
		insertSession: string,
		typeCard: TypeContract,
		// TS-TODO: Use a common type for these options
		options: {
			timestamp?: any;
			reason?: any;
			actor?: any;
			originator?: any;
			attachEvents?: any;
		},
		card: Partial<Contract>,
		patch: Operation[],
	) {
		const instance = this;
		const kernel = instance.kernel;
		const session = insertSession;
		const object = card;
		assert.INTERNAL(
			logContext,
			object.version,
			errors.WorkerInvalidVersion,
			`Can't update without a version for: ${object.slug}`,
		);

		logger.debug(logContext, 'Patching card', {
			slug: object.slug,
			version: object.version,
			type: typeCard.slug,
			attachEvents: options.attachEvents,
			operations: patch.length,
		});

		return this.commit(
			logContext,
			session,
			typeCard,
			object as Contract,
			{
				eventPayload: patch,
				eventType: 'update',
				timestamp: options.timestamp,
				reason: options.reason,
				actor: options.actor,
				originator: options.originator,
				attachEvents: options.attachEvents,
			},
			async () => {
				// TS-TODO: Remove these any castings
				const objectWithLinks = await getObjectWithLinks(
					logContext,
					kernel,
					session,
					object,
					typeCard,
				);
				const newPatch = formulaParser.evaluatePatch(
					typeCard.data.schema,
					objectWithLinks as any,
					patch,
				);
				return kernel.patchCardBySlug(
					logContext,
					session,
					`${object.slug}@${object.version}`,
					newPatch,
				);
			},
		);
	}

	/**
	 * @summary Replace a card
	 * @function
	 * @public
	 *
	 * @param {LogContext} logContext - log context
	 * @param {String} insertSession - The Jellyfish session to insert the card with
	 * @param {Object} typeCard - The type card for the card that will be inserted
	 * @param {Object} options - options
	 * @param {Date} [options.timestamp] - Upsert timestamp
	 * @param {Object} card - The card that should be inserted
	 *
	 * @returns {Object} replaced card
	 */
	// FIXME: This entire method should be replaced and all operations should
	// be an insert or update.
	async replaceCard(
		logContext: LogContext,
		insertSession: string,
		typeCard: TypeContract,
		// TS-TODO: Use a common type for these options
		options: {
			timestamp?: any;
			reason?: any;
			actor?: any;
			originator?: any;
			attachEvents?: boolean;
		},
		object: Partial<Contract<ContractData>>,
	) {
		const instance = this;
		const kernel = instance.kernel;
		logger.debug(logContext, 'Replacing card', {
			slug: object.slug,
			type: typeCard.slug,
			attachEvents: options.attachEvents,
		});

		object.type = `${typeCard.slug}@${typeCard.version}`;

		let card: Contract | null = null;

		if (object.slug) {
			card = await kernel.getContractBySlug(
				logContext,
				insertSession,
				`${object.slug}@${object.version}`,
			);
		}
		if (!card && object.id) {
			card = await kernel.getContractById(logContext, insertSession, object.id);
		}

		let attachEvents = options.attachEvents;

		// If a contract already exists don't attach events
		if (card) {
			attachEvents = false;
		}

		if (typeof object.name !== 'string') {
			Reflect.deleteProperty(object, 'name');
		}

		return this.commit(
			logContext,
			insertSession,
			typeCard,
			card,
			{
				attachEvents,
				eventPayload: !!card ? null : _.omit(object, ['id']),
				eventType: !!card ? null : 'create',
				timestamp: options.timestamp,
				reason: options.reason,
				actor: options.actor,
				originator: options.originator,
			},
			async () => {
				const { links } = await getObjectWithLinks(
					logContext,
					kernel,
					insertSession,
					object,
					typeCard,
				);

				// Add the expanded links to the new contract object being inserted
				const result = formulaParser.evaluateObject(typeCard.data.schema, {
					...object,
					links: links || {},
				} as any);

				// TS-TODO: Remove these `any` castings
				return kernel.replaceContract(logContext, insertSession, result as any);
			},
		);
	}

	/**
	 * @summary Set all registered triggers
	 * @function
	 * @public
	 *
	 * @param {LogContext} logContext - log context
	 * @param {Object[]} objects - triggers
	 *
	 * @example
	 * const worker = new Worker({ ... })
	 * worker.setTriggers([ ... ])
	 */
	setTriggers(
		logContext: LogContext,
		triggerContracts: TriggeredActionContract[],
	) {
		logger.info(logContext, 'Setting triggers', {
			count: contracts.length,
		});

		this.triggers = triggerContracts;
	}

	/**
	 * @summary Upsert a single registered trigger
	 * @function
	 * @public
	 * @param {LogContext} logContext - log context
	 * @param {Object} contract - triggered action contract
	 * @example
	 * const worker = new Worker({ ... })
	 * worker.upsertTrigger({ ... })
	 */
	upsertTrigger(logContext: LogContext, contract: TriggeredActionContract) {
		logger.info(logContext, 'Upserting trigger', {
			slug: contract.slug,
		});

		// Find the index of an existing trigger with the same id
		const existingTriggerIndex = _.findIndex(this.triggers, {
			id: contract.id,
		});

		if (existingTriggerIndex === -1) {
			// If an existing trigger is not found, add the trigger
			this.triggers.push(contract);
		} else {
			// If an existing trigger is found, replace it
			this.triggers.splice(existingTriggerIndex, 1, contract);
		}
	}

	/**
	 * @summary Remove a single registered trigger
	 * @function
	 * @public
	 * @param {LogContext} logContext - log context
	 * @param {Object} id - id of trigger card
	 * @example
	 * const worker = new Worker({ ... })
	 * worker.removeTrigger('ed3c21f2-fa5e-4cdf-b862-392a2697abe4')
	 */
	removeTrigger(logContext: LogContext, id: string) {
		logger.info(logContext, 'Removing trigger', {
			id,
		});

		this.triggers = _.reject(this.triggers, {
			id,
		});
	}

	/**
	 * @summary Get all registered triggers
	 * @function
	 * @public
	 *
	 * @returns {Object[]} triggers
	 *
	 * @example
	 * const worker = new Worker({ ... })
	 * const triggers = worker.getTriggers()
	 * console.log(triggers.length)
	 */
	getTriggers() {
		return this.triggers;
	}

	/**
	 * @summary Updates the list of transformers, such that only the latest release version of each major version exists
	 * @function
	 * @private
	 *
	 * @example
	 * this.updateLatestTransformers()
	 */
	updateLatestTransformers() {
		const transformersMap: { [slug: string]: Transformer } = {};
		this.transformers.forEach((tf) => {
			const majorV = semver.major(tf.version) || 1; // we treat 0.x.y versions as "drafts" of 1.x.y versions
			const slugMajV = `${tf.slug}@${majorV}`;
			const prerelease = semver.prerelease(tf.version);
			if (
				!prerelease &&
				(!transformersMap[slugMajV] ||
					semver.gt(tf.version, transformersMap[slugMajV].version))
			) {
				transformersMap[slugMajV] = tf;
			}
		});

		this.latestTransformers = Object.values(transformersMap);
	}

	/**
	 * @summary Set all registered transformers
	 * @function
	 * @public
	 *
	 * @param {LogContext} logContext - log context
	 * @param {Object[]} transformers - transformers
	 *
	 * @example
	 * const worker = new Worker({ ... })
	 * worker.settransformers([ ... ])
	 */
	// TS-TODO: Make transformers a core cotnract and type them correctly here
	setTransformers(logContext: LogContext, transformerContracts: Transformer[]) {
		logger.info(logContext, 'Setting transformers', {
			count: transformerContracts.length,
		});

		this.transformers = transformerContracts;
		this.updateLatestTransformers();
	}

	/**
	 * @summary Set type contracts
	 * @function
	 * @public
	 *
	 * @param {LogContext} logContext - log context
	 * @param {Object[]} typeContracts - type contracts
	 *
	 * @example
	 * const worker = new Worker({ ... })
	 * worker.setTypeContracts([ ... ])
	 */
	setTypeContracts(logContext: LogContext, typeContracts: TypeContract[]) {
		logger.info(logContext, 'Setting type contracts', {
			count: typeContracts.length,
		});

		this.typeContracts = typeContracts.reduce((map, typeContract) => {
			map[`${typeContract.slug}@${typeContract.version}`] = typeContract;
			return map;
		}, {});
	}

	/**
	 * @summary Get type contracts
	 * @function
	 * @public
	 *
	 * @returns {Object} type contract map
	 *
	 * @example
	 * const worker = new Worker({ ... })
	 * const typeContracts = worker.getTypeContracts()
	 * console.log(typeContracts.length)
	 */
	getTypeContracts() {
		return this.typeContracts;
	}

	/**
	 * @summary Upsert a single registered transformer
	 * @function
	 * @public
	 * @param {LogContext} logContext - log context
	 * @param {Object} transformer - transformer card
	 * @example
	 * const worker = new Worker({ ... })
	 * worker.upserttransformer({ ... })
	 */
	upsertTransformer(logContext: LogContext, transformer: Transformer) {
		logger.info(logContext, 'Upserting transformer', {
			slug: transformer.slug,
		});

		// Find the index of an existing transformer with the same id
		const existingTransformerIndex = _.findIndex(this.transformers, {
			id: transformer.id,
		});

		if (existingTransformerIndex === -1) {
			// If an existing transformer is not found, add the transformer
			this.transformers.push(transformer);
		} else {
			// If an existing transformer is found, replace it
			this.transformers.splice(existingTransformerIndex, 1, transformer);
		}
		this.updateLatestTransformers();
	}

	/**
	 * @summary Remove a single registered transformer
	 * @function
	 * @public
	 * @param {LogContext} logContext - log context
	 * @param {Object} id - id of transformer card
	 * @example
	 * const worker = new Worker({ ... })
	 * worker.removetransformer('ed3c21f2-fa5e-4cdf-b862-392a2697abe4')
	 */
	removeTransformer(logContext: LogContext, id: string) {
		logger.info(logContext, 'Removing transformer', {
			id,
		});

		this.transformers = _.reject(this.transformers, {
			id,
		});
		this.updateLatestTransformers();
	}

	/**
	 * @summary Get filtered list of transformers, where only latest release version of each major version exists.
	 * @function
	 * @public
	 *
	 * @returns {Object[]} transformers
	 *
	 * @example
	 * const worker = new Worker({ ... })
	 * const transformers = worker.getLatestTransformers()
	 * console.log(transformers.length)
	 */
	getLatestTransformers() {
		return this.latestTransformers;
	}

	/**
	 * @summary Execute the "pre" hook of an action request
	 * @function
	 * @public
	 *
	 * @description
	 * The "pre" hook of an action request is meant to run before
	 * the action request is enqueued. The hook may return a
	 * modified set of arguments.
	 *
	 * @param {String} session - session id
	 * @param {Object} request - action request options
	 * @returns {(Object|Undefined)} request arguments
	 */
	async pre(
		session: string,
		request: {
			action: string;
			logContext: LogContext;
			arguments: any;
			card: string;
			type: string;
		},
	) {
		const actionDefinition = this.library[request.action.split('@')[0]];
		assert.USER(
			request.logContext,
			actionDefinition,
			errors.WorkerInvalidAction,
			`No such action: ${request.action}`,
		);

		if (!actionDefinition.pre) {
			return request;
		}

		const modifiedArguments = await actionDefinition.pre(
			session,
			this.getActionContext(request.logContext),
			request,
		);

		request.arguments = modifiedArguments || request.arguments;
		return request;
	}

	/**
	 * @summary Execute an action request
	 * @function
	 * @public
	 *
	 * @description
	 * You still need to make sure to post the execution event
	 * upon completion.
	 *
	 * @param {String} session - session id
	 * @param {Object} request - request
	 * @param {String} request.actor - actor id
	 * @param {Object} request.action - action card
	 * @param {String} request.timestamp - action timestamp
	 * @param {String} request.card - action input card id
	 * @param {Object} request.arguments - action arguments
	 * @param {String} [request.originator] - action originator card id]
	 * @returns {Object} action result
	 *
	 * @example
	 * const worker = new Worker({ ... })
	 * const session = '4a962ad9-20b5-4dd8-a707-bf819593cc84'
	 * const result = await worker.execute(kernel, session, { ... })
	 * console.log(result.error)
	 * console.log(result.data)
	 */
	async execute(session: string, request: ActionRequestContract) {
		const logContext: LogContext = request.data.context || {
			id: `EXECUTE-${request.id}`,
		};
		logger.info(logContext, 'Executing request', {
			request: {
				id: request.id,
				card: request.data.input.id,
				type: request.data.input.type,
				actor: request.data.actor,
				action: request.data.action,
			},
		});

		const actionCard = await this.kernel.getContractBySlug<ActionContract>(
			logContext,
			session,
			request.data.action,
		);

		assert.USER(
			logContext,
			actionCard,
			errors.WorkerInvalidAction,
			`No such action: ${request.data.action}`,
		);

		// TS-TODO: Use asserts correctly so the `assert.USER` call above correctly
		// validates that actionCard is non-null, so this double-check can be removed
		if (!actionCard) {
			throw new errors.WorkerInvalidAction(
				`No such action: ${request.data.action}`,
			);
		}

		const startDate = new Date();

		let result;

		try {
			const [input, actor] = await Promise.all([
				getInputCard(logContext, this.kernel, session, request.data.input.id),
				this.kernel.getContractById(logContext, session, request.data.actor),
			]);

			assert.USER(
				logContext,
				input,
				errors.WorkerNoElement,
				`No such input card: ${request.data.input.id}`,
			);
			assert.INTERNAL(
				logContext,
				actor,
				errors.WorkerNoElement,
				`No such actor: ${request.data.actor}`,
			);

			const actionInputCardFilter = _.get(actionCard, ['data', 'filter'], {
				type: 'object',
			});

			const results = skhema.match(actionInputCardFilter as any, input);
			if (!results.valid) {
				logger.error(logContext, 'Card schema mismatch!');
				logger.error(logContext, JSON.stringify(actionInputCardFilter));
				for (const error of results.errors) {
					logger.error(logContext, error);
				}

				throw new errors.WorkerSchemaMismatch(
					`Input card does not match filter. Action:${actionCard.slug}, Card:${input?.slug}`,
				);
			}

			// TODO: Action definition bodies are not versioned yet
			// as they are not part of the action cards.
			const actionName = actionCard.slug.split('@')[0];

			const argumentsSchema = utils.getActionArgumentsSchema(actionCard);

			assert.USER(
				logContext,
				// TS-TODO: remove any casting
				skhema.isValid(argumentsSchema as any, request.data.arguments),
				errors.WorkerSchemaMismatch,
				() => {
					return `Arguments do not match for action ${actionName}: ${JSON.stringify(
						request.data.arguments,
						null,
						2,
					)}`;
				},
			);

			const actionFunction =
				this.library[actionName] && this.library[actionName].handler;

			assert.INTERNAL(
				logContext,
				actionFunction,
				errors.WorkerInvalidAction,
				`Unknown action function: ${actionName}`,
			);

			// Generate an interface object for the action function to use.
			// This ensures that any CRUD operations performed by the action
			// function are mediates by the worker instance, ensuring that
			// things like triggers, transformers etc are always processed correctly.
			const actionContext = this.getActionContext(logContext);

			// TS-TODO: `input` gets verified as non-null by a jellyfish-assert
			// call above, but Typescript doesn't understand this.
			const data: any = await actionFunction(session, actionContext, input!, {
				action: actionCard,
				card: request.data.input.id,
				actor: request.data.actor,
				logContext,
				timestamp: request.data.timestamp,
				epoch: request.data.epoch,
				// TS-TODO: correctly type arguments object on action request contract
				arguments: request.data.arguments as { [arg: string]: JsonSchema },
				originator: request.data.originator,
			});

			const endDate = new Date();
			logger.info(logContext, 'Execute success', {
				data,
				input: request.data.input,
				action: actionCard.slug,
				time: endDate.getTime() - startDate.getTime(),
			});

			// Schedule actions for future execution
			if (
				data &&
				data.id &&
				data.type &&
				data.type.split('@')[0] === 'scheduled-action'
			) {
				await this.scheduleAction(logContext, session, data.id);
			} else if (request.data.schedule) {
				await this.scheduleAction(logContext, session, request.data.schedule);
			}

			result = {
				error: false,
				data,
			};
		} catch (error: any) {
			const endDate = new Date();
			const errorObject = serializeError(error, { maxDepth: 5 });

			const logData = {
				error: errorObject,
				input: request.data.input,
				action: actionCard.slug,
				time: endDate.getTime() - startDate.getTime(),
			};

			if (error.expected) {
				logger.warn(logContext, 'Execute error', logData);
			} else {
				logger.error(logContext, 'Execute error', logData);
			}

			result = {
				error: true,
				data: errorObject,
			};
		}

		const event = await this.consumer.postResults(
			this.getId(),
			logContext,
			request,
			result,
		);
		assert.INTERNAL(
			logContext,
			event,
			errors.WorkerNoExecuteEvent,
			`Could not create execute event for request: ${request.id}`,
		);

		logger.info(logContext, 'Execute event posted', {
			slug: event.slug,
			type: event.type,
			target: event.data.target,
			actor: event.data.actor,
			payload: {
				id: event.data.payload.id,
				card: event.data.payload.card,
				error: event.data.payload.error,
			},
		});

		return result;
	}

	/**
	 * @summary A pipeline function that runs standard logic for all contract
	 * operations ran through the worker
	 * @function
	 * @private
	 *
	 * @param {LogContext} logContext - log context
	 * @param {Object} kernel - kernel instance
	 * @param {String} session - session id
	 * @param {Object} typeCard - The full type contract for the card being
	 * inserted or updated
	 * @param {Object} current - The full contract prior to being updated, if it exists
	 * @param {Object} options - Options object
	 * @param {Function} fn - an asynchronous function that will perform the operation
	 */
	// TS-TODO: Improve the typings for the `options` parameter
	private async commit(
		logContext: LogContext,
		session: string,
		typeCard: TypeContract,
		current: Contract | null,
		options: {
			actor: any;
			originator: any;
			attachEvents: any;
			timestamp: string | number | Date;
			reason: any;
			eventType: any;
			eventPayload: any;
		},
		fn: () => Promise<Contract>,
	) {
		assert.INTERNAL(
			logContext,
			typeCard && typeCard.data && typeCard.data.schema,
			errors.WorkerNoElement,
			`Invalid type: ${typeCard}`,
		);

		const currentTime = new Date();
		const workerContext = this.getActionContext(logContext);

		const insertedCard = await fn();
		if (!insertedCard) {
			return null;
		}

		if (
			current !== null &&
			fastEquals.deepEqual(
				_.omit(insertedCard, [
					'created_at',
					'updated_at',
					'linked_at',
					'links',
				]),
				_.omit(current, ['created_at', 'updated_at', 'linked_at', 'links']),
			)
		) {
			logger.debug(logContext, 'Omitting pointless insertion', {
				slug: current.slug,
			});

			return null;
		}

		evaluateTransformers({
			transformers: this.latestTransformers,
			oldCard: current,
			newCard: insertedCard,
			logContext,
			query: (querySchema, queryOpts) => {
				return this.kernel.query(
					logContext,
					workerContext.privilegedSession,
					querySchema,
					queryOpts,
				);
			},
			executeAndAwaitAction: async (actionRequest) => {
				const req = await this.enqueueAction(workerContext.privilegedSession, {
					...actionRequest,
					logContext,
					type: actionRequest.type!,
				});

				const result = await this.producer.waitResults(logContext, req);

				return result;
			},
		});

		subscriptionsLib
			.evaluate({
				oldContract: current,
				newContract: insertedCard,
				getTypeContract: (type) => {
					return this.typeContracts[type];
				},
				getSession: async (userId: string) => {
					return utils.getActorKey(
						logContext,
						this.kernel,
						workerContext.privilegedSession,
						userId,
					);
				},
				insertContract: async (
					insertedContractType: TypeContract,
					actorSession: string,
					object: any,
				) => {
					return workerContext.insertCard(
						actorSession,
						insertedContractType,
						{
							...options,
							attachEvents: true,
							timestamp: Date.now(),
						},
						object,
					);
				},
				query: (querySchema, queryOpts = {}) => {
					return this.kernel.query(
						logContext,
						workerContext.privilegedSession,
						querySchema,
						queryOpts,
					);
				},
				getContractById: (id: string) => {
					return this.kernel.getContractById(logContext, session, id);
				},
			})
			.catch((error) => {
				const errorObject = serializeError(error, { maxDepth: 5 });

				const logData = {
					error: errorObject,
					input: insertedCard.slug,
				};

				if (error.expected) {
					logger.warn(logContext, 'Execute error in subscriptions', logData);
				} else {
					logger.error(logContext, 'Execute error', logData);
				}
			});

		await Promise.all(
			this.triggers.map(async (trigger: TriggeredActionContract) => {
				try {
					// Ignore triggered actions whose start date is in the future
					if (currentTime < triggersLib.getStartDate(trigger)) {
						return null;
					}

					const request = await triggersLib.getRequest(
						this.kernel,
						trigger,
						current,
						insertedCard,
						{
							currentDate: new Date(),
							mode: current ? 'update' : 'insert',
							logContext,
							session,
						},
					);

					if (!request) {
						return null;
					}

					// trigger.target might result in multiple cards in a single action request
					const identifiers = _.uniq(_.castArray(request.card));

					await Promise.all(
						identifiers.map(async (identifier) => {
							const triggerCard = await getInputCard(
								logContext,
								this.kernel,
								session,
								identifier,
							);

							if (!triggerCard) {
								throw new errors.WorkerNoElement(
									`No such input card for trigger ${trigger.slug}: ${identifier}`,
								);
							}
							const actionRequest = {
								// Re-enqueuing an action request expects the "card" option to be an
								// id, not a full card.
								card: triggerCard.id,
								action: request.action!,
								actor: options.actor,
								logContext: request.logContext,
								timestamp: request.currentDate.toISOString(),
								epoch: request.currentDate.valueOf(),
								arguments: request.arguments,

								// Carry the old originator if present so we
								// don't break the chain
								originator: options.originator || request.originator,
							};

							logger.info(
								logContext,
								'Enqueing new action request due to triggered-action',
								{
									trigger: trigger.slug,
									contract: triggerCard.id,
									arguments: request.arguments,
								},
							);

							// TS-TODO: remove any casting
							return this.enqueueAction(session, actionRequest as any);
						}),
					);
				} catch (error: any) {
					const errorObject = serializeError(error, { maxDepth: 5 });

					const logData = {
						error: errorObject,
						input: insertedCard.slug,
						trigger: trigger.slug,
					};

					if (error.expected) {
						logger.warn(
							logContext,
							'Execute error in asynchronous trigger',
							logData,
						);
					} else {
						logger.error(logContext, 'Execute error', logData);
					}
				}
			}),
		);

		if (options.attachEvents) {
			const time = options.timestamp
				? new Date(options.timestamp)
				: currentTime;

			const request = {
				action: 'action-create-event@1.0.0',
				card: insertedCard,
				actor: options.actor,
				logContext,
				timestamp: time.toISOString(),
				epoch: time.valueOf(),
				arguments: {
					name: options.reason,
					type: options.eventType,
					payload: options.eventPayload,
					tags: [],
				},
			};

			await this.library[request.action.split('@')[0]].handler(
				session,
				workerContext,
				insertedCard,
				request as any,
			);
		}

		// If the card markers have changed then update the timeline of the card
		if (
			current &&
			!fastEquals.deepEqual(current.markers, insertedCard.markers)
		) {
			const timeline = await this.kernel.query(logContext, session, {
				$$links: {
					'is attached to': {
						type: 'object',
						required: ['slug', 'type'],
						properties: {
							slug: {
								type: 'string',
								const: insertedCard.slug,
							},
							type: {
								type: 'string',
								const: insertedCard.type,
							},
						},
					},
				},
				type: 'object',
				required: ['slug', 'version', 'type'],
				properties: {
					slug: {
						type: 'string',
					},
					version: {
						type: 'string',
					},
					type: {
						type: 'string',
					},
				},
			});

			for (const event of timeline) {
				if (!fastEquals.deepEqual(event.markers, insertedCard.markers)) {
					await this.kernel.patchCardBySlug(
						logContext,
						session,
						`${event.slug}@${event.version}`,
						[
							{
								op: 'replace',
								path: '/markers',
								value: insertedCard.markers,
							},
						],
					);
				}
			}
		}

		if (insertedCard.type === CARD_TYPE_TYPE) {
			// Remove any previously attached trigger for this type
			const typeTriggers = await triggersLib.getTypeTriggers(
				logContext,
				this.kernel,
				session,
				`${insertedCard.slug}@${insertedCard.version}`,
			);
			await Promise.all(
				typeTriggers.map(
					async (trigger) => {
						await this.kernel.patchCardBySlug(
							logContext,
							session,
							`${trigger.slug}@${trigger.version}`,
							[
								{
									op: 'replace',
									path: '/active',
									value: false,
								},
							],
						);

						// Also from the locally cached triggers
						_.remove(this.triggers, {
							id: trigger.id,
						});
					},
					{
						concurrency: INSERT_CONCURRENCY,
					},
				),
			);

			await Promise.all(
				formulas.getTypeTriggers(insertedCard as TypeContract).map(
					async (trigger) => {
						// We don't want to use the actions queue here
						// so that watchers are applied right away
						const triggeredActionContract = await this.kernel.replaceContract(
							logContext,
							session,
							trigger,
						);

						// Registered the newly created trigger
						// right away for performance reasons
						return this.setTriggers(
							logContext,
							this.triggers.concat([triggeredActionContract]),
						);
					},
					{
						concurrency: INSERT_CONCURRENCY,
					},
				),
			);
		}

		return insertedCard;
	}

	/**
	 * @sumary Enqueue an action to be executed later, using schedule configuration
	 * @function
	 *
	 * @param {LogContext} logContext - log context
	 * @param {String} session - session id
	 * @param {String} id - scheduled action contract ID
	 */
	async scheduleAction(
		logContext: LogContext,
		session: string,
		id: string,
	): Promise<void> {
		// Remove any already enqueued jobs
		await this.producer.deleteJob(logContext, id);

		// Enqueue request if schedule configuration results in future date
		const scheduledAction =
			await this.kernel.getContractById<ScheduledActionContract>(
				logContext,
				session,
				id,
			);
		if (scheduledAction && scheduledAction.active) {
			const runAt = getNextExecutionDate(scheduledAction.data.schedule);
			if (runAt) {
				await this.enqueueAction(session, {
					logContext,
					action: scheduledAction.data.options.action,
					card: scheduledAction.data.options.card,
					type: scheduledAction.data.options.type,
					arguments: scheduledAction.data.options.arguments,
					schedule: {
						contract: id,
						runAt,
					},
				});
			}
		}
	}
}
