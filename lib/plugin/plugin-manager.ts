import { Contract } from '@balena/jellyfish-types/build/core';
import _ from 'lodash';
import * as semver from 'semver';
import { Plugin, PluginDefinition } from './plugin';
import type { IntegrationDefinition } from '../sync/types';
import type { Action, Map } from '../types';

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

	public constructor(pluginDefinitions: PluginDefinition[]) {
		this.pluginMap = {};
		for (const pluginDefinition of pluginDefinitions) {
			if (pluginDefinition.slug in this.pluginMap) {
				throw new Error(`Duplicate plugin: ${pluginDefinition.slug}`);
			}

			this.pluginMap[pluginDefinition.slug] = new Plugin(pluginDefinition);
		}

		this.validateDependencies();
	}

	private validateDependencies() {
		_.forEach(this.pluginMap, (plugin) => {
			_.forEach(plugin.requires, ({ slug, version }) => {
				const dependency = this.pluginMap[slug];
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
	}

	public getCards(): Map<Contract> {
		return mergeMaps(
			_.mapValues(this.pluginMap, (plugin: Plugin) => plugin.getCards()),
		);
	}

	public getSyncIntegrations(): Map<IntegrationDefinition> {
		return mergeMaps<IntegrationDefinition>(
			_.mapValues(this.pluginMap, (plugin: Plugin) =>
				plugin.getSyncIntegrations(),
			),
		);
	}

	public getActions(): Map<Action> {
		return mergeMaps(
			_.mapValues(this.pluginMap, (plugin: Plugin) => plugin.getActions()),
		);
	}
}
