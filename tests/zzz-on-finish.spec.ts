import { expect } from 'chai';
import { notYetUsedCliOutputFilterPatterns } from './helpers';

describe('on tests finish', function () {
	it('should have no unecessary cli output exclusion patterns', () => {
		// If this fails, then it's good news.
		// To fix it just remove any printed results from cliOutputPatternsToFilteredOutFromTests.
		expect(Array.from(notYetUsedCliOutputFilterPatterns)).to.deep.equal([]);
	});
});
