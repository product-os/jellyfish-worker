import type { LogContext } from '@balena/jellyfish-logger';
import type { Contract } from 'autumndb';
import type { Method } from 'axios';
import type { Operation } from 'fast-json-patch';
import type { Map } from '../types';
import type { SyncActionContext } from './sync-context';

export interface ActorInformation {
	handle: string;
	email?: string;
	title?: string;
	company?: string;
	country?: string;
	city?: string;
	active?: boolean;
	name?: {
		first?: string;
		last?: string;
	};
}

export interface PipelineOpts {
	actor: string;
	defaultUser: string;
	token: any;
	context: SyncActionContext;
}

export interface SequenceItem {
	time: Date;
	actor: string;
	/**
	 * If this is set, we don't set an originator when inserting this contract.
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

export interface HttpRequestOptions {
	method: Method;
	baseUrl: string;
	json?: boolean;
	uri: string;
	headers?: {
		[key: string]: string;
	};
	data?: {
		[key: string]: any;
	};
	useQuerystring?: boolean;
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
		getContactByEmail: SyncActionContext['getContactByEmail'];
		getElementByMirrorId: SyncActionContext['getElementByMirrorId'];
		getElementByMirrorIds: SyncActionContext['getElementByMirrorIds'];
		request: (
			actor: string,
			requestOptions: HttpRequestOptions,
		) => Promise<{ code: number; body: any }>;
		getActorId: (information: ActorInformation) => Promise<string>;
		query: SyncActionContext['query'];
	};
}

export interface IntegrationDefinition {
	slug: string;

	initialize: (
		options: IntegrationInitializationOptions,
	) => Promise<Integration>;

	isEventValid: (
		logContext: LogContext,
		token: any,
		rawEvent: any,
		headers: Map<string>,
	) => Promise<boolean> | boolean;

	whoami?: (
		syncActionContext: SyncActionContext,
		credentials: any,
	) => Promise<any>;

	match?: (
		context: SyncActionContext,
		externalUser: any,
		options: { slug: string },
	) => Promise<Contract | null>;

	getExternalUserSyncEventData?: (
		logContext: LogContext,
		externalUser: any,
	) => Promise<any>;

	mergeCardWithPayload?: (
		preExistingCard: any,
		payload: any,
		resourceType: string,
		cardType: string,
	) => any;
}
