import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const MAX_BYTES = 256 * 1024;
const BLOCKED_DIRS = new Set(['.git', 'node_modules', 'data', 'backups', 'secrets', 'config']);
const BLOCKED_FILE = /(^|\/)(package\.json|package-lock\.json|bootstrap\.js|server\.js|\.env[^/]*|.*\.pem|.*\.key)$/i;

/**
 * Proposal staging only. Never executes generated code or overwrites target files.
 * Owner review and a separate deployment are required to apply any proposal.
 */
export class KimGovernedSandbox {
  constructor({ repositoryRoot = process.cwd(), holdingDirectory, clock = () => Date.now() } = {}) {
    this.root = path.resolve(repositoryRoot);
    this.holding = path.resolve(holdingDirectory || path.join(path.dirname(this.root), 'sbc-staged-patches'));
    this.clock = clock;
  }

  async stagePatchProposal({ targetRelativePath, proposedSource, baselineSource = '' } = {}) {
    if (typeof targetRelativePath !== 'string' || !targetRelativePath.trim()) throw new TypeError('targetRelativePath required');
    if (typeof proposedSource !== 'string' || !proposedSource.trim()) throw new TypeError('proposedSource required');
    if (Buffer.byteLength(proposedSource, 'utf8') > MAX_BYTES) throw new Error('Patch exceeds size limit');

    const relative = targetRelativePath.replace(/\\/g, '/');
    const segments = relative.split('/');
    if (path.isAbsolute(relative) || segments.some(part => part === '..' || BLOCKED_DIRS.has(part)) || BLOCKED_FILE.test(relative)) {
      throw new Error('Target path outside permitted proposal scope');
    }
    const target = path.resolve(this.root, relative);
    if (!target.startsWith(this.root + path.sep)) throw new Error('Target path escapes repository root');

    // Syntax parse only. The candidate source is never evaluated.
    new vm.Script(proposedSource, { filename: 'staged-proposal.js' });
    const proposalId = 'proposal_' + this.clock() + '_' + createHash('sha256').update(relative + '\0' + proposedSource).digest('hex').slice(0, 16);
    const baselineHash = createHash('sha256').update(String(baselineSource), 'utf8').digest('hex');
    const proposedHash = createHash('sha256').update(proposedSource, 'utf8').digest('hex');

    await fs.mkdir(this.holding, { recursive: true, mode: 0o700 });
    const realHolding = await fs.realpath(this.holding);
    const realRoot = await fs.realpath(this.root);
    if (realHolding === realRoot || realHolding.startsWith(realRoot + path.sep)) {
      throw new Error('Holding directory must be outside the active repository');
    }
    const proposalPath = path.join(realHolding, proposalId + '.json');
    const record = { proposalId, targetRelativePath: relative, baselineHash, proposedHash, proposedSource, status: 'PENDING_OWNER_REVIEW', createdAt: this.clock() };
    await fs.writeFile(proposalPath, JSON.stringify(record, null, 2), { flag: 'wx', mode: 0o600 });
    return { staged: true, proposalId, status: record.status, baselineHash, proposedHash, proposalPath };
  }
}
