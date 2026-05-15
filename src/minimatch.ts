/**
 * Minimal glob matcher supporting *, **, and ? patterns.
 * No external dependencies. Handles the common cases for path matching.
 */
export function minimatch(filePath: string, pattern: string): boolean {
	const regex = globToRegex(pattern);
	return regex.test(filePath);
}

function globToRegex(pattern: string): RegExp {
	let reg = '';
	let i = 0;

	while (i < pattern.length) {
		const c = pattern[i];

		if (c === '*') {
			if (pattern[i + 1] === '*') {
				// ** matches any number of path segments
				if (pattern[i + 2] === '/') {
					reg += '(?:.+/)?';
					i += 3;
				} else {
					reg += '.*';
					i += 2;
				}
			} else {
				// * matches anything except /
				reg += '[^/]*';
				i++;
			}
		} else if (c === '?') {
			reg += '[^/]';
			i++;
		} else if (c === '{') {
			// Simple brace expansion: {a,b,c}
			const close = pattern.indexOf('}', i);
			if (close !== -1) {
				const options = pattern.slice(i + 1, close).split(',').map(escapeRegex).join('|');
				reg += `(?:${options})`;
				i = close + 1;
			} else {
				reg += escapeRegex(c);
				i++;
			}
		} else {
			reg += escapeRegex(c);
			i++;
		}
	}

	return new RegExp(`^${reg}$`, 'i');
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
