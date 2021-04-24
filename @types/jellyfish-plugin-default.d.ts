/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

declare module '@balena/jellyfish-plugin-default' {
	interface PluginInterface {
		loadCards: (arg: any) => any;
	}

	const Plugin: PluginInterface;
	export = Plugin;
}
