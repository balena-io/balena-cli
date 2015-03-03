mkdirp = require('mkdirp')
fs = require('fs')
path = require('path')
capitano = require('capitano')
markdown = require('./markdown')

capitano.command
	signature: 'markdown <file> <output>'
	description: 'file to markdown'
	action: (params, options, done) ->
		mkdirp.sync(params.output)
		action = require(params.file)

		for actionName, actionCommand of action
			output = path.join(params.output, "#{actionName}.md")
			fs.writeFileSync(output, markdown.command(actionCommand))

		return done()

capitano.run(process.argv)
