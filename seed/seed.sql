-- Demo seed: one client, one menu (slug: main-menu), 3 categories, 6 dishes,
-- one registered device whose token is 000000 (change it in Admin → Devices).
-- The first admin account is created from the /setup page in the app.

INSERT OR IGNORE INTO clients (id, name, slug) VALUES ('cl_artisan', 'Artisan Kitchen', 'artisan');

INSERT OR IGNORE INTO menus (id, client_id, name, slug, settings, content_updated_at) VALUES (
  'mn_main', 'cl_artisan', 'Main Menu', 'main-menu',
  json('{"theme":"midnight","defaultLang":"ar","showNutrition":true,"showCoreComponents":true,
        "title":{"en":"Artisan Kitchen","ar":"المطبخ الحرفي"},
        "subtitle":{"en":"Selection","ar":"التشكيلة"},
        "tagline":{"en":"A curated anthology of culinary experiences, crafted for the discerning palate.","ar":"مختارات مدروسة من التجارب الطهوية، صُنعت لذائقة تعرف ما تريد."},
        "philosophyTitle":{"en":"Our philosophy","ar":"فلسفتنا"},
        "philosophyBody":{"en":"Whole ingredients, Mediterranean balance, and plates built around how you want to feel after you eat.","ar":"مكونات كاملة، توازن متوسطي، وأطباق مبنية على الإحساس اللي تبيه بعد الأكل."},
        "logoImage":null,"openAccess":false}'),
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
);

INSERT OR IGNORE INTO categories (id, menu_id, name, description, sort_order) VALUES
('ct_breakfast','mn_main','{"en":"Breakfast","ar":"قائمة الإفطار"}','{"en":"Morning traditions reimagined with modern technique and pristine ingredients.","ar":"تقاليد الصباح بلمسة عصرية ومكونات نقية."}',1),
('ct_appetizers','mn_main','{"en":"Appetizers","ar":"قائمة المقبلات"}','{"en":"A prelude of delicate flavors, designed to awaken the palate.","ar":"مقدّمة من النكهات الرقيقة توقّظ الذائقة."}',2),
('ct_mains','mn_main','{"en":"Mains","ar":"قائمة الأطباق الرئيسية"}','{"en":"The centerpiece of the dining experience: masterful preparations and bold profiles.","ar":"قلب التجربة: تحضيرات متقنة ونكهات جريئة."}',3);

INSERT OR IGNORE INTO dishes (id, menu_id, category_id, name, description, ingredients, side_dishes, nutrition, suitable_for, core_components, tags, is_featured, sort_order) VALUES
('ds_shakshuka','mn_main','ct_breakfast',
 '{"en":"Saffron Shakshuka","ar":"شكشوكة بالزعفران"}',
 '{"en":"Slow-cooked tomato and pepper base, free-range eggs, a thread of saffron and cold-pressed olive oil.","ar":"قاعدة طماطم وفلفل مطهوة على نار هادئة، بيض بلدي، خيط زعفران وزيت زيتون معصور على البارد."}',
 '[{"en":"Tomato","ar":"طماطم"},{"en":"Bell pepper","ar":"فلفل رومي"},{"en":"Eggs","ar":"بيض"},{"en":"Saffron","ar":"زعفران"},{"en":"Olive oil","ar":"زيت زيتون"}]',
 '[{"en":"Sourdough toast","ar":"خبز ساوردو محمص"}]',
 '{"calories":420,"protein":22,"fat":24,"carbohydrates":30,"fiber":7}',
 '["breakfast","high-protein"]','["vegetables","olive-oil"]',
 '[{"label":{"en":"Signature","ar":"توقيع"},"color":"#B08D57"}]',1,1),
('ds_oats','mn_main','ct_breakfast',
 '{"en":"Overnight Oats, Dates & Pistachio","ar":"شوفان بالتمر والفستق"}',
 '{"en":"Steel-cut oats soaked in almond milk, Medjool dates, roasted pistachio and a whisper of cardamom.","ar":"شوفان منقوع بحليب اللوز، تمر مجدول، فستق محمص ولمسة هيل."}',
 '[{"en":"Oats","ar":"شوفان"},{"en":"Almond milk","ar":"حليب لوز"},{"en":"Dates","ar":"تمر"},{"en":"Pistachio","ar":"فستق"}]','[]',
 '{"calories":380,"protein":12,"fat":14,"carbohydrates":52,"fiber":9}',
 '["breakfast","pre-workout"]','["whole-grains","nuts","fruit"]','[]',0,2),
