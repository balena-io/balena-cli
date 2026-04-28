import { expect } from 'chai';
import * as path from 'path';

import { isBuildConfig, parseComposePaths } from '../../build/utils/compose_ts';
import { createProject } from '../../build/utils/compose';

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
