import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/** Builds dist/ once per run: e2e tests execute the compiled policy hook as a separate process. */
export default function setup(): void {
  const root = join(__dirname, '..');
  execFileSync(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.build.json'], {
    cwd: root,
    stdio: 'inherit',
  });
}
