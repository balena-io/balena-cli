/**
 * @license
 * Copyright 2026 Balena Ltd.
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

import type * as Docker from 'dockerode';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import type { Duplex } from 'stream';
import type { AnyAuthMethod, Client, ClientCallback } from 'ssh2';

import { ExpectedError } from '../../errors';
import Logger = require('../logger');

const SSH_PORT = 22222;
const LEGACY_ENGINE_PORT = 2375;
export const SUPERVISOR_PORT = 48484;
const LOOPBACK = '127.0.0.1';
const SSH_KEEPALIVE_MS = 10000;
const ENGINE_SOCKET = '/var/run/balena-engine.sock';
const DEFAULT_TIMEOUT_MS = 10000;
const WINDOWS_OPENSSH_AGENT = '\\\\.\\pipe\\openssh-ssh-agent';
const DEFAULT_KEY_FILES = ['id_ed25519', 'id_ecdsa', 'id_rsa'];
const CONFIG_JSON_PATH = '/mnt/boot/config.json';

export type DeviceTransport = 'ssh' | 'tcp';

/**
 * A connection to a local device's balenaEngine and supervisor API.
 */
export interface DeviceConnection {
	docker: Docker;
	// Pass to DeviceAPI so supervisor requests use the same transport
	supervisorAgent: http.Agent;
	transport: DeviceTransport;
	isDevelopmentMode(): Promise<boolean>;
	close(): void;
}

export class DeviceUnreachableError extends ExpectedError {}

/**
 * Opens a new SSH channel for every HTTP connection, all multiplexed over one
 * SSH connection.
 */
class SshChannelAgent extends http.Agent {
	constructor(private openChannel: (callback: ClientCallback) => void) {
		super();
	}

	// http.Agent passes a callback here, which lets the channel open asynchronously
	public createConnection(
		_options: http.ClientRequestArgs,
		callback?: (err: Error | null, stream: Duplex) => void,
	): undefined {
		if (!callback) {
			throw new Error('SshChannelAgent needs a createConnection callback');
		}
		this.openChannel((err, stream) => {
			callback(err ?? null, stream);
		});
		return undefined;
	}
}

function getAgentPath(): string | undefined {
	if (process.env.SSH_AUTH_SOCK) {
		return process.env.SSH_AUTH_SOCK;
	}
	if (process.platform === 'win32') {
		return WINDOWS_OPENSSH_AGENT;
	}
}

async function getAuthMethods(username: string): Promise<AnyAuthMethod[]> {
	const { utils } = await import('ssh2');
	const methods: AnyAuthMethod[] = [];
	const agent = getAgentPath();
	if (agent) {
		methods.push({ type: 'agent', username, agent });
	}
	for (const file of DEFAULT_KEY_FILES) {
		const keyPath = path.join(os.homedir(), '.ssh', file);
		let key: Buffer;
		try {
			key = await fs.promises.readFile(keyPath);
		} catch {
			continue;
		}
		// Skip keys that need a passphrase; the agent covers those
		if (utils.parseKey(key) instanceof Error) {
			Logger.getLogger().logDebug(`Skipping unusable SSH key ${keyPath}`);
			continue;
		}
		methods.push({ type: 'publickey', username, key });
	}
	return methods;
}

function execOverSsh(client: Client, cmd: string): Promise<string> {
	return new Promise((resolve, reject) => {
		client.exec(cmd, (err, stream) => {
			if (err) {
				reject(err);
				return;
			}
			let stdout = '';
			stream.on('data', (data: Buffer) => (stdout += data.toString()));
			stream.stderr.resume();
			stream.once('close', (code: number | null) => {
				if (code !== 0) {
					reject(new Error(`'${cmd}' exited with code ${code}`));
					return;
				}
				resolve(stdout);
			});
		});
	});
}

async function connectSsh(
	host: string,
	username: string,
	timeout: number,
): Promise<Client> {
	const { Client: SshClient } = await import('ssh2');
	const authHandler = await getAuthMethods(username);
	return new Promise((resolve, reject) => {
		const client = new SshClient();
		client.once('ready', () => {
			resolve(client);
		});
		client.once('error', reject);
		client.connect({
			host,
			port: SSH_PORT,
			username,
			authHandler,
			readyTimeout: timeout,
			// Detects a lost device during long log streams
			keepaliveInterval: SSH_KEEPALIVE_MS,
		});
	});
}

