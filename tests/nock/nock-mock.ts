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

import nock from 'nock';
import * as fs from 'fs';
import { interceptorServerPort } from './proxy-server';

export interface ScopeOpts {
	optional?: boolean;
	persist?: boolean;
	times?: number;
}

/**
 * Base class for tests using nock to intercept HTTP requests.
 * Subclasses include BalenaAPIMock, DockerMock and BuilderMock.
 */
export class NockMock {
	public readonly scope: nock.Scope;
	// Expose `scope` as `expect` to allow for better semantics in tests
	public readonly expect;
	protected static instanceCount = 0;

	constructor(
		public basePathPattern: string | RegExp,
		public allowUnmocked: boolean = false,
	) {
		if (NockMock.instanceCount === 0) {
			if (!nock.isActive()) {
				nock.activate();
			}
			nock.emitter.on('no match', this.handleUnexpectedRequest);
		} else if (process.env.DEBUG) {
			console.error(
				`[debug] NockMock.constructor() instance count is ${NockMock.instanceCount}`,
			);
		}
		NockMock.instanceCount += 1;
		this.scope = nock(this.basePathPattern, { allowUnmocked });
		this.expect = this.scope;
	}

	public optMethod(
		method: 'get' | 'delete' | 'patch' | 'post',
		uri: string | RegExp | ((uri: string) => boolean),
		{ optional = false, persist = false, times = undefined }: ScopeOpts,
	) {
		let scope = this.scope;
		if (persist) {
			scope = scope.persist();
		}
		let reqInterceptor = scope[method](uri);
		if (times != null) {
			reqInterceptor = reqInterceptor.times(times);
		} else if (optional) {
			reqInterceptor = reqInterceptor.optionally();
		}
		return reqInterceptor;
	}

	public optGet(
		uri: string | RegExp | ((uri: string) => boolean),
		opts: ScopeOpts,
	): nock.Interceptor {
		return this.optMethod('get', uri, opts);
	}

	public optDelete(
		uri: string | RegExp | ((uri: string) => boolean),
		opts: ScopeOpts,
	) {
		return this.optMethod('delete', uri, opts);
	}

	public optPatch(
		uri: string | RegExp | ((uri: string) => boolean),
		opts: ScopeOpts,
	) {
		return this.optMethod('patch', uri, opts);
	}

	public optPost(
		uri: string | RegExp | ((uri: string) => boolean),
		opts: ScopeOpts,
	) {
		return this.optMethod('post', uri, opts);
	}

	protected inspectNoOp(_uri: string, _requestBody: nock.Body): void {
		return undefined;
	}

	protected getInspectedReplyBodyFunction(
		inspectRequest: (uri: string, requestBody: nock.Body) => void,
		replyBody: nock.ReplyBody,
	) {
		return function (
			this: nock.ReplyFnContext,
			uri: string,
			requestBody: nock.Body,
			cb: (err: NodeJS.ErrnoException | null, result: nock.ReplyBody) => void,
		) {
			try {
				inspectRequest(uri, requestBody);
			} catch (err) {
				cb(err, '');
			}
			cb(null, replyBody);
		};
	}

	protected getInspectedReplyFileFunction(
		inspectRequest: (uri: string, requestBody: nock.Body) => void,
		replyBodyFile: string,
	) {
		return function (
			this: nock.ReplyFnContext,
			uri: string,
			requestBody: nock.Body,
			cb: (err: NodeJS.ErrnoException | null, result: nock.ReplyBody) => void,
		) {
			try {
				inspectRequest(uri, requestBody);
			} catch (err) {
				cb(err, '');
			}

			const replyBody = fs.readFileSync(replyBodyFile);
			cb(null, replyBody);
		};
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
		const method = req.method;
		const proto = req.protocol || req.proto || o.proto || u.protocol;
		const host = req.host || req.headers?.host || o.host || u.host;
		const path = req.path || o.path || u.path;

		// Requests made by the local proxy/interceptor server are OK
		if (host === `127.0.0.1:${interceptorServerPort}`) {
			return;
		}
		console.error(
			`NockMock: Unexpected HTTP request: ${method} ${proto}//${host}${path}`,
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

		this.scope.on('request', function (_req, _interceptor, _body) {
			console.log(`>> REQUEST:` + _req.path);
			mocks = scope.pendingMocks();
			console.error(`pending mocks ${mocks.length}: ${mocks}`);
		});

		this.scope.on('replied', function (_req) {
			console.log(`<< REPLIED:` + _req.path);
		});
	}
}
