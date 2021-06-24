/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import Bluebird from 'bluebird';
import * as errio from 'errio';
import * as _ from 'lodash';
import { Operation } from 'fast-json-patch';
import { v4 as uuidv4 } from 'uuid';
import * as assert from '@balena/jellyfish-assert';
import { getLogger } from '@balena/jellyfish-logger';
import * as semver from 'semver';
import {
	JellyfishKernel,
	LogContext,
	ParsedWorkerTriggerObject,
	ProducerOptions,
	QueueConsumer,
	QueueProducer,
	WorkerTriggerObjectInput,
} from './types';
import { core } from '@balena/jellyfish-types';
import * as errors from './errors';
import * as executor from './executor';
import * as utils from './utils';
import * as triggers from './triggers';
import CARDS from './cards';

// TODO: use a single logger instance for the worker
const logger = getLogger('worker');

export { triggers, errors, executor, CARDS, utils };

/**
 * Jellyfish worker library module.
 *
 * @module worker
 */

const runExecutor = async (
	fn:
		| typeof executor.insertCard
		| typeof executor.patchCard
		| typeof executor.replaceCard,
	instance: Worker,
	context: LogContext,
	session: string,
	typeCard: core.TypeContract,
	card: Partial<core.Contract>,
	// TS-TODO: Find out the correct types for this options object
	options: {
		timestamp: string;
		reason: null | string;
		actor: string;
		originator: string;
		attachEvents: boolean;
		replace?: any;
	},
	patch?: Operation[],
): Promise<core.Contract | null> => {
	return fn(
		context,
		instance.jellyfish,
		session,
		typeCard,
		{
			replace: options.replace,
			triggers: instance.getTriggers(),
			transformers: instance.getLatestTransformers(),
			typeContracts: instance.getTypeContracts(),
			timestamp: options.timestamp,
			reason: options.reason,
			context: instance.getActionContext(context),
			actor: options.actor,
			library: instance.library,
			currentTime: new Date(),
			originator: options.originator,
			attachEvents: options.attachEvents,
			setTriggers: instance.setTriggers.bind(instance),
			executeAction: async (
				executeSession: string,
				actionRequest: ProducerOptions,
			) => {
				return instance.producer.enqueue(
					instance.getId(),
					executeSession,
					actionRequest,
				);
			},
			waitResults: async (
				requestContext: LogContext,
				actionRequest: core.ActionRequestContract,
			) => {
				return instance.producer.waitResults(requestContext, actionRequest);
			},
		},
		// TS-TODO: Sometimes execute functions expect full contracts and sometimes they don't, fix the typings here!
		card as core.Contract,
		// TS-TODO: Patch is this extra function arg that is only used when fn is "patchCard"
		patch as any,
	);
};

// TS-TODO: These asserts are largely useless and can be removed once everything is converted to TS
const parseTrigger = (
	context: LogContext,
	trigger: WorkerTriggerObjectInput,
): ParsedWorkerTriggerObject => {
	assert.INTERNAL(
		context,
		trigger.slug && _.isString(trigger.slug),
		errors.WorkerInvalidTrigger,
		`Invalid slug: ${trigger.slug}`,
	);
	assert.INTERNAL(
		context,
		trigger.id && _.isString(trigger.id),
		errors.WorkerInvalidTrigger,
		`Invalid id: ${trigger.id}`,
	);
	assert.INTERNAL(
		context,
		trigger.action && _.isString(trigger.action),
		errors.WorkerInvalidTrigger,
		`Invalid action: ${trigger.action}`,
	);
	assert.INTERNAL(
		context,
		!trigger.mode || _.isString(trigger.mode),
		errors.WorkerInvalidTrigger,
		`Invalid mode: ${trigger.mode}`,
	);
	assert.INTERNAL(
		context,
		trigger.target &&
			(_.isString(trigger.target) ||
				_.isPlainObject(trigger.target) ||
				_.isArray(trigger.target)),
		errors.WorkerInvalidTrigger,
		`Invalid target: ${trigger.target}`,
	);
	if (_.isArray(trigger.target)) {
		assert.INTERNAL(
			context,
			trigger.target.length === _.uniq(trigger.target).length,
			errors.WorkerInvalidTrigger,
			'Invalid target: it contains duplicates',
		);
	}
	assert.INTERNAL(
		context,
		(trigger.interval || trigger.filter) &&
			!(trigger.interval && trigger.filter),
		errors.WorkerInvalidTrigger,
		'Use either a filter or an interval',
	);
	assert.INTERNAL(
		context,
		trigger.interval || (trigger.filter && _.isPlainObject(trigger.filter)),
		errors.WorkerInvalidTrigger,
		`Invalid filter: ${trigger.filter}`,
	);
	assert.INTERNAL(
		context,
		trigger.filter || (trigger.interval && _.isString(trigger.interval)),
		errors.WorkerInvalidTrigger,
		`Invalid interval: ${trigger.interval}`,
	);
	assert.INTERNAL(
		context,
		trigger.arguments && _.isPlainObject(trigger.arguments),
		errors.WorkerInvalidTrigger,
		`Invalid arguments: ${trigger.arguments}`,
	);

	const result: ParsedWorkerTriggerObject = {
		id: trigger.id,
		slug: trigger.slug,
		action: trigger.action,
		target: trigger.target,
		arguments: trigger.arguments,
		schedule: trigger.schedule,
	};

	// TODO: "startDate" is not on the triggered-action type definition.
	// Investigate to see if and how this field is used
	if ((trigger as any).startDate) {
		result.startDate = (trigger as any).startDate;
	}

	if (trigger.filter) {
		result.filter = trigger.filter;
	}

	if (trigger.interval) {
		result.interval = trigger.interval;
	}

	if (trigger.mode) {
		result.mode = trigger.mode;
	}

	return result;
};

