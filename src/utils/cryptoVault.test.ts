import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptVaultPayload,
  encryptVaultBundle,
  normalizePinDigits,
  VaultError,
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