('ds_mezze','mn_main','ct_appetizers',
 '{"en":"Mezze Trio","ar":"ثلاثية المزة"}',
 '{"en":"Silky hummus, smoked muhammara and stuffed vine leaves with crudités and warm flatbread.","ar":"حمص ناعم، محمّرة مدخنة وورق عنب مع خضار طازجة وخبز دافئ."}',
 '[{"en":"Chickpeas","ar":"حمص"},{"en":"Red pepper","ar":"فلفل أحمر"},{"en":"Walnuts","ar":"جوز"},{"en":"Vine leaves","ar":"ورق عنب"}]','[]',
 '{"calories":510,"protein":15,"fat":28,"carbohydrates":50,"fiber":11}',
 '["lunch","dinner","light-meal"]','["legumes","vegetables","nuts","olive-oil"]','[]',1,1),
('ds_tiradito','mn_main','ct_appetizers',
 '{"en":"Salmon Tiradito","ar":"تيراديتو السلمون"}',
 '{"en":"Thin-cut salmon, citrus leche de tigre, edamame and a warm chickpea salad on the side.","ar":"شرائح سلمون رفيعة، صلصة حمضيات، إدامامي وسلطة حمص دافئة."}',
 '[{"en":"Salmon","ar":"سلمون"},{"en":"Lime","ar":"ليمون"},{"en":"Edamame","ar":"إدامامي"},{"en":"Chickpeas","ar":"حمص"}]','[]',
 '{"calories":500,"protein":45,"fat":15,"carbohydrates":42,"fiber":7}',
 '["lunch","dinner","high-protein"]','["fish","legumes","olive-oil"]',
 '[{"label":{"en":"Super meal","ar":"وجبة سوبر"},"color":"#1D9A8F"}]',1,2),
('ds_lamb','mn_main','ct_mains',
 '{"en":"Slow Lamb Shoulder, Saffron Rice","ar":"كتف غنم مطهو ببطء مع رز بالزعفران"}',
 '{"en":"Twelve-hour lamb shoulder, pomegranate glaze, saffron basmati and fresh herbs.","ar":"كتف غنم مطهو اثنا عشر ساعة، صلصة رمان، رز بسمتي بالزعفران وأعشاب طازجة."}',
 '[{"en":"Lamb","ar":"لحم غنم"},{"en":"Basmati rice","ar":"رز بسمتي"},{"en":"Pomegranate","ar":"رمان"},{"en":"Saffron","ar":"زعفران"}]',
 '[{"en":"Garden salad","ar":"سلطة خضراء"}]',
 '{"calories":720,"protein":48,"fat":32,"carbohydrates":58,"fiber":4}',
 '["dinner","post-workout","high-protein"]','["whole-grains","fruit"]','[]',1,1),
('ds_seabass','mn_main','ct_mains',
 '{"en":"Grilled Sea Bass, Charred Vegetables","ar":"قاروص مشوي مع خضار متفحمة"}',
 '{"en":"Whole sea bass, lemon and za''atar, with charred seasonal vegetables and tahini.","ar":"قاروص كامل بالليمون والزعتر مع خضار موسمية مشوية وطحينة."}',
 '[{"en":"Sea bass","ar":"قاروص"},{"en":"Za''atar","ar":"زعتر"},{"en":"Seasonal vegetables","ar":"خضار موسمية"},{"en":"Tahini","ar":"طحينة"}]','[]',
 '{"calories":460,"protein":42,"fat":22,"carbohydrates":18,"fiber":6}',
 '["dinner","low-carb","high-protein"]','["fish","vegetables","olive-oil"]','[]',0,2);

-- Device: token 000000 (sha256 hex)
INSERT OR IGNORE INTO devices (id, menu_id, name, building, location, token_hash, token_preview) VALUES
('dv_demo','mn_main','Demo iPad','Main house','Dining room','91b4d142823f7d20c5f08df69122de43f35f057a988d9619f6d3138485c9a203','0000');
