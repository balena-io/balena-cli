import { expect } from 'chai';
import * as sinon from 'sinon';
import * as path from 'path';

import { isBuildConfig, parseComposePaths } from '../../build/utils/compose_ts';
import { createProject, pushProgressRenderer } from '../../build/utils/compose';

const projectsPath = path.join(
	__dirname,
	'..',
	'test-data',
	'projects',
	'docker-compose',
);

describe('parseComposePaths()', function () {
	it('should parse a valid compose file', async function () {
		const composePath = path.join(projectsPath, 'basic', 'docker-compose.yml');
		const composition = await parseComposePaths(composePath);
		expect(composition).to.have.property('services');
		expect(composition.services).to.have.property('service1');
		expect(composition.services).to.have.property('service2');
	});

	it('should include the file path in the error when parsing fails', async function () {
		const badPath = '/nonexistent/docker-compose.yml';
		try {
			await parseComposePaths(badPath);
			expect.fail('should have thrown');
		} catch (err: any) {
			expect(err.message).to.include(
				`Error parsing composition file "${badPath}"`,
			);
		}
	});

	it('should include all file paths in the error for multi-file parsing', async function () {
		const validPath = path.join(projectsPath, 'basic', 'docker-compose.yml');
		const badPath = '/nonexistent/docker-compose.dev.yml';
		try {
			await parseComposePaths([validPath, badPath]);
			expect.fail('should have thrown');
		} catch (err: any) {
			expect(err.message).to.include(validPath);
			expect(err.message).to.include(badPath);
		}
	});

	it('should populate tags on build config descriptors in createProject', async function () {
		const composePath = path.join(projectsPath, 'basic', 'docker-compose.yml');
		const composition = await parseComposePaths(composePath);
		const project = createProject(composePath, composition);
		for (const d of project.descriptors) {
			if (isBuildConfig(d.image)) {
				expect(d.image.tags).to.be.an('array').that.is.not.empty;
				expect(d.image.tags![0]).to.be.a('string').that.is.not.empty;
			}
		}
	});

	it('should merge a dev overlay with the base compose file', async function () {
		const basePath = path.join(
			projectsPath,
			'dev-overlay',
			'docker-compose.yml',
		);
		const devPath = path.join(
			projectsPath,
			'dev-overlay',
			'docker-compose.dev.yml',
		);
		const composition = await parseComposePaths([basePath, devPath]);
		expect(composition.services).to.have.property('service1');
		expect(composition.services).to.have.property('service2');
		// service1 should have the environment from the dev overlay merged in
		expect(composition.services.service1.environment).to.deep.include({
			DEBUG: '1',
		});
		// service1 should still have its build context from the base file
		expect(composition.services.service1.build).to.have.property('context');
	});
});

describe('pushProgressRenderer()', function () {
	function createMockTty() {
		return {
			replaceLine: sinon.stub(),
			clearLine: sinon.stub(),
			writeLine: sinon.stub(),
			write: sinon.stub(),
			currentWindowSize: sinon.stub().returns({ width: 80, height: 24 }),
			hideCursor: sinon.stub(),
			showCursor: sinon.stub(),
			cursorUp: sinon.stub(),
			cursorDown: sinon.stub(),
			deleteToEnd: sinon.stub(),
			stream: process.stdout,
		};
	}

	let clock: sinon.SinonFakeTimers;
	let originalIsTTY: boolean | undefined;

	beforeEach(function () {
		clock = sinon.useFakeTimers({ now: Date.now(), shouldAdvanceTime: false });
		originalIsTTY = process.stdout.isTTY;
		Object.defineProperty(process.stdout, 'isTTY', {
			value: true,
			writable: true,
			configurable: true,
		});
	});

	afterEach(function () {
		clock.restore();
		Object.defineProperty(process.stdout, 'isTTY', {
			value: originalIsTTY,
			writable: true,
			configurable: true,
		});
	});

	it('should render prefix and percentage', function () {
		const mockTty = createMockTty();
		const renderer = pushProgressRenderer(mockTty as any, '[Push] ');
		renderer({ percentage: 50 });
		const line = mockTty.replaceLine.firstCall.args[0] as string;
		expect(line).to.include('[Push] ');
		expect(line).to.include('50%');
	});

	it('should clamp percentage above 100 to 100%', function () {
		const mockTty = createMockTty();
		const renderer = pushProgressRenderer(mockTty as any, '[Push] ');
		renderer({ percentage: 150 });
		const line = mockTty.replaceLine.firstCall.args[0] as string;
		expect(line).to.include('100%');
		expect(line).to.not.include('150%');
	});

	it('should show elapsed time', function () {
		const mockTty = createMockTty();
		const renderer = pushProgressRenderer(mockTty as any, '[Push] ');
		clock.tick(10000);
		renderer({ percentage: 50 });
		const line = mockTty.replaceLine.firstCall.args[0] as string;
		expect(line).to.include('(0:10)');
	});

	it('should show M:SS format for long uploads', function () {
		const mockTty = createMockTty();
		const renderer = pushProgressRenderer(mockTty as any, '[Push] ');
		clock.tick(90000);
		renderer({ percentage: 75 });
		const line = mockTty.replaceLine.firstCall.args[0] as string;
		expect(line).to.include('(1:30)');
	});

	it('should use writeLine in non-TTY mode', function () {
		Object.defineProperty(process.stdout, 'isTTY', {
			value: undefined,
			writable: true,
			configurable: true,
		});
		const mockTty = createMockTty();
		const renderer = pushProgressRenderer(mockTty as any, '[Push] ');
		renderer({ percentage: 50 });
		expect(mockTty.writeLine.called).to.be.true;
		expect(mockTty.replaceLine.called).to.be.false;
	});

	it('should throw on error event', function () {
		const mockTty = createMockTty();
		const renderer = pushProgressRenderer(mockTty as any, '[Push] ');
		expect(() => {
			renderer({ error: 'push failed' });
		}).to.throw('push failed');
	});
});
