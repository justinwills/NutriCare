// Express 4 does not forward rejected promises from async route handlers.
// Wrapping them keeps database failures in the normal error middleware
// instead of producing unhandled rejections or hanging requests.
export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
