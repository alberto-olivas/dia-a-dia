import { chromium } from 'playwright';
import { join } from 'path';
import { tmpdir } from 'os';

const OUT = tmpdir();
const BASE = 'http://localhost:3000';
// Storage key derived from NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
// Format: sb-{hostname.split('.')[0]}-auth-token
const KEY = 'sb-your-project-auth-token';
const TODAY = new Date().toISOString().split('T')[0];
const NOW_ISO = new Date().toISOString();
const UID = '00000000-0000-0000-0000-000000000001';

const SESSION_JSON = JSON.stringify({
  access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJlbWFpbCI6ImRlbW9AZXhhbXBsZS5jb20iLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjk5OTk5OTk5OTksImlhdCI6MTcwMDAwMDAwMH0.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  token_type: 'bearer',
  expires_in: 86400,
  refresh_token: 'demo-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  user: {
    id: UID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'demo@example.com',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
});

const MOCK_TASKS = [
  { id: '1', user_id: UID, nombre: 'Ir al gimnasio', cuando: 'hoy', estado: 'en_proceso', fecha_creacion: NOW_ISO },
  { id: '2', user_id: UID, nombre: 'Revisar emails', cuando: 'hoy', estado: 'por_hacer', fecha_creacion: NOW_ISO },
  { id: '3', user_id: UID, nombre: 'Comprar proteína', cuando: 'manana', estado: 'por_hacer', fecha_creacion: NOW_ISO },
  { id: '4', user_id: UID, nombre: 'Llamar al médico', cuando: 'semana', estado: 'por_hacer', fecha_creacion: NOW_ISO },
  { id: '5', user_id: UID, nombre: 'Pagar factura gym', cuando: 'sin_fecha', estado: 'terminada', fecha_creacion: NOW_ISO },
];

const MOCK_FOOD = [
  { id: '1', user_id: UID, fecha: TODAY, apartado: 'desayuno', nombre_alimento: 'Avena con leche', cantidad_gramos: 150, calorias: 285, timestamp: NOW_ISO },
  { id: '2', user_id: UID, fecha: TODAY, apartado: 'desayuno', nombre_alimento: 'Plátano', cantidad_gramos: 120, calorias: 107, timestamp: NOW_ISO },
  { id: '3', user_id: UID, fecha: TODAY, apartado: 'comida', nombre_alimento: 'Pechuga de pollo', cantidad_gramos: 200, calorias: 220, timestamp: NOW_ISO },
  { id: '4', user_id: UID, fecha: TODAY, apartado: 'comida', nombre_alimento: 'Arroz blanco', cantidad_gramos: 180, calorias: 234, timestamp: NOW_ISO },
  { id: '5', user_id: UID, fecha: TODAY, apartado: 'pre_entreno', nombre_alimento: 'Batido de proteína', cantidad_gramos: 300, calorias: 150, timestamp: NOW_ISO },
];

const MOCK_WORKOUTS = [
  { id: '1', user_id: UID, fecha: TODAY, tipo: 'boxeo_fisico', duracion_minutos: 75, calorias_quemadas: 750 },
];

async function shotApp(appPath, filename, width = 390, height = 844) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height } });

  // Seed session BEFORE any page scripts run
  await context.addInitScript(({ key, session }) => {
    localStorage.setItem(key, session);
  }, { key: KEY, session: SESSION_JSON });

  // Mock Supabase API responses
  await context.route('**/your-project.supabase.co/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/rest/v1/tasks')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TASKS) });
    } else if (url.includes('/rest/v1/food_entries')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_FOOD) });
    } else if (url.includes('/rest/v1/workouts')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_WORKOUTS) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
  });

  const page = await context.newPage();
  await page.goto(BASE + appPath, { waitUntil: 'domcontentloaded' });

  // Wait for auth to resolve and content to render (spinner disappears)
  await page.waitForSelector('.animate-spin', { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(
    () => document.querySelectorAll('.animate-spin').length === 0,
    { timeout: 8000 }
  ).catch(() => {});
  await page.waitForTimeout(1000);

  console.log(filename, '→', page.url());
  await page.screenshot({ path: join(OUT, filename), fullPage: true });
  await browser.close();
  console.log('✓', filename);
}

async function shotAuth(filename, width = 390, height = 844) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.goto(BASE + '/auth', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('form', { timeout: 8000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, filename), fullPage: true });
  await browser.close();
  console.log('✓', filename);
}

await shotAuth('ss-01-auth-mobile.png', 390, 844);
await shotAuth('ss-02-auth-desktop.png', 1280, 800);
await shotApp('/home',         'ss-03-home-mobile.png',         390,  844);
await shotApp('/home',         'ss-04-home-desktop.png',        1280, 800);
await shotApp('/gestor',       'ss-05-gestor-mobile.png',       390,  844);
await shotApp('/alimentacion', 'ss-06-alimentacion-mobile.png', 390,  844);
await shotApp('/entreno',      'ss-07-entreno-mobile.png',      390,  844);

console.log('\nAll screenshots → ' + OUT);
