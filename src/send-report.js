import { chromium } from 'playwright';
import nodemailer from 'nodemailer';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

const ONEBOX_LOGIN_URL = requireEnv('ONEBOX_LOGIN_URL');
const ONEBOX_DASHBOARD_URL = requireEnv('ONEBOX_DASHBOARD_URL');
const ONEBOX_USER = requireEnv('ONEBOX_USER');
const ONEBOX_PASS = requireEnv('ONEBOX_PASS');

const SMTP_HOST = requireEnv('SMTP_HOST');
const SMTP_PORT = Number(process.env.SMTP_PORT || '587');
const SMTP_USER = requireEnv('SMTP_USER');
const SMTP_PASS = requireEnv('SMTP_PASS');
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER;
const MAIL_TO = requireEnv('MAIL_TO'); // coma-separado

// Selectores del formulario de login. Si Onebox cambia su HTML, ajustar acá
// (o sobreescribir vía variables de entorno sin tocar código).
const SELECTOR_USER = process.env.ONEBOX_SELECTOR_USER || 'input[name="username"], input[type="email"], input#id_username';
const SELECTOR_PASS = process.env.ONEBOX_SELECTOR_PASS || 'input[name="password"], input[type="password"], input#id_password';
const SELECTOR_SUBMIT = process.env.ONEBOX_SELECTOR_SUBMIT || 'button[type="submit"], input[type="submit"]';

const SCREENSHOT_DIR = 'screenshots';

async function loginAndCapture() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  try {
    await page.goto(ONEBOX_LOGIN_URL, { waitUntil: 'networkidle', timeout: 60000 });

    await page.waitForSelector(SELECTOR_USER, { timeout: 30000 });
    await page.fill(SELECTOR_USER, ONEBOX_USER);
    await page.fill(SELECTOR_PASS, ONEBOX_PASS);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
      page.click(SELECTOR_SUBMIT),
    ]);

    // Vamos directo al permalink del dashboard ya autenticados.
    await page.goto(ONEBOX_DASHBOARD_URL, { waitUntil: 'networkidle', timeout: 90000 });

    // Superset tarda en pintar los gráficos aunque la red ya esté quieta.
    await page.waitForTimeout(8000);

    const today = new Date().toISOString().slice(0, 10);
    const screenshotPath = path.join(SCREENSHOT_DIR, `venta-diaria-${today}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    return screenshotPath;
  } finally {
    await browser.close();
  }
}

async function sendEmail(screenshotPath) {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const today = new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });
  const recipients = MAIL_TO.split(',').map(s => s.trim()).filter(Boolean);

  await transporter.sendMail({
    from: MAIL_FROM,
    to: recipients,
    subject: `Reporte de venta diaria - ${today}`,
    text: `Adjunto el reporte de venta diaria del dashboard de Onebox correspondiente al ${today}.`,
    html: `<p>Adjunto el reporte de venta diaria del dashboard de Onebox correspondiente al <b>${today}</b>.</p>`,
    attachments: [
      { filename: path.basename(screenshotPath), path: screenshotPath },
    ],
  });
}

async function main() {
  console.log('Iniciando captura del dashboard de Onebox...');
  const screenshotPath = await loginAndCapture();
  console.log(`Screenshot guardado en ${screenshotPath}`);

  console.log('Enviando reporte por email...');
  await sendEmail(screenshotPath);
  console.log('Reporte enviado correctamente.');
}

main().catch(err => {
  console.error('Error generando/enviando el reporte:', err);
  process.exit(1);
});
