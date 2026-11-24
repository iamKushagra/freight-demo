import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ENV_PATH = path.join(ROOT, '.env');
export const EXAMPLE_PATH = path.join(ROOT, '.env.example');

export function ensureEnvFile() {
  if (fs.existsSync(ENV_PATH)) return false;
  fs.copyFileSync(EXAMPLE_PATH, ENV_PATH);
  return true;
}

export function readEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const values = {};
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  // Real environment variables win, so CI or a shell export can override the file.
  for (const key of Object.keys(values)) {
    if (process.env[key]) values[key] = process.env[key];
  }
  return values;
}

/** Set KEY=VALUE in .env, replacing the existing line or appending a new one. */
export function writeEnvValue(key, value) {
  const lines = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/) : [];
  const index = lines.findIndex((line) => line.match(new RegExp(`^\\s*${key}\\s*=`)));
  if (index >= 0) lines[index] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n'));
}
