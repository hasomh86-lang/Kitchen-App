# Artisan Kitchen v2

A private-kitchen menu platform rebuilt from scratch: bilingual (Arabic / English) luxury menu for guests, and a role-based console for the team (Admin, Menu editor, Butler, Chef). Runs entirely on Cloudflare's free tier — no Supabase, no Replit.

**العربية في الأسفل ⬇**

---

## What's in the box

| Area | What it does |
|---|---|
| **Public menu** `/m/<slug>` | Device-gated (or open) catalog. Categories → dishes → full dish sheet (photo gallery, nutrition, 8 core components, ingredients with grams, sides, tags, "pairs well with"). Arabic/English toggle with full RTL. Per-category disclaimer popup. Works offline on iPads (cached menu + photos). Four themes. |
| **Admin** `/admin` | Dashboard, dishes (grid/list, drag-reorder, bilingual editor, photo upload with auto-resize, AI tools), categories, appearance (theme, texts, logo), devices (access codes), menus & clients, team & roles, audit log. |
| **Butler** `/butler` | Create orders for guests, send to kitchen, drive delivery → completion. Live board, polls every 5 s. |
| **Chef** `/chef` | Kitchen queue: start preparing, mark ready, reject. Big-type cards for a wall tablet. |
| **API** | Hono on a Cloudflare Worker. D1 (SQLite) + R2 (photos). Sessions in HttpOnly cookies, PBKDF2 passwords, CSRF guard, per-menu role scoping, optimistic concurrency on edits, status-transition rules enforced server-side. |
| **AI (optional)** | Gemini: bilingual copy + nutrition estimate from a photo, translate missing language, white-background hero shot, 3 alternate angles, generate a photo from text. Needs `GEMINI_API_KEY`. |
| **Import** | `scripts/import-supabase.mjs` migrates the old Supabase CSV export, including photos from a private bucket. |

Roles & permissions:

| | Admin | Menu editor (sub-admin) | Butler | Chef |
|---|---|---|---|---|
| Dishes / categories / appearance | ✅ | ✅ (assigned menus) | – | – |
| Orders: create, submit, deliver, complete | ✅ | – | ✅ | – |
| Orders: start preparing, ready, reject | ✅ | – | – | ✅ |
| Devices, menus, clients, team | ✅ | – | – | – |

---

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars        # add GEMINI_API_KEY if you have one
npm run db:migrate:local
npm run db:seed:local                 # demo menu "main-menu", device code 000000
npm run dev                           # web on :5173 (proxies API), worker on :8787
```

Open http://localhost:5173/setup to create the first administrator, then:
- http://localhost:5173/m/main-menu — public menu (code `000000`)
- http://localhost:5173/admin — console

`npm run build && npx wrangler dev` serves the production build on :8787.

## Deploy to Cloudflare (free)

1. Create a free Cloudflare account and install Wrangler: `npx wrangler login`.
2. Create the database and bucket:
   ```bash
   npx wrangler d1 create artisan-kitchen           # copy the database_id into wrangler.jsonc
   npx wrangler r2 bucket create artisan-kitchen-images
   ```
3. Edit `wrangler.jsonc`: paste the `database_id`; set `PUBLIC_ORIGIN` later to your real URL.
4. Secrets:
   ```bash
   npx wrangler secret put SESSION_SECRET            # any long random string
   npx wrangler secret put GEMINI_API_KEY            # optional
   ```
5. Migrate and deploy:
   ```bash
   npm run db:migrate
   npm run deploy
   ```
   Wrangler prints your URL (`https://artisan-kitchen.<you>.workers.dev`). Open `/setup` once to create the admin.
6. Custom domain (optional): Workers → your worker → Settings → Domains & Routes → add e.g. `menu.yourdomain.com`.

Free-tier headroom: 100k requests/day, 5 GB D1, 10 GB R2 — far beyond a private kitchen's traffic.

## Import the old data

```bash
# put the Supabase exports here:
import-work/categories.csv
import-work/dishes.csv
# create import-work/.env:
TARGET_URL=https://artisan-kitchen.<you>.workers.dev
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=********
MENU_SLUG=main-menu
SUPABASE_URL=https://ixnddbaczpuqtqdnecpd.supabase.co
SUPABASE_SERVICE_KEY=<Project Settings → API → service_role>
REPLACE=true          # wipe the demo content first

node scripts/import-supabase.mjs
```
Photos are fetched straight from the (private) Supabase bucket and stored in R2. Anything that fails is listed in `import-work/image-failures.json`. Names come in as English; Arabic names can be filled in the editor — with a Gemini key the ✨ button translates each field in one click.

## Project layout

```
worker/           Cloudflare Worker (Hono): routes/, lib/ (auth, crypto, db mapping, validation)
migrations/       D1 schema
seed/             demo data
shared/types.ts   types shared by API and web
src/              React 19 + Vite + Tailwind v4
  pages/public/   guest menu
  pages/staff/    console (admin / butler / chef)
  components/     ui primitives, forms, icons
  lib/            api client, i18n, auth, staff data hooks, offline cache
scripts/          import-supabase.mjs
public/           service worker, manifest, icons
```

---

# بالعربي

## وش هذا؟
نسخة جديدة بالكامل من منيو Artisan Kitchen: قائمة فاخرة للضيوف بالعربي والإنجليزي (مع اتجاه RTL كامل)، ولوحة تحكم للفريق بأدوار (مدير، محرر قائمة، باتلر، شيف). تشتغل كاملة على Cloudflare المجاني — بدون Supabase ولا Replit ولا اشتراكات.

## ليش أفضل من القديمة؟
- **سرعة**: قاعدة البيانات والصور والتطبيق كلهم على شبكة Cloudflare، فالمنيو يفتح فوراً من السعودية.
- **ما تضيع بيانات**: كل حفظ يتأكد من السيرفر قبل ما يظهر لك، وفي حماية لو شخصين عدّلوا نفس الطبق.
- **يشتغل بدون إنترنت**: الآيباد يحفظ آخر نسخة من المنيو والصور ويعرضها لو انقطع النت.
- **لغتين**: كل اسم ووصف ومكوّن له خانة عربي وخانة إنجليزي، والضيف يبدّل بزر واحد.
- **AI اختياري**: ترجمة الناقص، كتابة الوصف وتقدير السعرات من الصورة، صورة "هيرو" بخلفية بيضاء، وثلاث زوايا للطبق.
- **صفر اشتراكات**: الحد المجاني في Cloudflare أكبر بكثير من استهلاك مطبخ خاص.

## خطوات التشغيل (مختصر)
1. `npm install`
2. `npx wrangler login` ثم أنشئ قاعدة البيانات والـ bucket (الأوامر فوق في القسم الإنجليزي).
3. حط `database_id` في `wrangler.jsonc`.
4. `npm run db:migrate` ثم `npm run deploy`.
5. افتح `/setup` وأنشئ حساب المدير.
6. استورد بياناتك القديمة بـ `node scripts/import-supabase.mjs` (الشرح فوق).

## الأدوار
- **مدير**: كل شي.
- **محرر قائمة**: الأطباق والتصنيفات والمظهر للقوائم المعيّنة له فقط.
- **باتلر**: ينشئ الطلبات ويرسلها للمطبخ ويتابع التوصيل حتى الإكمال.
- **شيف**: يشوف طابور المطبخ فقط: يبدأ التحضير، جاهز، أو يرفض.
