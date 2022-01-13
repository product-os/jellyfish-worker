import type { Contract } from '@balena/jellyfish-types/build/core';
import type { Operation } from 'fast-json-patch';
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

export interface Integration {
	initialize: () => Promise<any>;
	destroy: () => Promise<any>;
	translate: (
		contract: Contract,
		options: { actor: string },
	) => Promise<SequenceItem[]>;
	mirror: (
		contract: Contract,
		options: { actor: string },
	) => Promise<SequenceItem[]>;
	getFile: (file: string) => Promise<Buffer>;
}

export interface IntegrationConstructorParams {
	errors: any;
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

export interface IntegrationConstructor {
	OAUTH_BASE_URL?: string;
	OAUTH_SCOPES?: string[];
	isEventValid: (
		token: any,
		rawEvent: any,
		headers: { [key: string]: string },
		loggerContext: any,
	) => boolean;
	whoami?: (
		loggerContext: any,
		credentials: any,
		options: {
			errors: any;
		},
	) => null | Promise<any>;
	match?: (
		context: SyncActionContext,
		externalUser: any,
		options: {
			errors: any;
			slug: string;
		},
	) => Promise<Contract | null>;
	getExternalUserSyncEventData?: (
		loggerContext: any,
		externalUser: any,
		options: {
			errors: any;
		},
	) => Promise<any>;

	new (params: IntegrationConstructorParams): Integration;
}
