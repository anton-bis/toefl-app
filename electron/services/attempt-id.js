const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const RANDOM_CHARS = 16;

function randomIndex() {
  const bytes = new Uint8Array(4);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return bytes[0] % CROCKFORD.length;
}

function encodeTime(time) {
  let encoded = '';
  for (let index = 9; index >= 0; index -= 1) {
    encoded += CROCKFORD[(time >> (index * 5)) & 0x1f];
  }
  return encoded;
}

// A sortable, collision-resistant identifier (ULID-shaped) for each practice
// attempt. The first 10 characters encode the creation time in milliseconds.
export function createClientAttemptId(now = Date.now()) {
  let id = encodeTime(now);
  for (let index = 0; index < RANDOM_CHARS; index += 1) {
    id += CROCKFORD[randomIndex()];
  }
  return id;
}

export function isClientAttemptId(value) {
  return typeof value === 'string' && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
}
