/**
 * @license
 * Copyright 2016-2020 Balena Ltd.
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

import { IArg } from '@oclif/parser/lib/args';
import Command from '../../command';
import { stripIndent, getVisuals } from '../../utils/lazy';
import {
	applicationIdInfo,
} from '../../utils/messages';

import * as fs from 'fs'
import * as fetch from 'isomorphic-fetch'
import * as cf from '../../utils/common-flags';
import { flags } from '@oclif/command';
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator'

function randomName() {
	return uniqueNamesGenerator({
		dictionaries: [adjectives, colors, animals],
		separator: '-'
	})
}

interface FlagsDef {
	help: void;
	v13: boolean;
	apiKey?: string;
	region?: string;
	size?: string;
	imageName?: string;
	num?: number;
}

export default class InstanceInitCmd extends Command {
	public static description = stripIndent`
		Initialize a new balenaOS device in the cloud.

		This will upload a balenaOS image to your specific cloud provider (if it does not already exist), create a new cloud instance, and join it to the fleet with the provided config.json

		Note: depending on the instance size this can take 5-15 minutes after image upload

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena instance init digitalocean config.json --apiKey <api key>',
	];

	public static usage = 'instance init <provider> <config.json path>';

	public static args: Array<IArg<any>> = [
		{
			name: 'provider',
			description: 'the cloud provider: do | digitalocean | aws | gcp',
			required: true,
		},
		{
			name: 'configFile',
			description: 'the config.json file path',
			required: true,
		},
	];

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
		v13: cf.v13,
		apiKey: flags.string({
			description: 'DigitalOcean api key',
		}),
		region: flags.string({
			description: 'DigitalOcean region',
		}),
		size: flags.string({
			description: 'DigitalOcean droplet size',
		}),
		num: flags.integer({
			description: 'Number of instances to create',
		}),
		imageName: flags.string({
			description: 'custom image name',
		})
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, { configFile: string, provider: string }>(InstanceInitCmd);

		if (!['do', 'digitalocean'].includes(params.provider)) {
			console.error('Only DigitalOcean is supported as a provider, please use "do" or "digitalocean" as your provider positional argument.')
			return
		}

		// Check if the config file exists
		console.log('Reading config file')
		const exists = fs.existsSync(params.configFile)
		if (!exists) {
			console.log('Config file does not exist, exiting...')
			return
		}

		const configFile = JSON.parse(fs.readFileSync(params.configFile).toString())

		const imageName = options.imageName || 'balenaOS-qemux86-64'
		let skipUpload = false
		let imageID = 0
		let page = 1

		let res
		let responseBody
		let images = []
		const num = options.num || 1

		console.log(`Checking if image '${imageName}' already exists...`)

		do {
			res = await fetch(`https://api.digitalocean.com/v2/images?per_page=200&page=${page}`, {
				headers: {
					authorization: `Bearer ${options.apiKey}`
				}
			})
			responseBody = await res.json()
			for (const image of responseBody.images) {
				if (image.name === imageName) {
					console.log('Image exists, skipping upload.')
					skipUpload = true
					imageID = image.id
					break
				}
			}
			page++
			images = responseBody.images
		} while (images.length === 200)

		if (!skipUpload) {

			if (!options.apiKey) {
				console.log('DigitalOcean API key is required, please provide with --apiKey <api_key>')
			}

			console.log('Uploading image to DigitalOcean...')
			res = await fetch('https://api.digitalocean.com/v2/images', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: `Bearer ${options.apiKey}`
				},
				body: JSON.stringify({
					name: imageName,
					url: `https://api.balena-cloud.com/download?fileType=.gz&appId=1833771&deviceType=qemux86-64`,
					distribution: 'Unknown',
					region: options.region || 'nyc1',
					description: 'balenaOS custom image',
					tags: [
						'balenaOS'
					]
				})
			})
			console.log('Image uploaded.')

			const visuals = getVisuals();
			const spinner = new visuals.Spinner(
				`Waiting for image to be ready`,
			);

			responseBody = await res.json()
			imageID = responseBody.image.id
			spinner.start();
			do {
				// console.log('Waiting for image to be ready...')
				await new Promise((r) => setTimeout(() => r(null), 2000)) // Sleep for 2 seconds
				res = await fetch(`https://api.digitalocean.com/v2/images/${imageID}`, {
					headers: {
						authorization: `Bearer ${options.apiKey}`
					}
				})
				responseBody = await res.json()
			} while (responseBody.image.status !== 'available')
			// console.log('Image available.')
			spinner.stop();
		}

		console.log('Getting DigitalOcean SSH keys...')
		res = await fetch('https://api.digitalocean.com/v2/account/keys', {
			headers: {
				authorization: `Bearer ${options.apiKey}`
			}
		})
		responseBody = await res.json()

		const sshKeyID = responseBody.ssh_keys[0].id
		const dropletNames = []

		for (let i = 0; i < num; i++) {
			dropletNames.push(randomName())
		}
		console.log('Creating DigitalOcean droplets:', dropletNames.join(', '))
		res = await fetch('https://api.digitalocean.com/v2/droplets', {
			method: 'POST',
			body: JSON.stringify({
				names: dropletNames,
				region: options.region || 'nyc1',
				size: options.size || 's-2vcpu-4gb',
				image: imageID,
				ssh_keys: [sshKeyID],
				user_data: JSON.stringify(configFile),
				tags: [
					'balenaOS'
				]
			}),
			headers: {
				authorization: `Bearer ${options.apiKey}`,
				'content-type': 'application/json'
			}
		})
		responseBody = await res.json()

		const visuals = getVisuals();
		const spinner = new visuals.Spinner(
			`Waiting for droplets to be created`,
		);

		spinner.start();
		// God tier code incoming
		await Promise.all(responseBody.links.actions.map(async (action: any) => {
			let respBody: any
			do {
				await new Promise((r) => setTimeout(() => r(null), 2000)) // Sleep for 2 seconds
				const waitResp = await fetch(action.href, {
					headers: {
						authorization: `Bearer ${options.apiKey}`
					}
				})
				respBody = await waitResp.json()
				if (respBody.action.status === 'errored') {
					throw new Error('Error creating droplet')
				}
			} while (respBody.action.status !== 'completed')
		}))
		spinner.stop();

		console.log('Done! The device should appear in your Dashboard in a few minutes!')

	}
}
