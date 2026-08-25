// Strips duplicate page-level h2 titles (TopBar owns the title).
// UTF-8 safe. Handles single-line and multi-line h2 blocks.
const fs = require('fs');
const path = require('path');
const base = path.join(__dirname, '..', 'src', 'features');
const targets = [
  'briefing/Briefing.tsx', 'campaigns/Campaigns.tsx', 'carts/CartRecovery.tsx',
  'chat/Chat.tsx', 'coupons/CouponsManager.tsx', 'customers/Customers.tsx',
  'kpis/Kpis.tsx', 'objectives/WeeklyPlan.tsx', 'orders/Orders.tsx',
  'products/Products.tsx', 'retention/Retention.tsx', 'reviews/Reviews.tsx',
  'settings/Settings.tsx', 'store-products/StoreProducts.tsx', 'team/Team.tsx',
];
const re = /\n[ \t]*<h2 className="text-lg font-semibold[\s\S]*?<\/h2>/;
for (const t of targets) {
  const p = path.join(base, t);
  let src = fs.readFileSync(p, 'utf8');
  if (!re.test(src)) { console.log('SKIP (no match):', t); continue; }
  src = src.replace(re, '');
  // collapse a leading blank line right after the opening container div
  src = src.replace(/(return \(\n\s*<div[^>]*>\n)\n+/, '$1');
  fs.writeFileSync(p, src, 'utf8');
  console.log('STRIPPED:', t);
}
