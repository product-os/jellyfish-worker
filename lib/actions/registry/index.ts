import { defaultEnvironment } from '@balena/jellyfish-environment';
import { getLogger, LogContext } from '@balena/jellyfish-logger';
import type { ContractSummary } from 'autumndb';
import axios from 'axios';
import { TypedError } from 'typed-error';

const logger = getLogger(__filename);

const mimeType = {
	dockerManifest: 'application/vnd.docker.distribution.manifest.v2+json',
	ociManifest: 'application/vnd.oci.image.manifest.v1+json',
};

/**
 * This function uploads an existing manifest to another name, effectively
 * creating a secondary tag for the same image/artifact
 *
 * @param logContext logging context
 * @param src new contract with the new version to tag for
 * @param target existing contract to be retagged
 * @param userSlug user who shall access the registry
 * @param session session id of given user
 */
export const retagArtifact = async (
	logContext: LogContext,
	src: ContractSummary,
	target: ContractSummary,
	userSlug: string,
	session: string,
) => {
	// This function should do the same as the following curl statements
	// curl registry.ly.fish.local/v2/transformer-service-source2multi-arch-service/manifests/1.0.0-with-contract  -v -X PUT
	// < Www-Authenticate: Bearer realm="http://api.ly.fish.local/api/v2/registry",service="registry.ly.fish.local",scope="repository:transformer-service-source2multi-arch-service:push,pull"
	// export TOKEN=$(curl -v -u USER_SLUG:SESSION_TOKEN 'http://api.ly.fish.local/api/v2/registry?service=registry.ly.fish.local&scope=repository:transformer-service-source2multi-arch-service:pull,push' | jq -j .token)
	// curl -H "Authorization: bearer $TOKEN" registry.ly.fish.local/v2/transformer-service-source2multi-arch-service/manifests/1.0.0-with-contract  -H 'accept: application/vnd.docker.distribution.manifest.v2+json' -v | jq .
	// curl -H "Authorization: bearer $TOKEN" registry.ly.fish.local/v2/transformer-service-source2multi-arch-service/manifests/1.0.0-with-contract -X PUT -H 'content-type: application/vnd.docker.distribution.manifest.v2+json' -d '@manifest-1.0.0.json' -v

	const srcManifestUrl = manifestUrl(src);
	const targetManifestUrl = manifestUrl(target);

	if (!defaultEnvironment.registry.host) {
		throw new Error('Registry env vars not set');
	}

	if (defaultEnvironment.registry.insecureHttp) {
		logger.warn(
			logContext,
			`Communicating with registry insecurely - this should only happen locally`,
		);
	}

	try {
		// get login URL
		const deniedRegistryResp = await axios.put(
			srcManifestUrl,
			{},
			{ validateStatus: (status) => status === 403 || status === 401 },
		);
		const wwwAuthenticate = deniedRegistryResp.headers['www-authenticate'];
		if (deniedRegistryResp.status !== 401 || !wwwAuthenticate) {
			throw new Error(
				`Registry didn't ask for authentication (status code ${deniedRegistryResp.status})`,
			);
		}
		const { realm, service, scope } = parseWwwAuthenticate(wwwAuthenticate);
		const authUrl = new URL(realm);
		authUrl.searchParams.set('service', service);
		authUrl.searchParams.set('scope', scope);

		// login with session user
		const loginResp: any = await axios.get(authUrl.href, {
			auth: { username: userSlug, password: session },
		});
		if (!loginResp.data.token) {
			throw new Error(
				`Couldn't log in for registry (status code ${loginResp.status})`,
			);
		}

		// get source manifest
		const srcManifestResp = await axios.get(srcManifestUrl, {
			headers: {
				Authorization: `bearer ${loginResp.data.token}`,
				Accept: [mimeType.dockerManifest, mimeType.ociManifest].join(','),
			},
		});

		// push target manifest
		await axios.put(targetManifestUrl, srcManifestResp.data, {
			headers: {
				Authorization: `bearer ${loginResp.data.token}`,
				'Content-Type': srcManifestResp.headers['content-type'],
			},
		});
	} catch (err: any) {
		// Axios' error object trips our logger, so we need to manually use toJSON
		throw new RegistryCommunicationError(err.toJSON ? err.toJSON() : err, {
			host: defaultEnvironment.registry.host,
			insecure: defaultEnvironment.registry.insecureHttp,
		});
	}
};

export class RegistryCommunicationError extends TypedError {
	constructor(
		public cause: Error,
		public registryConfig: { host: string; insecure: boolean },
	) {
		super(cause);
	}
}

const registrySchema = defaultEnvironment.registry.insecureHttp
	? 'http://'
	: 'https://';

const manifestUrl = (card: ContractSummary) =>
	`${registrySchema}${defaultEnvironment.registry.host}/v2/${card.slug}/manifests/${card.version}`;

const parseWwwAuthenticate = (wwwAuthenticate: any) => {
	return {
		realm: (/realm="([^"]+)/.exec(wwwAuthenticate) || [])[1],
		service: (/service="([^"]+)/.exec(wwwAuthenticate) || [])[1],
		scope: (/scope="([^"]+)/.exec(wwwAuthenticate) || [])[1],
	};
};
