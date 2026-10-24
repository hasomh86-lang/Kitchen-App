/**
 * Photo storage on Workers KV (free tier, no payment card needed — unlike R2).
 * Each photo is one KV value (≤ 25 MB; uploads are capped at 8 MB) with its
 * content type kept in KV metadata.
 */
type Meta = { contentType: string };

export async function putImage(kv: KVNamespace, id: string, bytes: ArrayBuffer | Uint8Array, contentType: string) {
  await kv.put(id, bytes, { metadata: { contentType } satisfies Meta });
}

export async function getImage(kv: KVNamespace, id: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const { value, metadata } = await kv.getWithMetadata<Meta>(id, { type: 'arrayBuffer', cacheTtl: 86400 });
  if (!value) return null;
  return { bytes: value, contentType: metadata?.contentType ?? 'image/jpeg' };
}

export async function deleteImage(kv: KVNamespace, id: string) {
  await kv.delete(id);
}
