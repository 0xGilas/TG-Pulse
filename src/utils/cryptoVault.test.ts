import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptVaultPayload,
  encryptVaultBundle,
  normalizePinDigits,
  sanitizeNetworkForUnencryptedStorage,
  VaultError,
  resetPinLockout,
} from './cryptoVault';

test('encryptVaultBundle + decryptVaultPayload succeeds with numeric PIN 7743', async () => {
  const payload = await encryptVaultBundle(
    {
      sessionString: 'v3-sample-mtproto-session-token-abc123',
      apiCreds: { apiId: 12345678, apiHash: '0123456789abcdef0123456789abcdef' },
    },
    '7743',
  );

  assert.equal(payload.hasPin, true);

  const decrypted = await decryptVaultPayload(payload, '7743');
  assert.equal(decrypted.sessionString, 'v3-sample-mtproto-session-token-abc123');
  assert.equal(decrypted.apiCreds?.apiId, 12345678);
  assert.equal(decrypted.apiCreds?.apiHash, '0123456789abcdef0123456789abcdef');
});

test('decryptVaultPayload normalizes Persian and Arabic numerals seamlessly', async () => {
  const payload = await encryptVaultBundle(
    { sessionString: 'persian-numeral-session' },
    '7743',
  );
  assert.equal(normalizePinDigits('۷۷۴۳'), '7743');

  const decrypted = await decryptVaultPayload(payload, '۷۷۴۳');
  assert.equal(decrypted.sessionString, 'persian-numeral-session');
});

test('decryptVaultPayload rejects wrong PIN with WRONG_PIN and empty PIN with PIN_REQUIRED', async () => {
  const payload = await encryptVaultBundle(
    { sessionString: 'locked-session' },
    '7743',
  );

  await assert.rejects(
    () => decryptVaultPayload(payload, '0000'),
    (err: unknown) => err instanceof VaultError && err.code === 'WRONG_PIN',
  );

  await assert.rejects(
    () => decryptVaultPayload(payload, ''),
    (err: unknown) => err instanceof VaultError && err.code === 'PIN_REQUIRED',
  );
});

test('encryptVaultBundle without PIN decrypts cleanly using device key', async () => {
  const payload = await encryptVaultBundle(
    { sessionString: 'device-locked-session' },
    '',
  );
  assert.equal(payload.hasPin, false);

  const decrypted = await decryptVaultPayload(payload);
  assert.equal(decrypted.sessionString, 'device-locked-session');
});

test('decryptVaultPayload locks out after 5 consecutive incorrect PIN attempts', async () => {
  resetPinLockout();
  const payload = await encryptVaultBundle(
    { sessionString: 'brute-force-target' },
    '9999',
  );

  // 4 failed attempts should yield WRONG_PIN
  for (let i = 0; i < 4; i++) {
    await assert.rejects(
      () => decryptVaultPayload(payload, '1111'),
      (err: unknown) => err instanceof VaultError && err.code === 'WRONG_PIN',
    );
  }

  // 5th failed attempt should trigger lockout
  await assert.rejects(
    () => decryptVaultPayload(payload, '1111'),
    (err: unknown) => err instanceof VaultError && err.code === 'WRONG_PIN',
  );

  // 6th attempt should be blocked with PIN_LOCKED
  await assert.rejects(
    () => decryptVaultPayload(payload, '9999'), // even with correct PIN, must be locked!
    (err: unknown) => err instanceof VaultError && err.code === 'PIN_LOCKED',
  );

  resetPinLockout();
});

test('sanitizeNetworkForUnencryptedStorage strips SOCKS5 password while preserving non-secret fields', () => {
  const sanitized = sanitizeNetworkForUnencryptedStorage({
    mode: 'socks5-bridge',
    socks5: {
      bridgeUrl: 'ws://127.0.0.1:8787',
      host: '127.0.0.1',
      port: 1080,
      username: 'alice',
      password: 'super-secret-password',
    },
    cfRelayUrl: '',
  });
  assert.equal(sanitized.socks5.password, '');
  assert.equal(sanitized.socks5.username, 'alice');
  assert.equal(sanitized.socks5.host, '127.0.0.1');
});
