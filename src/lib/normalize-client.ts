import { OWNER_YES, OWNER_NO, INT_FIELDS, FLOAT_FIELDS, BOOL_FIELDS } from "./constants";

/**
 * Normalize a single client field value for Prisma compatibility.
 * Handles type casting (string→Int/Float/Boolean) and isOwner normalization.
 */
export function normalizeField(field: string, value: any): any {
  if (value === undefined) return undefined;

  // isOwner: legacy values → "Oui" / "Non"
  if (field === "isOwner" && typeof value === "string") {
    return OWNER_YES.has(value) ? "Oui" : OWNER_NO.has(value) ? "Non" : value;
  }
  // Int fields
  if (INT_FIELDS.has(field) && value !== null) {
    return typeof value === "string" ? parseInt(value) || 0 : value;
  }
  // Float fields
  if (FLOAT_FIELDS.has(field) && value !== null) {
    return typeof value === "string" ? parseFloat(value) || 0 : value;
  }
  // Boolean fields
  if (BOOL_FIELDS.has(field) && typeof value === "string") {
    return value === "true" || value === "1";
  }
  return value;
}

/**
 * Build updateData from body, filtering only allowed fields and normalizing types.
 */
export function buildUpdateData(body: Record<string, any>, allowedFields: string[]): Record<string, any> {
  const data: Record<string, any> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = normalizeField(field, body[field]);
    }
  }
  return data;
}
