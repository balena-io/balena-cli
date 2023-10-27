/*
Copyright 2016-2020 Balena

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import type { OptionalNavigationResource } from 'balena-sdk';

export const getExpanded = <T extends object>(
	obj: OptionalNavigationResource<T>,
) => (Array.isArray(obj) && obj[0]) || undefined;

export const getExpandedProp = <T extends object, K extends keyof T>(
	obj: OptionalNavigationResource<T>,
	key: K,
) => (Array.isArray(obj) && obj[0] && obj[0][key]) || undefined;
