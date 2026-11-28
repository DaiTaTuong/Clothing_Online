import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, hashPassword, uuid, cleanState } from '../backend/src/platform/store.mjs';
import { sampleProfile } from '../shared/contracts/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dbFile = process.env.DATABASE_PATH || resolve(root, '.runtime', 'forme.sqlite');
const store = createStore(dbFile);

const seedAccounts = [
  { email: 'studio@forme.demo', name: 'Nhóm FORME (Admin)', password: 'FormeStudio2026!', role: 'admin' },
  { email: 'member@forme.demo', name: 'Khách hàng mẫu', password: 'FormeMember2026!', role: 'member' },
];

for (const acc of seedAccounts) {
  let row = store.get('SELECT id FROM accounts WHERE email=?', acc.email);
  if (!row) {
    const id = uuid();
    store.run('INSERT INTO accounts VALUES (?,?,?,?,?)', id, acc.email, acc.name, await hashPassword(acc.password), acc.role);
    row = { id };
  }
  if (acc.role === 'member') {
    const owner = 'u:' + row.id;
    const state = store.state(owner);
    if (!state.profile) {
      store.put(owner, {
        ...cleanState(),
        ...state,
        profile: sampleProfile,
        profileVersion: Math.max(1, state.profileVersion),
        cart: state.cart.length ? state.cart : [{ productId: 'rose-knit', size: 'M', quantity: 1 }],
      });
    }
  }
}

const stats = {
  dbFile,
  accounts: store.get('SELECT count(*) AS n FROM accounts').n,
  states: store.get('SELECT count(*) AS n FROM states').n,
  jobs: store.get('SELECT count(*) AS n FROM jobs').n,
};
store.db.close();
console.log('Seeded SQLite schema & sample data:', JSON.stringify(stats));
