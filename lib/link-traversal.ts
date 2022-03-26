import * as sdk from '@balena/jellyfish-client-sdk';
import _ from 'lodash';

// HACK: These link constraints exist between event contracts and any other contract type
// but are not explicitly defined in link-constraints. We have to add them here so that
// we can work out the reverse links for these 'event link verbs'.

const eventTypes = [
	'message',
	'whisper',
	'create',
	'update',
	'rating',
	'summary',
];

const defaultLinkConstraints: sdk.LinkConstraint[] = [];

eventTypes.reduce((acc, eventType) => {
	acc.push(
		{
			slug: `link-constraint-${eventType}-is-attached-to-any`,
			name: 'is attached to',
			data: {
				title: 'Attached to element',
				from: eventType,
				to: '*',
				inverse: `link-constraint-any-has-attached-element-${eventType}`,
			},
		},
		{
			slug: `link-constraint-any-has-attached-element-${eventType}`,
			name: 'has attached element',
			data: {
				title: `Attached ${eventType}`,
				from: '*',
				to: eventType,
				inverse: `link-constraint-${eventType}-is-attached-to-any`,
			},
		},
	);
	return acc;
}, defaultLinkConstraints);

const allLinkConstraints = _.concat(
	sdk.linkConstraints,
	defaultLinkConstraints,
);

const linkConstraintsBySlug = _.keyBy(allLinkConstraints, (lc) => lc.slug);
const inverseLinks = _.groupBy(
	allLinkConstraints,
	(lc) => linkConstraintsBySlug[lc.data.inverse].name,
);

/**
 * reverses link verbs as they are defined in the SDK.
 * If the link is not defined in the SDK, we assume it to be named
 * symmetrically.
 *
 * @param versionedSourceType - the type the link is starting from
 * @param linkVerb - the link verb to reverse
 * @returns a reverse link verbs
 */
export const reverseLink = (versionedSourceType: string, linkVerb: string) => {
	const [srcType] = versionedSourceType.split('@');
	if (!inverseLinks[linkVerb]) {
		return {};
	}
	const relevantInverseLinks = inverseLinks[linkVerb].filter(
		(l) => l.data.to === srcType || l.data.to === '*',
	);
	return _.groupBy(relevantInverseLinks, (l) => l.name);
};