export class Worker {
	jellyfish: JellyfishKernel;
	consumer: QueueConsumer;
	producer: QueueProducer;
	triggers: WorkerTriggerObjectInput[];
	transformers: core.Contract[];
	latestTransformers: core.Contract[];
	typeContracts: { [key: string]: core.TypeContract };
	errors: typeof errors;
	session: string;
	// TS-TODO: type these correctly
	library: {
		[key: string]: {
			handler: (
				session: string,
				// Worker context?
				context: any,
				contract: core.Contract<core.ContractData>,
				request: {
					action: string;
					card: core.Contract<core.ContractData>;
					actor: string;
					context: LogContext;
					timestamp: any;
					epoch: any;
					arguments: { name: any; type: any; payload: any; tags: never[] };
				},
			) => any;
			pre: (session: string, context: any, request: any) => any;
		};
	};
	id: string = '0';
	// TS-TODO: use correct sync typings
	sync: any;

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
	// FIXME worker violates single responsibility principle in that it both handles events and produces tick events
	constructor(
		jellyfish: JellyfishKernel,
		session: string,
		// TS-TODO: type the action library
		actionLibrary: { [key: string]: any },
		consumer: QueueConsumer,
		producer: QueueProducer,
	) {
		this.jellyfish = jellyfish;
		this.triggers = [];
		this.transformers = [];
		this.latestTransformers = [];
		this.typeContracts = {};
		this.errors = errors;
		this.session = session;
		this.library = actionLibrary;
		this.consumer = consumer;
		this.producer = producer;
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
	getId() {
		return this.id;
	}

	/**
	 * @summary Initialize the worker
	 * @function
	 * @public
	 *
	 * @param {Object} context - execution context
	 *
	 * @example
	 * const worker = new Worker({ ... })
	 * await worker.initialize(context)
	 */
	async initialize(context: any) {
		// TS-TODO: type this correctly
		this.id = uuidv4();
		this.sync = context.sync;

		// Insert worker specific cards
		await Bluebird.map(Object.values(CARDS), async (card) => {
			return this.jellyfish.replaceCard(context, this.session, card);
		});
	}

	/**
	 * @summary Get the action context
	 * @function
	 * @private
	 *
	 * @param {Object} context - execution context
	 * @returns {Object} action context
	 *
	 * @example
	 * const actionContext = worker.getActionContext({ ... })
	 */
	getActionContext(context: LogContext) {
		const self = this;
		return {
			errors,
			defaults: this.jellyfish.defaults,
			sync: this.sync,
			getEventSlug: utils.getEventSlug,
			getCardById: (lsession: string, id: string) => {
				return self.jellyfish.getCardById(context, lsession, id);
			},
			getCardBySlug: (lsession: string, slug: string) => {
				return self.jellyfish.getCardBySlug(context, lsession, slug);
			},
			query: (
				lsession: string,
				schema: Parameters<JellyfishKernel['query']>[2],
				options: Parameters<JellyfishKernel['query']>[3],
			) => {
				return self.jellyfish.query(context, lsession, schema, options);
			},
			privilegedSession: this.session,
			insertCard: (
				lsession: string,
				typeCard: Parameters<Worker['insertCard']>[2],
				options: Parameters<Worker['insertCard']>[3],
				card: Parameters<Worker['insertCard']>[4],
			) => {
				return self.insertCard(context, lsession, typeCard, options, card);
			},
			replaceCard: (
				lsession: string,
				typeCard: Parameters<Worker['replaceCard']>[2],
				options: Parameters<Worker['replaceCard']>[3],
				card: Parameters<Worker['replaceCard']>[4],
			) => {
				return self.replaceCard(context, lsession, typeCard, options, card);
			},
			patchCard: (
				lsession: string,
				typeCard: Parameters<Worker['patchCard']>[2],
				options: Parameters<Worker['patchCard']>[3],
				card: Parameters<Worker['patchCard']>[4],
				patch: Parameters<Worker['patchCard']>[5],
			) => {
				return self.patchCard(
					context,
					lsession,
					typeCard,
					options,
					card,
					patch,
				);
			},
			cards: this.jellyfish.cards,
		};
	}

	/**
	 * @summary Insert a card
	 * @function
	 * @public
	 *
	 * @param {Object} context - execution context
	 * @param {String} insertSession - The Jellyfish session to insert the card with
	 * @param {Object} typeCard - The type card for the card that will be inserted
	 * @param {Object} options - options
	 * @param {Date} [options.timestamp] - Upsert timestamp
	 * @param {Object} card - The card that should be inserted
	 *
	 * @returns {Object} inserted card
	 */
	insertCard(
		context: LogContext,
		insertSession: string,
		typeCard: core.TypeContract,
		// TS-TODO: Use a common type for these options
		options: {
			timestamp: any;
			reason: any;
			actor: any;
			originator?: any;
			attachEvents: any;
		},
		card: Partial<core.Contract>,
	) {
		return runExecutor(
			executor.insertCard,
			this,
			context,
			insertSession,
			typeCard,
			card,
			{
				timestamp: options.timestamp,
				reason: options.reason,
				actor: options.actor,
				originator: options.originator,
				attachEvents: options.attachEvents,
			},
		);
	}

	/**
	 * @summary Patch a card
	 * @function
	 * @public
	 *
	 * @param {Object} context - execution context
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
		context: LogContext,
		insertSession: string,
		typeCard: core.TypeContract,
		// TS-TODO: Use a common type for these options
		options: {
			timestamp: any;
			reason: any;
			actor: any;
			originator: any;
			attachEvents: any;
		},
		card: Partial<core.Contract>,
		patch: Operation[],
	) {
		return runExecutor(
			executor.patchCard,
			this,
			context,
			insertSession,
			typeCard,
			card,
			{
				timestamp: options.timestamp,
				reason: options.reason,
				actor: options.actor,
				originator: options.originator,
				attachEvents: options.attachEvents,
			},
			patch,
		);
	}

	/**
	 * @summary Replace a card
	 * @function
	 * @public
	 *
	 * @param {Object} context - execution context
	 * @param {String} insertSession - The Jellyfish session to insert the card with
	 * @param {Object} typeCard - The type card for the card that will be inserted
	 * @param {Object} options - options
	 * @param {Date} [options.timestamp] - Upsert timestamp
	 * @param {Object} card - The card that should be inserted
	 *
	 * @returns {Object} replaced card
	 */
	replaceCard(
		context: LogContext,
		insertSession: string,
		typeCard: core.TypeContract,
		// TS-TODO: Use a common type for these options
		options: {
			timestamp: any;
			reason: any;
			actor: any;
			originator: any;
			attachEvents: any;
		},
		card: Partial<core.Contract<core.ContractData>>,
	) {
		return runExecutor(
			executor.replaceCard,
			this,
			context,
			insertSession,
			typeCard,
			card,
			{
				timestamp: options.timestamp,
				reason: options.reason,
				actor: options.actor,
				originator: options.originator,
				attachEvents: options.attachEvents,
			},
		);
	}

	/**
	 * @summary Set all registered triggers
	 * @function
	 * @public
	 *
	 * @param {Object} context - execution context
	 * @param {Object[]} objects - triggers
	 *
	 * @example
	 * const worker = new Worker({ ... })
	 * worker.setTriggers([ ... ])
	 */
	setTriggers(context: LogContext, objects: WorkerTriggerObjectInput[]) {
		logger.info(context, 'Setting triggers', {
			count: objects.length,
		});

		this.triggers = objects.map((trigger) => {
			return parseTrigger(context, trigger);
		});
	}

	/**
	 * @summary Upsert a single registered trigger
	 * @function
	 * @public
	 * @param {Object} context - execution context
	 * @param {Object} card - intermediate trigger card struct
	 * @example
	 * const worker = new Worker({ ... })
	 * worker.upsertTrigger({ ... })
	 */
	upsertTrigger(context: LogContext, card: WorkerTriggerObjectInput) {
		logger.info(context, 'Upserting trigger', {
			slug: card.slug,
		});

		const trigger = parseTrigger(context, card);

		// Find the index of an existing trigger with the same id
		const existingTriggerIndex = _.findIndex(this.triggers, {
			id: trigger.id,
		});

		if (existingTriggerIndex === -1) {
			// If an existing trigger is not found, add the trigger
			this.triggers.push(trigger);
		} else {
			// If an existing trigger is found, replace it
			this.triggers.splice(existingTriggerIndex, 1, trigger);
		}
	}

	/**
	 * @summary Remove a single registered trigger
	 * @function
	 * @public
	 * @param {Object} context - execution context
	 * @param {Object} id - id of trigger card
	 * @example
	 * const worker = new Worker({ ... })
	 * worker.removeTrigger('ed3c21f2-fa5e-4cdf-b862-392a2697abe4')
	 */
	removeTrigger(context: LogContext, id: string) {
		logger.info(context, 'Removing trigger', {
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
		const transformers: { [slug: string]: core.Contract } = {};
		this.transformers.forEach((tf) => {
			const slugMajV = `${tf.slug}@${semver.major(tf.version)}`;
			const prerelease = semver.prerelease(tf.version);
			if (
				!prerelease &&
				(!transformers[slugMajV] ||
					semver.gt(tf.version, transformers[slugMajV].version))
			) {
				transformers[slugMajV] = tf;
			}
		});

		this.latestTransformers = Object.values(transformers);
	}

	/**
	 * @summary Set all registered transformers
	 * @function
	 * @public
	 *
	 * @param {Object} context - execution context
	 * @param {Object[]} transformers - transformers
	 *
	 * @example
	 * const worker = new Worker({ ... })
	 * worker.settransformers([ ... ])
	 */
	// TS-TODO: Make transformers a core cotnract and type them correctly here
	setTransformers(context: LogContext, transformers: core.Contract[]) {
		logger.info(context, 'Setting transformers', {
			count: transformers.length,
		});

		this.transformers = transformers;
		this.updateLatestTransformers();
	}

	/**
	 * @summary Set type contracts
	 * @function
	 * @public
	 *
	 * @param {Object} context - execution context
	 * @param {Object[]} typeContracts - type contracts
	 *
	 * @example
	 * const worker = new Worker({ ... })
	 * worker.setTypeContracts([ ... ])
	 */
	setTypeContracts(context: LogContext, typeContracts: core.TypeContract[]) {
		logger.info(context, 'Setting type contracts', {
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
	 * @param {Object} context - execution context
	 * @param {Object} transformer - transformer card
	 * @example
	 * const worker = new Worker({ ... })
	 * worker.upserttransformer({ ... })
	 */
	upsertTransformer(context: LogContext, transformer: core.Contract) {
		logger.info(context, 'Upserting transformer', {
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
	 * @param {Object} context - execution context
	 * @param {Object} id - id of transformer card
	 * @example
	 * const worker = new Worker({ ... })
	 * worker.removetransformer('ed3c21f2-fa5e-4cdf-b862-392a2697abe4')
	 */
	removeTransformer(context: LogContext, id: string) {
		logger.info(context, 'Removing transformer', {
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
			context: LogContext;
			arguments: any;
			card: string;
			type: string;
		},
	) {
		const actionDefinition = this.library[request.action.split('@')[0]];
		assert.USER(
			request.context,
			actionDefinition,
			errors.WorkerInvalidAction,
			`No such action: ${request.action}`,
		);

		const modifiedArguments = await actionDefinition.pre(
			session,
			this.getActionContext(request.context),
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
	 * const result = await worker.execute(jellyfish, session, { ... })
	 * console.log(result.error)
	 * console.log(result.data)
	 */
	// TS-TODO: Correctly type the "request" parameter
	async execute(session: string, request: any) {
		logger.info(request.data.context, 'Executing request', {
			request: {
				id: request.id,
				card: request.data.input.id,
				type: request.data.input.type,
				actor: request.data.actor,
				action: request.data.action,
			},
		});

		const actionCard = await this.jellyfish.getCardBySlug<core.ActionContract>(
			request.data.context,
			session,
			request.data.action,
		);

		assert.USER(
			request.context,
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
		const result = await executor
			.run(
				this.jellyfish,
				session,
				this.getActionContext(request.data.context),
				this.library,
				{
					context: request.data.context,
					card: request.data.input.id,
					type: request.data.input.type,
					actor: request.data.actor,
					action: actionCard,
					timestamp: request.data.timestamp,
					arguments: request.data.arguments,
					epoch: request.data.epoch,
				},
			)
			.then((data) => {
				const endDate = new Date();
				logger.info(request.data.context, 'Execute success', {
					data,
					input: request.data.input,
					action: actionCard.slug,
					time: endDate.getTime() - startDate.getTime(),
				});

				return {
					error: false,
					data,
				};
			})
			.catch((error) => {
				const endDate = new Date();
				const errorObject = errio.toObject(error, {
					stack: true,
				});

				const logData = {
					error: errorObject,
					input: request.data.input,
					action: actionCard.slug,
					time: endDate.getTime() - startDate.getTime(),
				};

				if (error.expected) {
					logger.warn(request.data.context, 'Execute error', logData);
				} else {
					logger.error(request.data.context, 'Execute error', logData);
				}

				return {
					error: true,
					data: errorObject,
				};
			});

		const event = await this.consumer.postResults(
			this.getId(),
			request.data.context,
			request,
			result,
		);
		assert.INTERNAL(
			request.context,
			event,
			errors.WorkerNoExecuteEvent,
			`Could not create execute event for request: ${request.id}`,
		);

		logger.info(request.data.context, 'Execute event posted', {
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
	 * @summary Execute a worker tick
	 * @function
	 * @public
	 *
	 * @description
	 * A tick is necessary to dispatch time-triggered actions and potentially
	 * any other logic that depends on the concept of time.
	 *
	 * Applications should "tick" on a certain interval. Shorter intervals
	 * increase the accuracy of time-related actions, but introduces more
	 * overhead.
	 *
	 * The tick operation may enqueue new actions but will not execute them
	 * right away.
	 *
	 * @param {Object} context - execution context
	 * @param {String} session - session id
	 * @param {Object} options - options
	 * @param {Date} options.currentDate - current date
	 *
	 * @example
	 * const worker = new Worker({ ... })
	 * const session = '4a962ad9-20b5-4dd8-a707-bf819593cc84'
	 *
	 * await worker.tick({ ... }, session, {
	 *   currentDate: new Date()
	 * })
	 */
	async tick(
		context: LogContext,
		session: string,
		// TS-TODO: Correctly type the options here
		options: { currentDate: number },
	) {
		const currentTriggers = this.getTriggers();

		logger.debug(context, 'Processing tick request', {
			triggers: currentTriggers.length,
		});

		// TS-TODO: This code is pretty abominated and needs to be reviewed and straightened out
		await Bluebird.map(
			currentTriggers,
			async (trigger) => {
				// We don't care about non-time-triggered triggers
				if (!trigger.interval) {
					return null;
				}

				const lastExecutionEvent = await this.producer.getLastExecutionEvent(
					context,
					trigger.id,
				);
				const nextExecutionDate = triggers.getNextExecutionDate(
					{
						data: trigger as any,
					},
					lastExecutionEvent as any,
				);

				// Ignore the trigger if its not time to execute it yet
				if (
					!nextExecutionDate ||
					(options.currentDate as any) < (nextExecutionDate as any)
				) {
					return null;
				}

				// This is a time triggered action, so there
				// is no input card that caused the trigger.
				const inputCard = null;

				const request = await triggers.getRequest(
					this.jellyfish,
					trigger,
					inputCard,
					{
						currentDate: options.currentDate as any,
						context,
						session,
					},
				);

				// This can happen if the trigger contains
				// an invalid template interpolation
				if (!request) {
					return null;
				}

				return this.producer.enqueue(this.getId(), session, request as any);
			},
			{
				concurrency: 5,
			},
		);
	}
}
