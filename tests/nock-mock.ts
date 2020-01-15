/**
 * @license
 * Copyright 2020 Balena Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { configureBluebird } from '../build/app-common';

configureBluebird();

import * as _ from 'lodash';
import * as nock from 'nock';

export interface ScopeOpts {
	optional?: boolean;
	persist?: boolean;
}

/**
 * Base class for tests using nock to intercept HTTP requests.
 * Subclasses include BalenaAPIMock, DockerMock and BuilderMock.
 */
export class NockMock {
	public readonly scope: nock.Scope;
	// Expose `scope` as `expect` to allow for better semantics in tests
	public readonly expect = this.scope;
	protected static instanceCount = 0;

	constructor(public basePathPattern: string | RegExp) {
		if (NockMock.instanceCount === 0) {
			if (!nock.isActive()) {
				nock.activate();
			}
			nock.emitter.on('no match', this.handleUnexpectedRequest);
		} else if (process.env.DEBUG) {
			console.error(
				`[debug] NockMock.constructor() instance count is ${
					NockMock.instanceCount
				}`,
			);
		}
		NockMock.instanceCount += 1;
		this.scope = nock(this.basePathPattern);
	}

	public optGet(
		uri: string | RegExp | ((uri: string) => boolean),
		opts: ScopeOpts,
	): nock.Interceptor {
		opts = _.assign({ optional: false, persist: false }, opts);
		const get = (opts.persist ? this.scope.persist() : this.scope).get(uri);
		return opts.optional ? get.optionally() : get;
	}

	public optDelete(
		uri: string | RegExp | ((uri: string) => boolean),
		opts: ScopeOpts,
	) {
		opts = _.assign({ optional: false, persist: false }, opts);
		const del = (opts.persist ? this.scope.persist() : this.scope).delete(uri);
		return opts.optional ? del.optionally() : del;
	}

	public optPatch(
		uri: string | RegExp | ((uri: string) => boolean),
		opts: ScopeOpts,
	) {
		opts = _.assign({ optional: false, persist: false }, opts);
		const patch = (opts.persist ? this.scope.persist() : this.scope).patch(uri);
		return opts.optional ? patch.optionally() : patch;
	}

	public optPost(
		uri: string | RegExp | ((uri: string) => boolean),
		opts: ScopeOpts,
	) {
		opts = _.assign({ optional: false, persist: false }, opts);
		const post = (opts.persist ? this.scope.persist() : this.scope).post(uri);
		return opts.optional ? post.optionally() : post;
	}

	public done() {
		try {
			// scope.done() will throw an error if there are expected api calls that have not happened.
			// So ensure that all expected calls have been made.
			this.scope.done();
		} finally {
			const count = NockMock.instanceCount - 1;
			if (count < 0 && process.env.DEBUG) {
				console.error(
					`[debug] Warning: NockMock.instanceCount is negative (${count})`,
				);
			}
			NockMock.instanceCount = Math.max(0, count);
			if (NockMock.instanceCount === 0) {
				// Remove 'no match' handler, for tests using nock without this module
				nock.emitter.removeAllListeners('no match');
				nock.cleanAll();
				nock.restore();
			} else if (process.env.DEBUG) {
				console.error(
					`[debug] NockMock.done() instance count is ${NockMock.instanceCount}`,
				);
			}
		}
	}

	protected handleUnexpectedRequest(req: any) {
		const o = req.options || {};
		const u = o.uri || {};
		console.error(
			`Unexpected http request!: ${req.method} ${o.proto ||
				u.protocol}//${o.host || u.host}${req.path || o.path || u.path}`,
		);
		// Errors thrown here are not causing the tests to fail for some reason.
		// Possibly due to CLI global error handlers? (error.js)
		// (Also, nock should automatically throw an error, but also not happening)
		// For now, the console.error is sufficient (will fail the test)
	}

	// For debugging tests
	get unfulfilledCallCount(): number {
		return this.scope.pendingMocks().length;
	}

	public debug() {
		const scope = this.scope;
		let mocks = scope.pendingMocks();
		console.error(`pending mocks ${mocks.length}: ${mocks}`);

		this.scope.on('request', function(_req, _interceptor, _body) {
			console.log(`>> REQUEST:` + _req.path);
			mocks = scope.pendingMocks();
			console.error(`pending mocks ${mocks.length}: ${mocks}`);
		});

		this.scope.on('replied', function(_req) {
			console.log(`<< REPLIED:` + _req.path);
		});
	}
}
