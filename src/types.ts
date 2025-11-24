// types.ts

export type DetectedType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'unknown';

export interface FieldValidationConfig {
  // Basic validation metadata
  required: boolean;
  patternKey: string;
  detectedType: DetectedType;

  // Optional string length constraints
  minLength?: number;
  maxLength?: number;

  // For root fields only: reference to an ObjectType (e.g. "Role", "Task")
  objectType?: string;
}

export type FieldsConfig = Record<string, FieldValidationConfig>;

export type PatternsMap = Record<string, string>;
