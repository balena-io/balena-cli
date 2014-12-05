expect = require('chai').expect
sinon = require('sinon')
_ = require('lodash')
tableHelpers = require('./table-helpers')

OBJECTS =
	application:
		device: null
		id: 162
		user:
			__deferred: []
			__id: 24
		app_name: 'HelloResin'
		git_repository: 'git@git.staging.resin.io:jviotti/helloresin.git'
		commit: '1234'
		device_type: 'raspberry-pi'
		__metadata:
			uri: '/ewa/application(162)'
	basic:
		Hello: 'world'
		Hey: 'there'
		__private: true
		_option: false
		$data: [ 1, 2, 3 ]
	recursive:
		hello: 'world'
		Hey:
			__private: true
			value:
				$option: false
				data: 'There'
		_option: false
		__something:
			value: 'ok'
		nested:
			$data: [ 1, 2, 3 ]
	valid:
		One: 'one'
		Two: 'two'
		Three: 'three'

describe 'Table Helpers:', ->

	describe '#getKeyName()', ->

		it 'should return titleized names', ->
			expect(tableHelpers.getKeyName('hello world')).to.equal('Hello World')
			expect(tableHelpers.getKeyName('foo Bar')).to.equal('Foo Bar')

		it 'should return custom names from the map', ->
			expect(tableHelpers.getKeyName('last_seen_time')).to.equal('Last Seen')
			expect(tableHelpers.getKeyName('app_name')).to.equal('Name')

		it 'should remove underscores', ->
			expect(tableHelpers.getKeyName('git_repository')).to.equal('Git Repository')
			expect(tableHelpers.getKeyName('device_type')).to.equal('Device Type')
			expect(tableHelpers.getKeyName('is_web_accessible')).to.equal('Is Web Accessible')

	describe '#prepareObject()', ->

		it 'should get rid of keys not starting with letters', ->
			expect(tableHelpers.prepareObject(OBJECTS.basic)).to.deep.equal
				Hello: 'world'
				Hey: 'there'

		it 'should get rid of keys not starting with letters recursively', ->
			expect(tableHelpers.prepareObject(OBJECTS.recursive)).to.deep.equal
				Hello: 'world'
				Hey:
					Value:
						Data: 'There'

		it 'should do proper key renamings', ->
			expect(tableHelpers.prepareObject(OBJECTS.application)).to.deep.equal
				ID: 162
				Name: 'HelloResin'
				'Git Repository': 'git@git.staging.resin.io:jviotti/helloresin.git'
				Commit: '1234'
				'Device Type': 'raspberry-pi'

		it 'should not remove not empty arrays', ->
			object = { Array: [ 1, 2, 3 ] }
			expect(tableHelpers.prepareObject(object)).to.deep.equal(object)

		it 'should preserve false fields', ->
			object = { Test: false }
			expect(tableHelpers.prepareObject(object)).to.deep.equal(object)

	describe '#processTableContents()', ->

		checkIfArray = (input) ->
			result = tableHelpers.processTableContents(input, _.identity)
			expect(result).to.be.an.instanceof(Array)

		it 'should always return an array', ->
			checkIfArray(OBJECTS.basic)
			checkIfArray([ OBJECTS.basic ])
			checkIfArray([ 'contents' ])

		it 'should be able to manipulate the contents', ->
			result = tableHelpers.processTableContents { hey: 'there' }, (item) ->
				item.hey = 'yo'
				return item

			expect(result).to.deep.equal([ Hey: 'yo' ])

		it 'should not call map if contents does not exist', ->
			map = sinon.spy()
			tableHelpers.processTableContents(null, map)
			tableHelpers.processTableContents(undefined, map)
			expect(map).to.not.have.been.called

		it 'should get rid of keys not starting with letters', ->
			result = tableHelpers.processTableContents(OBJECTS.basic, _.identity)
			expect(result).to.deep.equal [
				{
					Hello: 'world'
					Hey: 'there'
				}
			]

		it 'should allow a null/undefined map function without corrupting the data', ->
			for map in [ null, undefined ]
				result = tableHelpers.processTableContents([ OBJECTS.valid ], map)
				expect(result).to.deep.equal([ OBJECTS.valid ])

	describe '#getDefaultContentsOrdering()', ->

		it 'should return undefined if no contents', ->
			expect(tableHelpers.getDefaultContentsOrdering()).to.be.undefined

		it 'should return undefined if contents is empty', ->
			expect(tableHelpers.getDefaultContentsOrdering([])).to.be.undefined

		it 'should return undefined if contents is not an array of objects', ->
			inputs = [
				[ 1, 2, 3 ]
				[ '1', '2', '3' ]
				[ _.identity ]
			]

			for input in inputs
				expect(tableHelpers.getDefaultContentsOrdering(input)).to.be.undefined

		it 'should return an array containing all the object keys', ->
			result = tableHelpers.getDefaultContentsOrdering([ OBJECTS.valid ])
			for key, value of OBJECTS.valid
				expect(result.indexOf(key)).to.not.equal(-1)

	describe '#normaliseOrdering()', ->

		it 'should return titleized words if ordering is not empty', ->
			ordering = [ 'one', 'two', 'three' ]
			result = tableHelpers.normaliseOrdering(ordering, {})
			expect(result).to.deep.equal([ 'One', 'Two', 'Three' ])

		it 'should return an array containing all the object keys', ->
			result = tableHelpers.normaliseOrdering(null, [ OBJECTS.valid ])
			for key, value of OBJECTS.valid
				expect(result.indexOf(key)).to.not.equal(-1)

		it 'should not give precendence to names from the map', ->
			ordering = [ 'id', 'ip_address', 'name' ]
			result = tableHelpers.normaliseOrdering(ordering, {})
			expect(result).to.deep.equal([ 'ID', 'IP Address', 'Name' ])

		it 'should preverse a string that is the result of a map lookup', ->
			ordering = [ 'ID', 'IP Address' ]
			result = tableHelpers.normaliseOrdering(ordering, {})
			expect(result).to.deep.equal(ordering)
