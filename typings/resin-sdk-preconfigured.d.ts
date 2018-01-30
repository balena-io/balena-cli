declare module 'resin-sdk-preconfigured' {
	import * as Promise from 'bluebird';
	import { EventEmitter } from 'events';
	import * as ResinErrors from 'resin-errors';
	import { Readable } from 'stream';

	/* tslint:disable:no-namespace */

	namespace Pine {
		// based on https://github.com/resin-io/pinejs-client-js/blob/master/core.d.ts

		type RawFilter =
			| string
			| Array<string | Filter<any>>
			| {
					$string: string;
					[index: string]: Filter<any> | string;
				};
		type Lambda<T> = {
			$alias: string;
			$expr: Filter<T>;
		};

		type OrderByValues = 'asc' | 'desc';
		type OrderBy =
			| string
			| string[]
			| {
					[index: string]: OrderByValues;
				};

		type ResourceObjFilter<T> = { [k in keyof T]?: object | number | string };

		interface FilterArray<T> extends Array<Filter<T>> {}

		type FilterExpressions<T> = {
			$raw?: RawFilter;

			$?: string | string[];

			$and?: Filter<T> | FilterArray<T>;
			$or?: Filter<T> | FilterArray<T>;

			$in?: Filter<T> | FilterArray<T>;

			$not?: Filter<T> | FilterArray<T>;

			$any?: Lambda<T>;
			$all?: Lambda<T>;
		};

		type Filter<T> = ResourceObjFilter<T> & FilterExpressions<T>;

		type BaseExpandFor<T> = { [k in keyof T]?: object } | keyof T;

		export type Expand<T> = BaseExpandFor<T> | Array<BaseExpandFor<T>>;
	}

	namespace ResinRequest {
		interface ResinRequestOptions {
			method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
			url: string;
			apiKey?: string;
			body?: any;
		}

		interface ResinRequestResponse extends Response {
			body: any;
		}

		interface ResinRequest {
			send: (options: ResinRequestOptions) => Promise<ResinRequestResponse>;
		}
	}

	namespace ResinSdk {
		interface Interceptor {
			request?(response: any): Promise<any>;
			response?(response: any): Promise<any>;
			requestError?(error: Error): Promise<any>;
			responseError?(error: Error): Promise<any>;
		}

		interface Config {
			deployment: string | null;
			deviceUrlsBase: string;
			adminUrl: string;
			apiUrl: string;
			actionsUrl: string;
			gitServerUrl: string;
			pubnub: {
				subscribe_key: string;
				publish_key: string;
			};
			ga?: GaConfig;
			mixpanelToken?: string;
			intercomAppId?: string;
			recurlyPublicKey?: string;
			deviceTypes: DeviceType[];
			DEVICE_ONLINE_ICON: string;
			DEVICE_OFFLINE_ICON: string;
			signupCodeRequired: boolean;
			supportedSocialProviders: string[];
		}

		interface GaConfig {
			site: string;
			id: string;
		}

		interface DeviceType {
			slug: string;
			name: string;

			arch: string;
			state?: string;

			isDependent?: boolean;
			instructions?: string[] | DeviceTypeInstructions;
			gettingStartedLink?: string | DeviceTypeGettingStartedLink;
			stateInstructions?: { [key: string]: string[] };
			options?: DeviceTypeOptions[];
			initialization?: {
				options?: DeviceInitializationOptions[];
				operations: Array<{
					command: string;
				}>;
			};
			supportsBlink?: boolean;
			yocto: {
				fstype?: string;
				deployArtifact: string;
			};
		}

		interface DeviceTypeInstructions {
			linux: string[];
			osx: string[];
			windows: string[];
		}

		interface DeviceTypeGettingStartedLink {
			linux: string;
			osx: string;
			windows: string;
			[key: string]: string;
		}

		interface DeviceTypeOptions {
			options: DeviceTypeOptionsGroup[];
			collapsed: boolean;
			isCollapsible: boolean;
			isGroup: boolean;
			message: string;
			name: string;
		}

		interface DeviceInitializationOptions {
			message: string;
			type: string;
			name: string;
		}

		interface DeviceTypeOptionsGroup {
			default: number | string;
			message: string;
			name: string;
			type: string;
			min?: number;
			choices?: string[] | number[];
			choicesLabels?: { [key: string]: string };
		}

		interface WithId {
			id: number;
		}

		interface PineParams {
			resource: string;
			id?: number;
			body?: object;
			options?: PineOptions;
		}

		interface PineOptions {
			filter?: object;
			expand?: object | string;
			orderBy?: Pine.OrderBy;
			top?: string;
			skip?: string;
			select?: string | string[];
		}

		interface PineParamsFor<T> extends PineParams {
			body?: Partial<T>;
			options?: PineOptionsFor<T>;
		}

		interface PineParamsWithIdFor<T> extends PineParamsFor<T> {
			id: number;
		}

		type PineFilterFor<T> = Pine.Filter<T>;
		type PineExpandFor<T> = Pine.Expand<T>;

		interface PineOptionsFor<T> extends PineOptions {
			filter?: PineFilterFor<T>;
			expand?: PineExpandFor<T>;
			select?: Array<keyof T> | keyof T;
		}

		interface PineDeferred {
			__id: number;
		}

		/**
		 * When not selected-out holds a deferred.
		 * When expanded hold an array with a single element.
		 */
		type NavigationResource<T = WithId> = T[] | PineDeferred;

		/**
		 * When expanded holds an array, otherwise the property is not present.
		 * Selecting is not suggested,
		 * in that case it holds a deferred to the original resource.
		 */
		type ReverseNavigationResource<T = WithId> = T[] | undefined;

		interface SocialServiceAccount {
			provider: string;
			display_name: string;
			created_at: string;
			id: number;
			remote_id: string;
		}

		interface User {
			id: number;
			username: string;
			email?: string;
			first_name?: string;
			last_name?: string;
			company?: string;
			account_type?: string;
			has_disabled_newsletter?: boolean;
			jwt_secret: string;
			created_at: string;
			twoFactorRequired?: boolean;
			hasPasswordSet?: boolean;
			needsPasswordReset?: boolean;
			public_key?: boolean;
			features?: string[];
			intercomUserName?: string;
			intercomUserHash?: string;
			permissions?: string[];
			loginAs?: boolean;
			actualUser?: number;

			// this is what the api route returns
			social_service_account: ReverseNavigationResource<SocialServiceAccount>;
		}

		interface Application {
			app_name: string;
			device_type: string;
			git_repository: string;
			commit: string;
			id: number;
			device_type_info?: any;
			has_dependent?: boolean;
			should_track_latest_release: boolean;

			user: NavigationResource<User>;

			application_tag: ReverseNavigationResource<ApplicationTag>;
		}

		type BuildStatus =
			| 'cancelled'
			| 'error'
			| 'interrupted'
			| 'local'
			| 'running'
			| 'success'
			| 'timeout'
			| null;

		interface Build {
			log: string;
			commit_hash: string;
			created_at: string;
			end_timestamp: string;
			id: number;
			message: string | null;
			project_type: string;
			push_timestamp: string | null;
			start_timestamp: string;
			status: BuildStatus;
			update_timestamp: string | null;
		}

		interface BillingAccountAddressInfo {
			address1: string;
			address2: string;
			city: string;
			state: string;
			zip: string;
			country: string;
			phone: string;
		}

		interface BillingAccountInfo {
			account_state: string;
			first_name: string;
			last_name: string;
			company_name: string;
			cc_emails: string;
			vat_number: string;
			address: BillingAccountAddressInfo;
		}

		type BillingInfoType = 'bank_account' | 'credit_card' | 'paypal';

		interface BillingInfo {
			full_name: string;

			first_name: string;
			last_name: string;
			company: string;
			vat_number: string;
			address1: string;
			address2: string;
			city: string;
			state: string;
			zip: string;
			country: string;
			phone: string;

			type?: BillingInfoType;
		}

		interface CardBillingInfo extends BillingInfo {
			card_type: string;
			year: string;
			month: string;
			first_one: string;
			last_four: string;
		}

		interface BankAccountBillingInfo extends BillingInfo {
			account_type: string;
			last_four: string;
			name_on_account: string;
			routing_number: string;
		}

		interface TokenBillingSubmitInfo {
			token_id: string;
		}

		interface BillingPlanInfo {
			name: string;
			billing?: BillingPlanBillingInfo;
		}

		interface BillingPlanBillingInfo {
			currency: string;
			currencySymbol?: string;
		}

		interface InvoiceInfo {
			closed_at: string;
			created_at: string;
			currency: string;
			invoice_number: string;
			subtotal_in_cents: string;
			total_in_cents: string;
			uuid: string;
		}

		interface Device {
			created_at: string;
			device_type: string;
			id: number;
			name: string;
			os_version: string;
			os_variant?: string;
			status_sort_index?: number;
			uuid: string;
			ip_address: string | null;
			vpn_address: string | null;
			last_connectivity_event: string;
			is_in_local_mode?: boolean;
			app_name?: string;
			state?: { key: string; name: string };
			status: string;
			provisioning_state: string;
			is_online: boolean;
			is_connected_to_vpn: boolean;
			supervisor_version: string;
			is_web_accessible: boolean;
			has_dependent: boolean;
			note: string;
			location: string;
			latitude?: string;
			longitude?: string;
			custom_latitude?: string;
			custom_longitude?: string;
			download_progress?: number;
			provisioning_progress?: number;
			local_id?: string;

			device_environment_variable: ReverseNavigationResource<
				DeviceEnvironmentVariable
			>;
			device_tag: ReverseNavigationResource<DeviceTag>;
		}

		interface LogMessage {
			message: string;
			isSystem: boolean;
			timestamp: number | null;
			serviceId: number | null;
		}

		interface LogsSubscription extends EventEmitter {
			unsubscribe(): void;
		}

		interface SSHKey {
			title: string;
			public_key: string;
			id: number;
			created_at: string;
		}

		type ImgConfigOptions = {
			network?: 'ethernet' | 'wifi';
			appUpdatePollInterval?: number;
			wifiKey?: string;
			wifiSsid?: string;
			ip?: string;
			gateway?: string;
			netmask?: string;
			version?: string;
		};

		type OsVersions = {
			latest: string;
			recommended: string;
			default: string;
			versions: string[];
		};

		interface EnvironmentVariableBase {
			id: number;
			name: string;
			value: string;
		}

		interface EnvironmentVariable extends EnvironmentVariableBase {
			application: NavigationResource<Application>;
		}

		interface DeviceEnvironmentVariable extends EnvironmentVariableBase {
			env_var_name?: string;

			device: NavigationResource<Device>;
		}

		interface ResourceTagBase {
			id: number;
			tag_key: string;
			value: string;
		}

		interface ApplicationTag extends ResourceTagBase {
			application: NavigationResource<Application>;
		}

		interface DeviceTag extends ResourceTagBase {
			device: NavigationResource<Device>;
		}

		type LogsPromise = Promise<LogMessage[]>;

		interface ResinSDK {
			auth: {
				register: (
					credentials: { email: string; password: string },
				) => Promise<string>;
				authenticate: (
					credentials: { email: string; password: string },
				) => Promise<string>;
				login: (
					credentials: { email: string; password: string },
				) => Promise<void>;
				loginWithToken: (authToken: string) => Promise<void>;
				logout: () => Promise<void>;
				getToken: () => Promise<string>;
				whoami: () => Promise<string | undefined>;
				isLoggedIn: () => Promise<boolean>;
				getUserId: () => Promise<number>;
				getEmail: () => Promise<string>;
				twoFactor: {
					isEnabled: () => Promise<boolean>;
					isPassed: () => Promise<boolean>;
					challenge: (code: string) => Promise<void>;
				};
			};

			settings: {
				get(key: string): Promise<string>;
				getAll(): Promise<{ [key: string]: string }>;
			};

			request: ResinRequest.ResinRequest;

			errors: {
				ResinAmbiguousApplication: ResinErrors.ResinAmbiguousApplication;
				ResinAmbiguousDevice: ResinErrors.ResinAmbiguousDevice;
				ResinApplicationNotFound: ResinErrors.ResinApplicationNotFound;
				ResinBuildNotFound: ResinErrors.ResinBuildNotFound;
				ResinDeviceNotFound: ResinErrors.ResinDeviceNotFound;
				ResinExpiredToken: ResinErrors.ResinExpiredToken;
				ResinInvalidDeviceType: ResinErrors.ResinInvalidDeviceType;
				ResinInvalidParameterError: ResinErrors.ResinInvalidParameterError;
				ResinKeyNotFound: ResinErrors.ResinKeyNotFound;
				ResinMalformedToken: ResinErrors.ResinMalformedToken;
				ResinNotLoggedIn: ResinErrors.ResinNotLoggedIn;
				ResinRequestError: ResinErrors.ResinRequestError;
				ResinSupervisorLockedError: ResinErrors.ResinSupervisorLockedError;
			};

			models: {
				application: {
					create(
						name: string,
						deviceType: string,
						parentNameOrId?: number | string,
					): Promise<Application>;
					get(
						nameOrId: string | number,
						options?: PineOptionsFor<Application>,
					): Promise<Application>;
					getAppByOwner(
						appName: string,
						owner: string,
						options?: PineOptionsFor<Application>,
					): Promise<Application>;
					getAll(options?: PineOptionsFor<Application>): Promise<Application[]>;
					has(name: string): Promise<boolean>;
					hasAny(): Promise<boolean>;
					remove(nameOrId: string | number): Promise<void>;
					restart(nameOrId: string | number): Promise<void>;
					enableDeviceUrls(nameOrId: string | number): Promise<void>;
					disableDeviceUrls(nameOrId: string | number): Promise<void>;
					grantSupportAccess(
						nameOrId: string | number,
						expiryTimestamp: number,
					): Promise<void>;
					revokeSupportAccess(nameOrId: string | number): Promise<void>;
					reboot(appId: number, { force }: { force?: boolean }): Promise<void>;
					shutdown(
						appId: number,
						{ force }: { force?: boolean },
					): Promise<void>;
					purge(appId: number): Promise<void>;
					generateApiKey(nameOrId: string | number): Promise<string>;
					generateProvisioningKey(nameOrId: string | number): Promise<string>;
					tags: {
						getAllByApplication(
							nameOrId: string | number,
							options?: PineOptionsFor<ApplicationTag>,
						): Promise<ApplicationTag[]>;
						getAll(
							options?: PineOptionsFor<ApplicationTag>,
						): Promise<ApplicationTag[]>;
						set(
							nameOrId: string | number,
							tagKey: string,
							value: string,
						): Promise<void>;
						remove(nameOrId: string | number, tagKey: string): Promise<void>;
					};
				};
				build: {
					get(id: number, options?: PineOptionsFor<Build>): Promise<Build>;
					getAllByApplication(
						nameOrId: string | number,
						options?: PineOptionsFor<Build>,
					): Promise<Build[]>;
				};
				billing: {
					getAccount(): Promise<BillingAccountInfo>;
					getPlan(): Promise<BillingPlanInfo>;
					getBillingInfo(): Promise<BillingInfo>;
					updateBillingInfo(
						billingInfo: TokenBillingSubmitInfo,
					): Promise<BillingInfo>;
					getInvoices(): Promise<InvoiceInfo[]>;
					downloadInvoice(invoiceNumber: string): Promise<Blob>;
				};
				device: {
					get(
						uuidOrId: string | number,
						options?: PineOptionsFor<Device>,
					): Promise<Device>;
					getByName(
						nameOrId: string | number,
						options?: PineOptionsFor<Device>,
					): Promise<Device[]>;
					getAll(options?: PineOptionsFor<Device>): Promise<Device[]>;
					getAllByApplication(
						nameOrId: string | number,
						options?: PineOptionsFor<Device>,
					): Promise<Device[]>;
					getAllByParentDevice(
						parentUuidOrId: string | number,
						options?: PineOptionsFor<Device>,
					): Promise<Device[]>;
					getName(uuidOrId: string | number): Promise<string>;
					getApplicationName(uuidOrId: string | number): Promise<string>;
					getApplicationInfo(
						uuidOrId: string | number,
					): Promise<{
						appId: string;
						commit: string;
						containerId: string;
						env: { [key: string]: string | number };
						imageId: string;
					}>;
					has(uuidOrId: string | number): Promise<boolean>;
					isOnline(uuidOrId: string | number): Promise<boolean>;
					getLocalIPAddressess(uuidOrId: string | number): Promise<string[]>;
					getDashboardUrl(uuid: string): string;
					getSupportedDeviceTypes(): Promise<string[]>;
					getManifestBySlug(slugOrName: string): Promise<DeviceType>;
					getManifestByApplication(
						nameOrId: string | number,
					): Promise<DeviceType>;
					move(
						uuidOrId: string | number,
						applicationNameOrId: string | number,
					): Promise<void>;
					note(uuidOrId: string | number, note: string): Promise<void>;
					remove(uuidOrId: string | number): Promise<void>;
					rename(uuidOrId: string | number, newName: string): Promise<void>;
					setCustomLocation(
						uuidOrId: string | number,
						location: { latitude: number; longitude: number },
					): Promise<void>;
					unsetCustomLocation(uuidOrId: string | number): Promise<void>;
					identify(uuidOrId: string | number): Promise<void>;
					startApplication(uuidOrId: string | number): Promise<void>;
					stopApplication(uuidOrId: string | number): Promise<void>;
					restartApplication(uuidOrId: string | number): Promise<void>;
					grantSupportAccess(
						uuidOrId: string | number,
						expiryTimestamp: number,
					): Promise<void>;
					revokeSupportAccess(uuidOrId: string | number): Promise<void>;
					reboot(
						uuidOrId: string | number,
						{ force }?: { force?: boolean },
					): Promise<void>;
					shutdown(
						uuidOrId: string | number,
						{ force }?: { force?: boolean },
					): Promise<void>;
					purge(uuidOrId: string | number): Promise<void>;
					update(
						uuidOrId: string | number,
						{ force }?: { force?: boolean },
					): Promise<void>;
					getDisplayName(deviceTypeName: string): string;
					getDeviceSlug(deviceTypeName: string): string;
					generateUniqueKey(): string;
					register(
						applicationNameOrId: string | number,
						uuid?: string,
					): Promise<object>;
					generateDeviceKey(uuidOrId: string | number): Promise<string>;
					enableDeviceUrl(uuidOrId: string | number): Promise<void>;
					disableDeviceUrl(uuidOrId: string | number): Promise<void>;
					hasDeviceUrl(uuidOrId: string | number): Promise<boolean>;
					getDeviceUrl(uuidOrId: string | number): Promise<string>;
					enableTcpPing(uuidOrId: string | number): Promise<void>;
					disableTcpPing(uuidOrId: string | number): Promise<void>;
					ping(uuidOrId: string | number): Promise<void>;
					getStatus(device: object): string;
					lastOnline(device: Device): string;
					tags: {
						getAllByApplication(
							nameOrId: string | number,
							options?: PineOptionsFor<DeviceTag>,
						): Promise<DeviceTag[]>;
						getAllByDevice(
							uuidOrId: string | number,
							options?: PineOptionsFor<DeviceTag>,
						): Promise<DeviceTag[]>;
						getAll(options?: PineOptionsFor<DeviceTag>): Promise<DeviceTag[]>;
						set(
							uuidOrId: string | number,
							tagKey: string,
							value: string,
						): Promise<void>;
						remove(uuidOrId: string | number, tagKey: string): Promise<void>;
					};
				};
				environmentVariables: {
					device: {
						getAll(id: number): Promise<DeviceEnvironmentVariable[]>;
						getAllByApplication(
							applicationNameOrId: number | string,
						): Promise<DeviceEnvironmentVariable[]>;
						update(id: number, value: string): Promise<void>;
						create(
							uuidOrId: number | string,
							name: string,
							value: string,
						): Promise<void>;
						remove(id: number): Promise<void>;
					};
					getAllByApplication(
						applicationNameOrId: number | string,
					): Promise<EnvironmentVariable[]>;
					update(id: number, value: string): Promise<void>;
					create(
						applicationNameOrId: number | string,
						name: string,
						value: string,
					): Promise<void>;
					remove(id: number): Promise<void>;
					isSystemVariable(variable: { name: string }): boolean;
				};
				config: {
					getAll: () => Promise<Config>;
					getDeviceTypes: () => Promise<DeviceType[]>;
					getDeviceOptions(
						deviceType: string,
					): Promise<Array<DeviceTypeOptions | DeviceInitializationOptions>>;
				};
				key: {
					getAll(options?: PineOptionsFor<SSHKey>): Promise<SSHKey[]>;
					get(id: string | number): Promise<SSHKey>;
					remove(id: string | number): Promise<void>;
					create(title: string, key: string): Promise<SSHKey>;
				};
				os: {
					getConfig(
						nameOrId: string | number,
						options?: ImgConfigOptions,
					): Promise<object>;
					getDownloadSize(slug: string, version?: string): Promise<number>;
					getSupportedVersions(slug: string): Promise<OsVersions>;
					getMaxSatisfyingVersion(
						deviceType: string,
						versionOrRange: string,
					): string;
					getLastModified(deviceType: string, version?: string): Promise<Date>;
					download(deviceType: string, version?: string): Promise<Readable>;
				};
			};

			logs: {
				history(uuid: string): LogsPromise;
				historySinceLastClear(uuid: string): LogsPromise;
				subscribe(uuid: string): Promise<LogsSubscription>;
				clear(uuid: string): void;
			};

			pine: {
				delete<T>(
					params: PineParamsWithIdFor<T> | PineParamsFor<T>,
				): Promise<string>;
				get<T>(params: PineParamsWithIdFor<T>): Promise<T>;
				get<T>(params: PineParamsFor<T>): Promise<T[]>;
				get<T, Result>(params: PineParamsFor<T>): Promise<Result>;
				post<T>(params: PineParams): Promise<T>;
				patch<T>(params: PineParamsWithIdFor<T>): Promise<T>;
			};
			interceptors: Interceptor[];
		}
	}

	interface SdkOptions {
		apiUrl?: string;
		/**
		 * @deprecated Use resin.auth.loginWithToken(apiKey) instead
		 */
		apiKey?: string;
		imageMakerUrl?: string;
		dataDirectory?: string;
		isBrowser?: boolean;
		debug?: boolean;
	}

	interface SdkConstructor {
		(options?: SdkOptions): ResinSdk.ResinSDK;

		setSharedOptions(options: SdkOptions): void;
		fromSharedOptions: () => ResinSdk.ResinSDK;
	}

	const ResinSdk: ResinSdk.ResinSDK;

	export = ResinSdk;
}
