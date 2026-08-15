/**
 * Loader for scripts/boards.config.json: product handle -> single-board
 * .kicad_pcb. Paths are relative to `root` (the container holding the board
 * checkouts, `~` allowed); OPENDRONE_HARDWARE overrides root so the site can be
 * regenerated from any machine that has the repos checked out side by side.
 * Shared by export-board-art.mjs and export-schematics.mjs.
 */
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname, isAbsolute, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const CONFIG_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'boards.config.json');

const untilde = (p) => p.replace(/^~(?=\/)/, homedir());

/** @returns {{handle: string, pcb: string}[]} with absolute pcb paths */
export function loadBoards() {
  const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  if (!Array.isArray(cfg.boards)) throw new Error('boards.config.json: `boards` must be an array');
  const root = untilde(process.env.OPENDRONE_HARDWARE || cfg.root || '');
  return cfg.boards.map(({handle, pcb}) => ({
    handle,
    pcb: isAbsolute(pcb) ? pcb : resolve(root, untilde(pcb)),
  }));
}
