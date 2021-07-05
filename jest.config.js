/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const base = require('@balena/jellyfish-config/config/jest.config')

module.exports = {
	...base,
	testTimeout: 30000
};
