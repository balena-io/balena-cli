const path = require('path');
const rootDir = path.join(__dirname, '..');
const fs = require('fs');

commandsFilePath = path.join(rootDir, 'oclif.manifest.json')
if (fs.existsSync(commandsFilePath)) {
    console.log('Found file');
} else {
    console.error('Not Found file');
    return;
}

const commands_json = JSON.parse(fs.readFileSync(commandsFilePath, 'utf8'));

var mainCommands = [];
var additionalCommands = [];
for (const key in commands_json.commands) {
    const cmd = key.split(":");
    if (cmd.length > 1) {
        additionalCommands.push(cmd);
        if (!mainCommands.includes(cmd[0])) {
            mainCommands.push(cmd[0]);
        }
    } else {
        mainCommands.push(cmd[0]);
    }
}
const mainCommandsStr = mainCommands.join(" ");

// GENERATE BASH COMPLETION FILE
bashFilePathIn = path.join(__dirname, "balena_bash_template");
bashFilePathOut = path.join(__dirname, "bash/balena_comp");
fs.readFile(bashFilePathIn, 'utf8', function (err,data) {
    if (err) {
        return console.error(err);
    }
    data = data.replace(/\$main_commands\$/g, 'main_commands=\"' + mainCommandsStr + '\"');
    var subCommands = [];
    var prevElement = additionalCommands[0][0];
    additionalCommands.forEach(function(element) {
        if (element[0] == prevElement) {
            subCommands.push(element[1]);
        } else {
            const prevElement2 = prevElement.replace(/-/g, "_") + "_cmds";
            data = data.replace(/\$sub_cmds\$/g, "  " + prevElement2 + '=\"' + subCommands.join(" ") + '\"\n\$sub_cmds\$');
            data = data.replace(/\$sub_cmds_prev\$/g, "      " + prevElement + ")\n        COMPREPLY=( $(compgen -W \"$" + prevElement2 + "\" -- $cur) )\n        ;;\n\$sub_cmds_prev\$");
            prevElement = element[0];
            subCommands = [];
            subCommands.push(element[1]);
        }
    });
    // cleanup placeholders
    data = data.replace(/\$sub_cmds\$/g, "");
    data = data.replace(/\$sub_cmds_prev\$/g, "");

    fs.writeFile(bashFilePathOut, data, 'utf8', function (err) {
        if (err) {
           return console.error(err);
        }
    });
});

// GENERATE ZSH COMPLETION FILE
zshFilePathIn = path.join(__dirname, "balena_zsh_template");
zshFilePathOut = path.join(__dirname, "zsh/_balena");
fs.readFile(zshFilePathIn, 'utf8', function (err,data) {
    if (err) {
        return console.error(err);
    }
    data = data.replace(/\$main_commands\$/g, 'main_commands=( ' + mainCommandsStr + ' )');
    var subCommands = [];
    var prevElement = additionalCommands[0][0];
    additionalCommands.forEach(function(element) {
        if (element[0] == prevElement) {
            subCommands.push(element[1]);
        } else {
            const prevElement2 = prevElement.replace(/-/g, "_") + "_cmds";
            data = data.replace(/\$sub_cmds\$/g, "  " + prevElement2 + '=( ' + subCommands.join(" ") + ' )\n\$sub_cmds\$');
            data = data.replace(/\$sub_cmds_prev\$/g, "      \"" + prevElement + "\")\n        _describe -t " + prevElement2 + " \'" + prevElement + '_cmd\' ' +  prevElement2 + " \"$@\" && ret=0\n      ;;\n\$sub_cmds_prev\$");
            prevElement = element[0];
            subCommands = [];
            subCommands.push(element[1]);
        }
    });
    // cleanup placeholders
    data = data.replace(/\$sub_cmds\$/g, "");
    data = data.replace(/\$sub_cmds_prev\$/g, "");

    fs.writeFile(zshFilePathOut, data, 'utf8', function (err) {
        if (err) {
            return console.error(err);
        }
    });
});

