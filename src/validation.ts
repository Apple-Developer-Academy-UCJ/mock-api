import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { Resource } from './schema.js';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const invalid = (message: string): never => { throw new ApiError(400, 'invalid_input', message); };

export function parseId(value: unknown, label = 'id'): number {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) return invalid(`${label} must be a positive integer.`);
  return Number(value);
}

export function validateBody(body: unknown, resource: Resource, partial: boolean, db: DatabaseSync): Record<string, SQLInputValue> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid('Body must be a JSON object.');
  const input = body as Record<string, unknown>;
  for (const key of Object.keys(input)) if (!Object.hasOwn(resource.fields, key)) invalid(`Unknown or read-only field: ${key}.`);
  if (partial && Object.keys(input).length === 0) invalid('Supply at least one writable field.');
  const result: Record<string, SQLInputValue> = {};
  for (const [key, field] of Object.entries(resource.fields)) {
    if (!Object.hasOwn(input, key)) {
      if (partial) continue;
      if (field.nullable) { result[key] = null; continue; }
      invalid(`${key} is required.`);
    }
    const value = input[key];
    if (value === null && field.nullable) { result[key] = null; continue; }
    if (field.type === 'string') {
      if (typeof value !== 'string' || !value.trim()) invalid(`${key} must be a nonempty string.`);
      const string = value as string;
      if (field.values && !field.values.includes(string)) invalid(`${key} must be one of: ${field.values.join(', ')}.`);
      if (field.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(string)) invalid(`${key} must be a valid email address.`);
      if (field.url) {
        try { if (!['http:', 'https:'].includes(new URL(string).protocol)) invalid(`${key} must be an HTTP(S) URL.`); }
        catch { invalid(`${key} must be an HTTP(S) URL.`); }
      }
      result[key] = string;
    } else if (field.type === 'boolean') {
      if (typeof value !== 'boolean') invalid(`${key} must be a boolean.`);
      result[key] = Number(value);
    } else {
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) invalid(`${key} must be an integer.`);
      const number = value as number;
      if (field.min !== undefined && number < field.min) invalid(`${key} must be at least ${field.min}.`);
      if (field.max !== undefined && number > field.max) invalid(`${key} must be at most ${field.max}.`);
      if (field.reference && !db.prepare(`SELECT id FROM ${field.reference} WHERE id = ?`).get(number)) invalid(`${key} references a missing ${field.reference} record.`);
      result[key] = number;
    }
  }
  return result;
}
