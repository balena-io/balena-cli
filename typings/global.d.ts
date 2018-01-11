declare namespace NodeJS {
	interface Global {
		PROXY_CONFIG?: {
			host?: string;
			port?: number;
			proxyAuth?: string;
			sockets?: number;
		};
	}
}
