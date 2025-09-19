/*
 * Copyright 2016 Resin.io
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

'use strict';

/**
 * @module Reconfix.Engine.Formats.JSON
 */

/**
 * @summary Parse the contents of a JSON file
 * @function
 * @public
 *
 * @param {String} text - json text
 * @returns {Object} parsed object
 *
 * @example
 * const result = json.parse('{"foo":"bar"}');
 * console.log(result.foo);
 * > 'bar'
 */
exports.parse = (text) => {
  return JSON.parse(text);
};

/**
 * @summary Serialize a JSON object as an JSON file
 * @function
 * @public
 *
 * @param {Object} object - json object
 * @returns {String} json text
 *
 * @example
 * const result = json.serialise({
 *   mysection: {
 *     foo: 'bar'
 *   }
 * });
 *
 * console.log(result);
 * > {
 * >   mysection: {
 * >     foo: 'bar'
 * >   }
 * > }
 */
exports.serialise = (object) => {
  return JSON.stringify(object, null, 2);
};
