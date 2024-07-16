/**
 * @license
 * Copyright 2021 Balena Ltd.
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

import path from 'path';
const rootDir = path.join(import.meta.dirname, '..');
import fs from 'fs';
const manifestFile = 'oclif.manifest.json';

commandsFilePath = path.join(rootDir, manifestFile);
if (fs.existsSync(commandsFilePath)) {
	console.log('Generating shell auto completion files...');
} else {
	console.error(`generate-completion.js: Could not find "${manifestFile}"`);
	process.exitCode = 1;
	return;
}

const commandsJson = JSON.parse(fs.readFileSync(commandsFilePath, 'utf8'));

const mainCommands = [];
const additionalCommands = [];
for (const key of Object.keys(commandsJson.commands).sort()) {
	const cmd = key.split(':');
	if (cmd.length > 1) {
		additionalCommands.push(cmd);
		if (!mainCommands.includes(cmd[0])) {
			mainCommands.push(cmd[0]);
		}
	} else {
		mainCommands.push(cmd[0]);
	}
}
const mainCommandsStr = mainCommands.join(' ');

// GENERATE BASH COMPLETION FILE
bashFilePathIn = path.join(import.meta.dirname, '/templates/bash.template');
bashFilePathOut = path.join(import.meta.dirname, 'balena-completion.bash');

try {
	fs.unlinkSync(bashFilePathOut);
} catch (error) {
	process.exitCode = 1;
	return console.error(error);
}

fs.readFile(bashFilePathIn, 'utf8', function (err, data) {
	if (err) {
		process.exitCode = 1;
		return console.error(err);
	}

	data = data.replace(
		'#TEMPLATE FILE FOR BASH COMPLETION#',
		"#GENERATED FILE DON'T MODIFY#",
	);

	data = data.replace(
		/\$main_commands\$/g,
		'main_commands="' + mainCommandsStr + '"',
	);
	let subCommands = [];
	let prevElement = additionalCommands[0][0];
	additionalCommands.forEach(function (element) {
		if (element[0] === prevElement) {
			subCommands.push(element[1]);
		} else {
			const prevElement2 = prevElement.replace(/-/g, '_') + '_cmds';
			data = data.replace(
				/\$sub_cmds\$/g,
				'  ' + prevElement2 + '="' + subCommands.join(' ') + '"\n$sub_cmds$',
			);
			data = data.replace(
				/\$sub_cmds_prev\$/g,
				'      ' +
					prevElement +
					')\n        COMPREPLY=( $(compgen -W "$' +
					prevElement2 +
					'" -- $cur) )\n        ;;\n$sub_cmds_prev$',
			);
			prevElement = element[0];
			subCommands = [];
			subCommands.push(element[1]);
		}
	});
	// cleanup placeholders
	data = data.replace(/\$sub_cmds\$/g, '');
	data = data.replace(/\$sub_cmds_prev\$/g, '');

	fs.writeFile(bashFilePathOut, data, 'utf8', function (error) {
		if (error) {
			process.exitCode = 1;
			return console.error(error);
		}
	});
});

// GENERATE ZSH COMPLETION FILE
zshFilePathIn = path.join(import.meta.dirname, '/templates/zsh.template');
zshFilePathOut = path.join(import.meta.dirname, '_balena');

try {
	fs.unlinkSync(zshFilePathOut);
} catch (error) {
	process.exitCode = 1;
	return console.error(error);
}

fs.readFile(zshFilePathIn, 'utf8', function (err, data) {
	if (err) {
		process.exitCode = 1;
		return console.error(err);
	}

	data = data.replace(
		'#TEMPLATE FILE FOR ZSH COMPLETION#',
		"#GENERATED FILE DON'T MODIFY#",
	);

	data = data.replace(
		/\$main_commands\$/g,
		'main_commands=( ' + mainCommandsStr + ' )',
	);
	let subCommands = [];
	let prevElement = additionalCommands[0][0];
	additionalCommands.forEach(function (element) {
		if (element[0] === prevElement) {
			subCommands.push(element[1]);
		} else {
			const prevElement2 = prevElement.replace(/-/g, '_') + '_cmds';
			data = data.replace(
				/\$sub_cmds\$/g,
				'  ' + prevElement2 + '=( ' + subCommands.join(' ') + ' )\n$sub_cmds$',
			);
			data = data.replace(
				/\$sub_cmds_prev\$/g,
				'      "' +
					prevElement +
					'")\n        _describe -t ' +
					prevElement2 +
					" '" +
					prevElement +
					"_cmd' " +
					prevElement2 +
					' "$@" && ret=0\n      ;;\n$sub_cmds_prev$',
			);
			prevElement = element[0];
			subCommands = [];
			subCommands.push(element[1]);
		}
	});
	// cleanup placeholders
	data = data.replace(/\$sub_cmds\$/g, '');
	data = data.replace(/\$sub_cmds_prev\$/g, '');

	fs.writeFile(zshFilePathOut, data, 'utf8', function (error) {
		if (error) {
			process.exitCode = 1;
			return console.error(error);
		}
	});
});
