// Optional AI tools backed by Google Gemini. Everything here degrades gracefully:
// if GEMINI_API_KEY is not set, /status says so and the UI hides the buttons.
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppContext } from '../env';
import { requireRole } from '../lib/auth';
import { randomId } from '../lib/crypto';
import { getImage, putImage } from '../lib/imageStore';
import { str } from '../lib/validate';

export const ai = new Hono<AppContext>();
ai.use('*', requireRole('admin', 'sub-admin'));

const TEXT_MODEL = 'gemini-2.5-flash';
const IMAGE_MODEL = 'gemini-2.5-flash-image';

ai.get('/status', (c) => c.json({ enabled: !!c.env.GEMINI_API_KEY }));

function key(c: any): string {
  if (!c.env.GEMINI_API_KEY) throw new HTTPException(503, { message: 'AI tools are not configured (GEMINI_API_KEY missing)' });
  return c.env.GEMINI_API_KEY;
}

async function gemini(apiKey: string, model: string, body: unknown) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new HTTPException(502, { message: `Gemini error ${res.status}: ${t.slice(0, 300)}` });
  }
  return res.json<any>();
}

async function loadImagePart(c: any, ref: string) {
  if (ref.startsWith('data:')) {
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(ref);
    if (!m) throw new HTTPException(400, { message: 'Bad data URL' });
    return { inline_data: { mime_type: m[1], data: m[2] } };
  }
  const id = ref.replace(/^\/img\//, '');
  const obj = await getImage(c.env.IMAGES, id);
  if (!obj) throw new HTTPException(404, { message: 'Image not found' });
  const buf = new Uint8Array(obj.bytes);
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { inline_data: { mime_type: obj.contentType, data: btoa(bin) } };
}

async function saveGeneratedImage(c: any, part: any, menuId: string | null) {
  const data: string = part.inlineData?.data ?? part.inline_data?.data;
  const mime: string = part.inlineData?.mimeType ?? part.inline_data?.mime_type ?? 'image/png';
  const bytes = Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0));
  const id = randomId('img');
  await putImage(c.env.IMAGES, id, bytes, mime);
  await c.env.DB.prepare('INSERT INTO images (id, menu_id, content_type, bytes, created_by) VALUES (?,?,?,?,?)')
    .bind(id, menuId, mime, bytes.byteLength, c.get('user')?.id ?? null).run();
  return `/img/${id}`;
}

const imageParts = (resp: any) => (resp.candidates?.[0]?.content?.parts ?? []).filter((p: any) => p.inlineData || p.inline_data);

