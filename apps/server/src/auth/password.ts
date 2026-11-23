import { hash, verify } from '@node-rs/argon2';

/** Argon2id with the library defaults (NFR-6). */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}
