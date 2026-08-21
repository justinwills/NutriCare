export function errorMessage(error, fallback = 'Request could not be completed') {
  const message = error && typeof error.message === 'string' ? error.message.trim() : '';
  return message || fallback;
}