// A dockerode request timeout would also cut off long builds, so the timeout
// applies to this first ping only
async function pingWithin(docker: Docker, timeout: number): Promise<void> {
	let timer: NodeJS.Timeout | undefined;
	try {
		await Promise.race([
			docker.ping(),
			new Promise((_resolve, reject) => {
				timer = setTimeout(() => {
					reject(new Error(`No engine response within ${timeout} ms`));
				}, timeout);
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Usernames to try, in order. balenaOS maps a balenaCloud username to root and
 * authorizes it with the keys registered in balenaCloud.
 */
async function getCandidateUsernames(): Promise<string[]> {
	const { getCachedUsername } = await import('../bootstrap');
	const cloudUsername = (await getCachedUsername())?.username;
	return cloudUsername ? ['root', cloudUsername] : ['root'];
}

async function connectOverSsh(
	host: string,
	timeout: number,
): Promise<DeviceConnection> {
	const Docker = await import('dockerode');
	let lastError: Error | undefined;
	for (const username of await getCandidateUsernames()) {
		let client: Client;
		try {
			client = await connectSsh(host, username, timeout);
		} catch (err) {
			Logger.getLogger().logDebug(
				`SSH connection to ${username}@${host}:${SSH_PORT} failed: ${err}`,
			);
			lastError = err;
			continue;
		}
		// host and port only stop docker-modem defaulting to the local socket;
		// the agent carries every request over SSH
		const docker = new Docker({
			protocol: 'http',
			host,
			port: SSH_PORT,
			agent: new SshChannelAgent((callback) =>
				client.openssh_forwardOutStreamLocal(ENGINE_SOCKET, callback),
			),
		} as Docker.DockerOptions);
		try {
			await pingWithin(docker, timeout);
		} catch (err) {
			client.end();
			throw err;
		}
		return {
			docker,
			// The supervisor accepts connections on the device's loopback interface
			supervisorAgent: new SshChannelAgent((callback) =>
				client.forwardOut(LOOPBACK, 0, LOOPBACK, SUPERVISOR_PORT, callback),
			),
			transport: 'ssh',
			isDevelopmentMode: async () =>
				JSON.parse(await execOverSsh(client, `cat ${CONFIG_JSON_PATH}`))
					.developmentMode === true,
			close: () => client.end(),
		};
	}
	throw lastError ?? new Error('No SSH usernames to try');
}

// balenaOS releases before the engine moved behind SSH expose it unauthenticated
async function connectOverLegacyTcp(
	host: string,
	timeout: number,
): Promise<DeviceConnection> {
	const Docker = await import('dockerode');
	const docker = new Docker({ host, port: LEGACY_ENGINE_PORT });
	await pingWithin(docker, timeout);
	return {
		docker,
		// An explicit agent keeps global-agent from proxying LAN requests
		supervisorAgent: new http.Agent({ keepAlive: true, keepAliveMsecs: 1000 }),
		transport: 'tcp',
		// Older balenaOS opens this port only in development mode
		isDevelopmentMode: () => Promise.resolve(true),
		close: () => undefined,
	};
}

/**
 * Connect to balenaEngine and the supervisor API on a local device, through SSH
 * (port 22222) with the user's SSH agent or default keys. Falls back to the
 * unauthenticated TCP ports of older development images.
 */
export async function connectToDevice(
	host: string,
	timeout = DEFAULT_TIMEOUT_MS,
): Promise<DeviceConnection> {
	const logger = Logger.getLogger();
	let sshError: Error;
	try {
		return await connectOverSsh(host, timeout);
	} catch (err) {
		sshError = err;
	}
	try {
		const connection = await connectOverLegacyTcp(host, timeout);
		logger.logWarn(
			`Connected to ${host} through unauthenticated TCP ports ${LEGACY_ENGINE_PORT} and ${SUPERVISOR_PORT}. Update the device to a balenaOS release that requires SSH keys.`,
		);
		return connection;
	} catch (err) {
		logger.logDebug(`Legacy engine port ${LEGACY_ENGINE_PORT} failed: ${err}`);
	}
	const { stripIndent } = await import('../lazy');
	throw new DeviceUnreachableError(stripIndent`
		Could not connect to device ${host} through SSH port ${SSH_PORT}: ${sshError.message}
		Add your public SSH key to the "os.sshKeys" list in the device's config.json,
		or log in with 'balena login' as a user whose SSH key is registered in balenaCloud.
		The CLI uses your SSH agent, or ~/.ssh/${DEFAULT_KEY_FILES.join(', ~/.ssh/')}.`);
}

/**
 * Connect to the supervisor API only. With BALENARC_SUPERVISOR_ADDRESS set,
 * DeviceAPI talks to that address directly (e.g. a mock server in tests), so
 * no SSH connection is opened.
 */
export async function connectToSupervisor(
	host: string,
	timeout = DEFAULT_TIMEOUT_MS,
): Promise<Pick<DeviceConnection, 'supervisorAgent' | 'close'>> {
	if (process.env.BALENARC_SUPERVISOR_ADDRESS) {
		return { supervisorAgent: new http.Agent(), close: () => undefined };
	}
	return await connectToDevice(host, timeout);
}
