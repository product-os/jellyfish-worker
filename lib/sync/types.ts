import type { LogContext } from '@balena/jellyfish-logger';
import type { Contract } from '@balena/jellyfish-types/build/core';
import type { Operation } from 'fast-json-patch';
import type { Map } from '../types';
import type { Logger, SyncActionContext } from './context';
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
	) => Promise<boolean> | boolean;
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

export interface IntegrationInitializationOptions {
	token: any;
	defaultUser: string;
	context: {
		logger: Logger;
		getLocalUsername: (username: string) => string;
		getRemoteUsername: (username: string) => string;
		getElementBySlug: (
			slug: string,
			usePrivilegedSession?: boolean,
		) => Promise<Contract | null>;
		getElementById: (id: string) => Promise<Contract | null>;
		getElementByMirrorId: (
			type: string,
			mirrorId: string,
			options: { usePattern?: boolean },
		) => Promise<Contract | null>;
		request: <T>(
			actorId: string,
			requestOptions: any,
		) => Promise<{ code: number; body: T }>;
		getActorId: (information: ActorInformation) => Promise<string>;
	};
}

// TS-TODO: Properly type any arguments.
export interface Integration {
	destroy: () => Promise<void>;
	translate: (
		contract: Contract,
		options: { actor: string },
	) => Promise<IntegrationExecutionResult[]>;
	mirror: (
		contract: Contract,
		options: { actor: string },
	) => Promise<IntegrationExecutionResult[]>;
	getFile?: (file: string) => Promise<Buffer>;
}

export interface IntegrationExecutionOptions {
	actor: string;
	origin: string;
	defaultUser: string;
	provider: string;
	token: any;
}

export interface IntegrationExecutionResult {
	time: Date;
	actor: string;
	/**
	 * If this is set, we don't set an originator when inserting this card.
	 * This treats this as a new request.
	 * This is being used to allow inserting contracts as part of a translate which
	 * should be mirrored again.
	 */
	skipOriginator?: boolean;
	contract:
		| (Partial<Contract> & Pick<Contract, 'slug' | 'type'>)
		| {
				id: string;
				type: string;
				patch: Operation[];
		  };
}
export interface ActorInformation {
	handle: any;
	email: any;
	title: any;
	company: any;
	country: any;
	city: any;
	active: any;
}