/** Write bilingual copy + estimate nutrition from a photo and/or a name. */
ai.post('/describe', async (c) => {
  const apiKey = key(c);
  const b = await c.req.json<{ image?: string; name?: string; ingredients?: string[] }>();
  const parts: any[] = [];
  if (b.image) parts.push(await loadImagePart(c, b.image));
  parts.push({
    text:
      `You write menu copy for a luxury private kitchen in Saudi Arabia. ` +
      `Dish name hint: "${str(b.name, 'name', { max: 200 })}". Known ingredients: ${(b.ingredients ?? []).join(', ') || 'unknown'}.\n` +
      `Return ONLY JSON with this exact shape:\n` +
      `{"name":{"en":"","ar":""},"description":{"en":"2 sentences, sensory, no prices","ar":"جملتان بلغة بيضاء راقية"},` +
      `"ingredients":[{"en":"","ar":""}],"nutrition":{"calories":0,"protein":0,"fat":0,"carbohydrates":0,"fiber":0},` +
      `"suitableFor":["breakfast|lunch|dinner|pre-workout|post-workout|light-meal|high-protein|low-carb"],` +
      `"coreComponents":["nuts|fish|olive-oil|dairy|vegetables|fruit|legumes|whole-grains"]}\n` +
      `Arabic must be natural Gulf-friendly Modern Standard Arabic. Nutrition is a realistic per-serving estimate.`,
  });
  const resp = await gemini(apiKey, TEXT_MODEL, {
    contents: [{ parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
  });
  const text = resp.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '{}';
  try {
    return c.json({ result: JSON.parse(text) });
  } catch {
    throw new HTTPException(502, { message: 'AI returned something that was not valid JSON' });
  }
});

/** Translate one bilingual field: fills the missing side. */
ai.post('/translate', async (c) => {
  const apiKey = key(c);
  const b = await c.req.json<{ text: string; to: 'en' | 'ar' }>();
  const text = str(b.text, 'text', { max: 4000, required: true });
  const resp = await gemini(apiKey, TEXT_MODEL, {
    contents: [{ parts: [{ text: `Translate this restaurant menu text to ${b.to === 'ar' ? 'natural, elegant Arabic (لغة بيضاء، سلسة وليست رسمية جامدة)' : 'natural, elegant English'}. Return only the translation.\n\n${text}` }] }],
    generationConfig: { temperature: 0.3 },
  });
  const out = resp.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('').trim() ?? '';
  return c.json({ text: out });
});

/** Hero shot: isolate the dish on a clean white background with a soft shadow. */
ai.post('/hero', async (c) => {
  const apiKey = key(c);
  const b = await c.req.json<{ image: string; menuId?: string }>();
  const img = await loadImagePart(c, str(b.image, 'image', { required: true, max: 10_000_000 }));
  const resp = await gemini(apiKey, IMAGE_MODEL, {
    contents: [{ parts: [img, { text: 'Re-render this exact dish as a premium food-delivery hero photo: same plating and food, pure white seamless background, soft natural shadow under the plate, bright even studio lighting, top-down 3/4 angle, square 1:1 composition, no text, no extra props.' }] }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  });
  const parts = imageParts(resp);
  if (!parts.length) throw new HTTPException(502, { message: 'AI did not return an image' });
  return c.json({ image: await saveGeneratedImage(c, parts[0], b.menuId ?? null) });
});

/** Up to three alternate camera angles of the same dish. */
ai.post('/angles', async (c) => {
  const apiKey = key(c);
  const b = await c.req.json<{ image: string; menuId?: string }>();
  const img = await loadImagePart(c, str(b.image, 'image', { required: true, max: 10_000_000 }));
  const prompts = [
    'Same exact dish and plating, photographed straight top-down (flat lay), white background, soft shadow, square.',
    'Same exact dish and plating, low 20-degree side angle showing height and texture, white background, soft shadow, square.',
    'Same exact dish and plating, close macro detail of the most appetizing part, shallow depth of field, white background, square.',
  ];
  const out: string[] = [];
  for (const p of prompts) {
    const resp = await gemini(apiKey, IMAGE_MODEL, {
      contents: [{ parts: [img, { text: p }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    });
    const parts = imageParts(resp);
    if (parts.length) out.push(await saveGeneratedImage(c, parts[0], b.menuId ?? null));
  }
  if (!out.length) throw new HTTPException(502, { message: 'AI did not return any images' });
  return c.json({ images: out });
});

/** Generate a brand-new dish photo from a text description (when no photo exists yet). */
ai.post('/generate', async (c) => {
  const apiKey = key(c);
  const b = await c.req.json<{ prompt: string; menuId?: string }>();
  const prompt = str(b.prompt, 'prompt', { required: true, max: 1000 });
  const resp = await gemini(apiKey, IMAGE_MODEL, {
    contents: [{ parts: [{ text: `Photorealistic premium food photography of: ${prompt}. Plated on fine white ceramic, pure white seamless background, soft natural shadow, bright studio light, square 1:1, no text.` }] }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  });
  const parts = imageParts(resp);
  if (!parts.length) throw new HTTPException(502, { message: 'AI did not return an image' });
  return c.json({ image: await saveGeneratedImage(c, parts[0], b.menuId ?? null) });
});
