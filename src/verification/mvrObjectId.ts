import { normalizeSuiObjectId } from '@mysten/sui/utils';

export const normalizeSuiObjectIdForCompare = (objectId: string): string => {
  try {
    return normalizeSuiObjectId(objectId);
  } catch {
    return objectId.toLowerCase();
  }
};

export const isSameSuiObjectId = (left: string, right: string): boolean =>
  normalizeSuiObjectIdForCompare(left) === normalizeSuiObjectIdForCompare(right);
