import _ from 'lodash';
import * as semver from 'semver';
import type { Plugin } from './plugin';
import type { IntegrationDefinition } from '../sync/types';
import type { Map } from '../types';

const validateDependencies = (plugins: Map<Plugin>) => {
	_.forEach(plugins, (plugin) => {
		_.forEach(plugin.requires, ({ slug, version }) => {
			const dependency = plugins[slug];
			if (!semver.validRange(version)) {
				throw new Error(
					`Cannot load plugin '${plugin.slug}' (${plugin.name}) ` +
						`because it specifies an invalid version (${version}) for the dependency on '${slug}'`,
				);
			}
			if (!dependency) {
				throw new Error(
					`Cannot load plugin '${plugin.slug}' (${plugin.name}) ` +
						`because a plugin it depends on (${slug}) is not loaded`,
				);
			} else if (
				!semver.satisfies(dependency.version, version, {
					includePrerelease: true,
				})
			) {
				throw new Error(
					`Cannot load plugin '${plugin.slug}' (${plugin.name}) ` +
						`because a plugin it depends on (${slug}@${version}) is not loaded`,
				);
			}
		});
	});
};

const mergeMaps = <T>(maps: Map<Map<T>>): Map<T> => {
	const merged = {};
	for (const [pluginSlug, map] of Object.entries(maps)) {
		for (const [key, value] of Object.entries(map)) {
			if (key in merged) {
				throw new Error(
					`'${key}' already exists and cannot be loaded from plugin '${pluginSlug}'`,
				);
			}

			merged[key] = value;
		}
	}

	return merged;
};

export class PluginManager {
	private pluginMap: Map<Plugin>;

	constructor(pluginBuilders: Array<() => Plugin>) {
		this.pluginMap = {};
		for (const pluginBuilder of pluginBuilders) {
			const plugin = pluginBuilder();
			if (plugin.slug in this.pluginMap) {
				throw new Error(`Duplicate plugin: ${plugin.slug}`);
			}

			this.pluginMap[plugin.slug] = plugin;
		}

		validateDependencies(this.pluginMap);
	}

	getCards() {
		return mergeMaps(
			_.mapValues(this.pluginMap, (plugin: Plugin) => plugin.getCards()),
		);
	}

	getSyncIntegrations(): Map<IntegrationDefinition> {
		return mergeMaps<IntegrationDefinition>(
			_.mapValues(this.pluginMap, (plugin: Plugin) =>
				plugin.getSyncIntegrations(),
			),
		);
	}

	getActions() {
		return mergeMaps(
			_.mapValues(this.pluginMap, (plugin: Plugin) => plugin.getActions()),
		);
	}
}
