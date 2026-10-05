import { migrateSave } from './migrations';
import type { SaveNotice, SaveV1, SaveValidationIssue } from './SaveSchema';

export const SAVE_ENVELOPE_FORMAT = 'rivenbloom-save' as const;
export const SAVE_ENVELOPE_VERSION = 1 as const;

export type SaveEnvelope = Readonly<{
  format: 'rivenbloom-save';
  envelopeVersion: 1;
  writtenAtEpochMs: number;
  payload: unknown;
  checksum: string;
}>;

export type DigestProvider = Readonly<{
  digest(algorithm: 'SHA-256', data: BufferSource): Promise<ArrayBuffer>;
}>;

export type DecodedSaveEnvelope =
  | Readonly<{
      kind: 'valid';
      value: SaveV1;
      writtenAtEpochMs: number;
      notices: readonly SaveNotice[];
    }>
  | Readonly<{ kind: 'invalid'; errors: readonly SaveValidationIssue[] }>;

export function canonicalJson(value: unknown): string {
  const active = new Set<object>();

  const encode = (candidate: unknown): string => {
    if (candidate === null) return 'null';
    if (typeof candidate === 'string' || typeof candidate === 'boolean')
      return JSON.stringify(candidate);
    if (typeof candidate === 'number') {
      if (!Number.isFinite(candidate))
        throw new TypeError('Canonical JSON numbers must be finite.');
      return Object.is(candidate, -0) ? '0' : JSON.stringify(candidate);
    }
    if (typeof candidate !== 'object') throw new TypeError('Value is not canonical JSON.');
    if (active.has(candidate)) throw new TypeError('Canonical JSON cannot contain cycles.');
    active.add(candidate);
    try {
      if (Array.isArray(candidate)) {
        const entries: string[] = [];
        for (let index = 0; index < candidate.length; index += 1) {
          if (!Object.prototype.hasOwnProperty.call(candidate, index)) {
            throw new TypeError('Canonical JSON arrays must be dense.');
          }
          entries.push(encode(candidate[index]));
        }
        return `[${entries.join(',')}]`;
      }
      const prototype: unknown = Object.getPrototypeOf(candidate);
      if (prototype !== Object.prototype && prototype !== null)
        throw new TypeError('Canonical JSON objects must be plain.');
      const entries = Object.entries(candidate).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      );
      return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${encode(entry)}`).join(',')}}`;
    } finally {
      active.delete(candidate);
    }
  };

  return encode(value);
}

export async function createSaveEnvelopeJson(
  payload: unknown,
  writtenAtEpochMs: number,
  digestProvider: DigestProvider = defaultDigestProvider(),
): Promise<string> {
  if (!Number.isSafeInteger(writtenAtEpochMs) || writtenAtEpochMs < 0) {
    throw new RangeError('Envelope write timestamp must be a non-negative safe integer.');
  }
  const unsigned = {
    format: SAVE_ENVELOPE_FORMAT,
    envelopeVersion: SAVE_ENVELOPE_VERSION,
    writtenAtEpochMs,
    payload,
  };
  const checksum = await checksumFor(unsigned, digestProvider);
  return canonicalJson({ ...unsigned, checksum });
}

export async function decodeSaveEnvelope(
  rawJson: string,
  digestProvider: DigestProvider = defaultDigestProvider(),
): Promise<DecodedSaveEnvelope> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return invalid('/', 'invalid-json', 'Save envelope is not valid JSON.');
  }
  if (!isPlainRecord(parsed))
    return invalid('/', 'invalid-type', 'Save envelope must be a plain object.');
  const errors: SaveValidationIssue[] = [];
  rejectUnknown(
    parsed,
    ['format', 'envelopeVersion', 'writtenAtEpochMs', 'payload', 'checksum'],
    errors,
  );
  requiredLiteral(parsed, 'format', SAVE_ENVELOPE_FORMAT, errors);
  requiredLiteral(parsed, 'envelopeVersion', SAVE_ENVELOPE_VERSION, errors);
  const writtenAtEpochMs = requiredNonNegativeInteger(parsed, 'writtenAtEpochMs', errors);
  if (!Object.prototype.hasOwnProperty.call(parsed, 'payload'))
    errors.push({
      path: '/payload',
      code: 'missing-required',
      message: 'Required field is missing.',
    });
  if (typeof parsed.checksum !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(parsed.checksum)) {
    errors.push({
      path: '/checksum',
      code: typeof parsed.checksum === 'undefined' ? 'missing-required' : 'invalid-type',
      message: 'Checksum must use lowercase SHA-256 hexadecimal format.',
    });
  }
  if (errors.length > 0 || writtenAtEpochMs === null || typeof parsed.checksum !== 'string')
    return { kind: 'invalid', errors };
  let expected: string;
  try {
    expected = await checksumFor(
      {
        format: parsed.format,
        envelopeVersion: parsed.envelopeVersion,
        writtenAtEpochMs,
        payload: parsed.payload,
      },
      digestProvider,
    );
  } catch {
    return invalid('/payload', 'invalid-type', 'Envelope payload is not canonical JSON.');
  }
  if (expected !== parsed.checksum)
    return invalid(
      '/checksum',
      'checksum-mismatch',
      'Envelope checksum does not match its contents.',
    );
  const save = migrateSave(parsed.payload);
  if (save.kind === 'invalid') return save;
  return { kind: 'valid', value: save.value, writtenAtEpochMs, notices: save.notices };
}

async function checksumFor(value: unknown, provider: DigestProvider): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await provider.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}

function defaultDigestProvider(): DigestProvider {
  if (globalThis.crypto?.subtle === undefined)
    throw new Error('Web Crypto SHA-256 is unavailable.');
  return globalThis.crypto.subtle;
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function rejectUnknown(
  record: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  errors: SaveValidationIssue[],
): void {
  const known = new Set(allowed);
  Object.keys(record)
    .filter((key) => !known.has(key))
    .sort()
    .forEach((key) =>
      errors.push({
        path: `/${key}`,
        code: 'unknown-field',
        message: 'Unknown field is not allowed in this envelope version.',
      }),
    );
}

function requiredLiteral(
  record: Readonly<Record<string, unknown>>,
  key: string,
  expected: unknown,
  errors: SaveValidationIssue[],
): void {
  if (!Object.prototype.hasOwnProperty.call(record, key))
    errors.push({
      path: `/${key}`,
      code: 'missing-required',
      message: 'Required field is missing.',
    });
  else if (record[key] !== expected)
    errors.push({
      path: `/${key}`,
      code: key === 'envelopeVersion' ? 'unsupported-version' : 'invalid-type',
      message: 'Envelope field has an invalid value.',
    });
}

function requiredNonNegativeInteger(
  record: Readonly<Record<string, unknown>>,
  key: string,
  errors: SaveValidationIssue[],
): number | null {
  const value = record[key];
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    errors.push({
      path: `/${key}`,
      code: 'missing-required',
      message: 'Required field is missing.',
    });
    return null;
  }
  if (typeof value !== 'number') {
    errors.push({ path: `/${key}`, code: 'invalid-type', message: 'Value must be a number.' });
    return null;
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    errors.push({
      path: `/${key}`,
      code: 'out-of-range',
      message: 'Value must be a non-negative safe integer.',
    });
    return null;
  }
  return value;
}

function invalid(
  path: string,
  code: SaveValidationIssue['code'],
  message: string,
): DecodedSaveEnvelope {
  return { kind: 'invalid', errors: [{ path, code, message }] };
}
