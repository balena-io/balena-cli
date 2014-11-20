chai = require('chai')
sinon = require('sinon')
chai.use(require('chai-things'))
chai.use(require('sinon-chai'))
expect = chai.expect

_ = require('lodash')
yargs = require('yargs')
yargs.command = require('./yargs-command')

COMMANDS =
	appList:
		signature: 'app list <id>'
		action: (id) -> "App List: #{id}"
		action2: (id) -> "App List: #{id}!"
	deviceList:
		signature: 'device list <id>'
		action: (id) -> "Device: #{id}"

ARGS =
	appList:
		_: [ 'app', 'list', '7' ]
	deviceList:
		_: [ 'device', 'list', '7' ]
	noMatch:
		_: [ 'foo', 'bar', 'baz' ]

# Hacky way to check that both functions are equal based
# on what they returns, as mocha crashes when trying equal
# or deep equal directly on the functions for some reason
areFunctionsEqual = (fn1, fn2) ->
	return fn1.toString() is fn2.toString()

describe 'Yargs Command:', ->

	cleanUpYargs = ->
		yargs.command._commands = [] if yargs.command._commands
		yargs.argv = {}
		delete yargs.command._matchedCommand

	beforeEach ->
		cleanUpYargs()

	afterEach ->
		cleanUpYargs()

	it 'should expose a public command function', ->
		expect(yargs.command).to.be.an.instanceof(Function)

	it 'should return yargs to enable chaining', ->
		result = yargs.command(COMMANDS.appList.signature, COMMANDS.appList.action)
		expect(result).to.equal(yargs)

	it 'should contain an empty _commands array', ->
		expect(yargs.command._commands).to.deep.equal([])

	it 'should push a command to _commands', ->
		yargs.command(COMMANDS.appList.signature, COMMANDS.appList.action)
		expect(yargs.command._commands).to.contain.something.that.deep.equals
			signature: COMMANDS.appList.signature
			action: COMMANDS.appList.action

	describe 'if adding the same command signature twice', ->

		beforeEach ->
			yargs.command(COMMANDS.appList.signature, COMMANDS.appList.action)
			yargs.command(COMMANDS.appList.signature, COMMANDS.appList.action2)

		it 'should contain only one command', ->
			expect(yargs.command._commands).to.have.length(1)

		it 'should make the last action override the first one', ->
			firstCommandAction = yargs.command._commands[0].action
			expect(areFunctionsEqual(firstCommandAction, COMMANDS.appList.action2)).to.be.true

	describe 'given various registered commands', ->

		registerCommands = ->
			yargs.command(COMMANDS.appList.signature, COMMANDS.appList.action)
			yargs.command(COMMANDS.deviceList.signature, COMMANDS.deviceList.action)

		testCommand = (name) ->
			yargs.argv = ARGS[name]
			registerCommands()
			matchedCommand = yargs.command._matchedCommand
			expect(matchedCommand.signature).to.equal(COMMANDS[name].signature)

		it 'should choose the right command', ->
			for command in [
				'appList'
				'deviceList'
			]
				testCommand(command)

		it 'should be undefined if no match', ->
			yargs.argv = ARGS.noMatch
			registerCommands()
			expect(yargs.command._matchedCommand).to.not.exist

	it 'should have a run public function', ->
		expect(yargs.command.run).to.be.an.instanceof(Function)

	describe '#run()', ->

		it 'should call the action with the correct parameters', ->
			yargs.argv = ARGS.appList
			callback = sinon.spy()
			yargs.command(COMMANDS.appList.signature, callback)
			yargs.command.run()
			expect(callback).to.have.been.calledWith(_.last(ARGS.appList._))
