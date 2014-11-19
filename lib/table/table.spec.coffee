expect = require('chai').expect
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
