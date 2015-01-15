exports.yes =
	signature: 'yes'
	description: 'confirm non interactively'
	boolean: true
	alias: 'y'

exports.application =
	signature: 'application'
	parameter: 'application'
	description: 'application id'
	alias: [ 'a', 'app' ]
	required: 'You have to specify an application'
