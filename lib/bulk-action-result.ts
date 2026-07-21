export type BulkActionResult = {
  successCount: number;
  failureCount: number;
  errors: string[];
};

export function createBulkActionResult(): BulkActionResult {
  return { successCount: 0, failureCount: 0, errors: [] };
}

export function recordBulkSuccess(result: BulkActionResult) {
  result.successCount += 1;
}

export function recordBulkFailure(result: BulkActionResult, message: string) {
  result.failureCount += 1;
  if (result.errors.length < 5) {
    result.errors.push(message);
  }
}
