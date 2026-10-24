-- Artisan Kitchen v2 — D1 (SQLite) schema
-- Bilingual text is stored as JSON: {"en":"...","ar":"..."}

PRAGMA foreign_keys = ON;

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE menus (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  settings TEXT NOT NULL DEFAULT '{}',
  content_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_menus_client ON menus(client_id);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '{"en":"","ar":""}',
  description TEXT NOT NULL DEFAULT '{"en":"","ar":""}',
  image TEXT,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  disclaimer_enabled INTEGER NOT NULL DEFAULT 0,
  disclaimer_image TEXT,
  disclaimer_text TEXT NOT NULL DEFAULT '{"en":"","ar":""}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_categories_menu ON categories(menu_id, sort_order);

CREATE TABLE dishes (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '{"en":"","ar":""}',
  description TEXT NOT NULL DEFAULT '{"en":"","ar":""}',
  extra_info TEXT NOT NULL DEFAULT '{"en":"","ar":""}',
  image TEXT,
  angle_images TEXT NOT NULL DEFAULT '[]',
  ingredients TEXT NOT NULL DEFAULT '[]',
  side_dishes TEXT NOT NULL DEFAULT '[]',
  nutrition TEXT NOT NULL DEFAULT '{"calories":0,"protein":0,"fat":0,"carbohydrates":0,"fiber":0}',
  suitable_for TEXT NOT NULL DEFAULT '[]',
  core_components TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  recommended_dish_ids TEXT NOT NULL DEFAULT '[]',
  is_hidden INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_dishes_menu ON dishes(menu_id, category_id, sort_order);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login_at TEXT
);

-- Non-admin staff are scoped to menus through assignments. Admin sees all.
CREATE TABLE staff_assignments (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, menu_id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,              -- sha256 of the cookie token
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  user_agent TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Registered guest devices (iPads) that may open a menu.
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  building TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL,
  token_preview TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT
);
CREATE INDEX idx_devices_menu ON devices(menu_id);
CREATE INDEX idx_devices_token ON devices(token_hash);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  customer_name TEXT NOT NULL DEFAULT '',
  customer_contact TEXT NOT NULL DEFAULT '',
  delivery_at TEXT,
  special_instructions TEXT NOT NULL DEFAULT '',
  internal_notes TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]',
  events TEXT NOT NULL DEFAULT '[]',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_orders_menu_status ON orders(menu_id, status, updated_at);
CREATE UNIQUE INDEX idx_orders_number ON orders(menu_id, number);

-- Uploaded images (metadata; bytes live in R2 under key = id)
CREATE TABLE images (
  id TEXT PRIMARY KEY,
  menu_id TEXT,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  detail TEXT
);
