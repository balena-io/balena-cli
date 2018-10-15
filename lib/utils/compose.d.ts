import * as Bluebird from 'bluebird';
import * as Stream from 'stream';
import { Composition } from 'resin-compose-parse';
import Logger = require('./logger');

interface Image {
	context: string;
	tag: string;
}

interface Descriptor {
	image: Image | string;
	serviceName: string;
}

export function resolveProject(projectRoot: string): Bluebird<string>;

export interface ComposeProject {
	path: string;
	name: string;
	composition: Composition;
	descriptors: Descriptor[];
}

export function loadProject(
	logger: Logger,
	projectPath: string,
	projectName: string,
	image?: string,
): Bluebird<ComposeProject>;

export function tarDirectory(source: string): Promise<Stream.Readable>;
