import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const MIME: Record<string, string> = {
	'.html': 'text/html',
	'.htm': 'text/html',
	'.css': 'text/css',
	'.js': 'application/javascript',
	'.mjs': 'application/javascript',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.otf': 'font/otf',
	'.eot': 'application/vnd.ms-fontobject',
	'.wasm': 'application/wasm',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.pdf': 'application/pdf',
	'.xml': 'application/xml',
	'.txt': 'text/plain',
	'.webmanifest': 'application/manifest+json',
};

/**
 * One lightweight static file server per document root directory.
 * Serves all files under the root on 127.0.0.1 with a random port.
 * This ensures all path types work: relative, root-relative (/), and dynamic imports.
 */
export class StaticServer {
	private server: http.Server;
	private _port = 0;
	private root: string;

	get port(): number {
		return this._port;
	}

	get baseUrl(): string {
		return `http://127.0.0.1:${this._port}/`;
	}

	constructor(root: string) {
		this.root = root;
		this.server = http.createServer((req, res) => {
			if (!req.url) { res.writeHead(400); res.end(); return; }

			const url = new URL(req.url, `http://localhost:${this._port}`);
			const relativePath = decodeURIComponent(url.pathname.slice(1)) || 'index.html';
			const filePath = path.resolve(this.root, relativePath);

			// Prevent path traversal
			if (!filePath.startsWith(this.root)) {
				res.writeHead(403);
				res.end();
				return;
			}

			const ext = path.extname(filePath).toLowerCase();
			let contentType = MIME[ext] || 'application/octet-stream';
			// Declare UTF-8 for text formats so non-ASCII content (e.g. CJK) isn't
			// mojibake'd when the file itself omits a <meta charset> / BOM.
			if (/^text\/|javascript|json|svg|xml/.test(contentType)) {
				contentType += '; charset=utf-8';
			}

			const stream = fs.createReadStream(filePath);
			stream.on('open', () => {
				res.writeHead(200, {
					'Content-Type': contentType,
					'Cache-Control': 'no-cache',
				});
				stream.pipe(res);
			});
			stream.on('error', () => {
				res.writeHead(404);
				res.end();
			});
		});
	}

	async start(): Promise<void> {
		return new Promise((resolve) => {
			this.server.listen(0, '127.0.0.1', () => {
				const addr = this.server.address() as { port: number };
				this._port = addr.port;
				resolve();
			});
		});
	}

	dispose(): void {
		this.server.close();
	}
}

/** Manages per-root servers, reusing them when multiple files share a root */
export class ServerManager {
	private servers = new Map<string, { server: StaticServer; refCount: number }>();

	async getServer(root: string): Promise<StaticServer> {
		const entry = this.servers.get(root);
		if (entry) {
			entry.refCount++;
			return entry.server;
		}
		const server = new StaticServer(root);
		await server.start();
		this.servers.set(root, { server, refCount: 1 });
		return server;
	}

	release(root: string): void {
		const entry = this.servers.get(root);
		if (!entry) { return; }
		entry.refCount--;
		if (entry.refCount <= 0) {
			entry.server.dispose();
			this.servers.delete(root);
		}
	}

	dispose(): void {
		for (const { server } of this.servers.values()) {
			server.dispose();
		}
		this.servers.clear();
	}
}
