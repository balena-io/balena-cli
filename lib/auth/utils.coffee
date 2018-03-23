###
Copyright 2016 Resin.io

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
###

resin = require('resin-sdk').fromSharedOptions()
_ = require('lodash')
url = require('url')
Promise = require('bluebird')

###*
# @summary Get dashboard CLI login URL
# @function
# @protected
#
# @param {String} callbackUrl - callback url
# @fulfil {String} - dashboard login url
# @returns {Promise}
#
# @example
# utils.getDashboardLoginURL('http://127.0.0.1:3000').then (url) ->
# 	console.log(url)
###
exports.getDashboardLoginURL = (callbackUrl) ->

	# Encode percentages signs from the escaped url
	# characters to avoid angular getting confused.
	callbackUrl = encodeURIComponent(callbackUrl).replace(/%/g, '%25')

	resin.settings.get('dashboardUrl').then (dashboardUrl) ->
		return url.resolve(dashboardUrl, "/login/cli/#{callbackUrl}")

###*
# @summary Check if a token is valid
# @function
# @protected
#
# @description
# This function checks that the token is not only well-structured
# but that it also authenticates with the server successfully.
#
# @param {String} sessionToken - token
# @fulfil {Boolean} - whether is valid or not
# @returns {Promise}
#
# utils.isTokenValid('...').then (isValid) ->
#   if isValid
#     console.log('Token is valid!')
###
exports.isTokenValid = (sessionToken) ->
	if not sessionToken? or _.isEmpty(sessionToken.trim())
		return Promise.resolve(false)

	return resin.auth.getToken()
	.catchReturn(undefined)
	.then (currentToken) ->
		resin.auth.loginWithToken(sessionToken)
			.return(sessionToken)
			.then(resin.auth.isLoggedIn)
			.tap (isLoggedIn) ->
				return if isLoggedIn

				if currentToken?
					return resin.auth.loginWithToken(currentToken)
				else
					return resin.auth.logout()
