import { ConflictException, NotFoundException } from '@nestjs/common';

// Error body is a superset of Nest's default { statusCode, error, message } so clients
// can rely on `code` for domain failures without losing the usual fields.
export function apiError(
  Exc: typeof NotFoundException | typeof ConflictException,
  code: string,
  message: string,
) {
  const e = new Exc();
  return new Exc({
    statusCode: e.getStatus(),
    error: e.name.replace('Exception', '').replace(/([a-z])([A-Z])/g, '$1 $2'),
    code,
    message,
  });
}
