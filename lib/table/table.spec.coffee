expect = require('chai').expect
_ = require('lodash')
table = require('./table')

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
		hello: 'world'
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
		one: 'one'
		two: 'two'
		three: 'three'

describe 'Table:', ->

	describe '#prepareObject()', ->

		it 'should get rid of keys not starting with letters', ->
			expect(table.prepareObject(OBJECTS.basic)).to.deep.equal
				hello: 'world'
				Hey: 'there'

		it 'should get rid of keys not starting with letters recursively', ->
			expect(table.prepareObject(OBJECTS.recursive)).to.deep.equal
				hello: 'world'
				Hey:
					value:
						data: 'There'

		it 'should do proper key renamings', ->
			expect(table.prepareObject(OBJECTS.application)).to.deep.equal
				ID: 162
				Name: 'HelloResin'
				'Git Repository': 'git@git.staging.resin.io:jviotti/helloresin.git'
				Commit: '1234'
				'Device Type': 'raspberry-pi'

		it 'should not remove not empty arrays', ->
			object = { array: [ 1, 2, 3 ] }
			expect(table.prepareObject(object)).to.deep.equal(object)

	describe '#processTableContents()', ->

		checkIfArray = (input) ->
			result = table.processTableContents(input, _.identity)
			expect(result).to.be.an.instanceof(Array)

		it 'should always return an array', ->
			checkIfArray(OBJECTS.basic)
			checkIfArray([ OBJECTS.basic ])
			checkIfArray([ 'contents' ])

		it 'should be able to manipulate the contents', ->
			result = table.processTableContents { hey: 'there' }, (item) ->
				item.hey = 'yo'
				return item

			expect(result).to.deep.equal([ hey: 'yo' ])

		it 'should get rid of keys not starting with letters', ->
			result = table.processTableContents(OBJECTS.basic, _.identity)
			expect(result).to.deep.equal [
				{
					hello: 'world'
					Hey: 'there'
				}
			]

		it 'should allow a null/undefined map function without corrupting the data', ->
			for map in [ null, undefined ]
				result = table.processTableContents([ OBJECTS.valid ], map)
				expect(result).to.deep.equal([ OBJECTS.valid ])

	describe '#getDefaultContentsOrdering()', ->

		it 'should return undefined if no contents', ->
			expect(table.getDefaultContentsOrdering()).to.be.undefined

		it 'should return undefined if contents is empty', ->
			expect(table.getDefaultContentsOrdering([])).to.be.undefined

		it 'should return undefined if contents is not an array of objects', ->
			inputs = [
				[ 1, 2, 3 ]
				[ '1', '2', '3' ]
				[ _.identity ]
			]

			for input in inputs
				expect(table.getDefaultContentsOrdering(input)).to.be.undefined

		it 'should return an array containing all the object keys', ->
			result = table.getDefaultContentsOrdering([ OBJECTS.valid ])
			console.log result
			for key, value of OBJECTS.valid
				expect(result.indexOf(key)).to.not.equal(-1)

	describe '#vertical()', ->

		it 'should return a string respecting the ordering', ->
			ordering = [ 'one', 'two', 'three' ]
			result = table.vertical(OBJECTS.valid, null, ordering).split('\n')
			expected = [
				'one: one'
				'two: two'
				'three: three'
			]

			expect(result).to.deep.equal(expected)

		it 'should be able to print everything without explicit ordering', ->
			result = table.vertical(OBJECTS.valid, null).split('\n')
			expected = [
				'one: one'
				'two: two'
				'three: three'
			]

			for line in expected
				expect(result.indexOf(line)).to.not.equal(-1)
