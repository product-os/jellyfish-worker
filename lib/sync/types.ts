import type { LogContext } from '@balena/jellyfish-logger';
import type { Contract } from '@balena/jellyfish-types/build/core';
import type { Operation } from 'fast-json-patch';
import type { Map } from '../types';
import type { SyncActionContext } from './sync-context';

export interface ActorInformation {
	handle: any;
	email: any;
	title: any;
	company: any;
	country: any;
	city: any;
	active: any;
}

export interface PipelineOpts {
	actor: string;
	origin: string;
	defaultUser: string;
	provider: string;
	token: any;
	context: SyncActionContext;
}

export interface SequenceItem {
	time: Date;
	actor: string;
	/**
	 * If this is set, we don't set an originator when inserting this card.
	 * This treats this as a new request.
	 * This is being used to allow inserting contracts as part of a translate which
	 * should be mirrored again.
	 */
	skipOriginator?: boolean;
	card:
		| (Partial<Contract> & Pick<Contract, 'slug' | 'type'>)
		| {
				id: string;
				type: string;
				patch: Operation[];
		  };
}

// TS-TODO: Properly type any arguments.
export interface Integration {
	destroy: () => Promise<any>;

	translate: (
		contract: Contract,
		options: { actor: string },
	) => Promise<SequenceItem[]>;

	mirror: (
		contract: Contract,
		options: { actor: string },
	) => Promise<SequenceItem[]>;

	getFile?: (file: string) => Promise<Buffer>;
}

export interface IntegrationInitializationOptions {
	token: any;
	defaultUser: string;
	context: {
		log: SyncActionContext['log'];
		getRemoteUsername: SyncActionContext['getRemoteUsername'];
		getLocalUsername: SyncActionContext['getLocalUsername'];
		getElementBySlug: SyncActionContext['getElementBySlug'];
		getElementById: SyncActionContext['getElementById'];
		getElementByMirrorId: SyncActionContext['getElementByMirrorId'];
		request: (
			actor: boolean,
			requestOptions: any,
		) => Promise<{ code: number; body: any }>;
		getActorId: (information: ActorInformation) => Promise<string>;
	};
}

export interface IntegrationDefinition {
	OAUTH_BASE_URL?: string;
	OAUTH_SCOPES?: string[];

	initialize: (
		options: IntegrationInitializationOptions,
	) => Promise<Integration>;

	isEventValid: (
		logContext: LogContext,
		token: any,
		rawEvent: any,
		headers: Map<string>,
	) => boolean;

	whoami?: (context: SyncActionContext, credentials: any) => Promise<any>;

	match?: (
		context: SyncActionContext,
		externalUser: any,
		options: { slug: string },
	) => Promise<Contract | null>;

	getExternalUserSyncEventData?: (
		logContext: LogContext,
		externalUser: any,
	) => Promise<any>;
}
