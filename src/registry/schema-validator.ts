import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020';
import { ENTITY_KINDS, type EntityKind } from './types';

const SCHEMA_FILE = /\.schema\.json$/;

export const KIND_SCHEMA_IDS: Record<EntityKind, string> = Object.fromEntries(
  ENTITY_KINDS.map((kind) => [kind, `urn:ai-agent-setup:catalog:v1:${kind.toLowerCase()}`]),
) as Record<EntityKind, string>;

export interface SchemaCheck {
  valid: boolean;
  errors: string[];
}

/** Compiles every JSON Schema found in a schemas directory (draft 2020-12). */
export class SchemaValidator {
  private readonly ajv: Ajv2020;
  private readonly compiled = new Map<string, ValidateFunction>();

  constructor(schemasDir: string) {
    // strictRequired is off because conditional `if/then: {required: [...]}` is used deliberately
    // (GateResult evidence, Tool type); every other strict check stays on.
    this.ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
    for (const name of readdirSync(schemasDir).filter((file) => SCHEMA_FILE.test(file)).sort()) {
      this.ajv.addSchema(JSON.parse(readFileSync(join(schemasDir, name), 'utf8')));
    }
  }

  validate(schemaId: string, value: unknown): SchemaCheck {
    const validateFn = this.getValidator(schemaId);
    const valid = validateFn(value);
    return { valid, errors: valid ? [] : formatErrors(validateFn.errors ?? []) };
  }

  validateEntry(kind: EntityKind, value: unknown): SchemaCheck {
    return this.validate(KIND_SCHEMA_IDS[kind], value);
  }

  private getValidator(schemaId: string): ValidateFunction {
    const cached = this.compiled.get(schemaId);
    if (cached) return cached;
    const validateFn = this.ajv.getSchema(schemaId);
    if (!validateFn) throw new Error(`Schema not found: ${schemaId}`);
    this.compiled.set(schemaId, validateFn);
    return validateFn;
  }
}

function formatErrors(errors: ErrorObject[]): string[] {
  return errors.map((error) => {
    const location = error.instancePath || '/';
    const detail =
      error.keyword === 'unevaluatedProperties' || error.keyword === 'additionalProperties'
        ? `unknown property "${String(Object.values(error.params)[0])}"`
        : error.message ?? error.keyword;
    return `${location}: ${detail}`;
  });
}
