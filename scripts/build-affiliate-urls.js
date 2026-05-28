#!/usr/bin/env node
/**
 * zerocheck — 쿠팡 파트너스 Deeplink Convert 빌드 스크립트
 *
 * 동작:
 *   1. data/drinks.json 읽기
 *   2. 각 음료에 대해 쿠팡 검색 URL 생성
 *   3. Deeplink Convert API 호출 → affiliate URL 받음
 *   4. drinks.json `affiliate_url` 필드 업데이트
 *   5. 변경 사항 저장
 *
 * 환경변수 (필수):
 *   COUPANG_ACCESS_KEY
 *   COUPANG_SECRET_KEY
 *   COUPANG_SUBID            (선택 — 기본 "zerocheck")
 *
 * 실행:
 *   $ node scripts/build-affiliate-urls.js
 *
 * 안전 / 환각 방어:
 *   - API 응답이 4xx/5xx면 그 음료는 건너뜀 (기존 URL 유지)
 *   - 200이어도 응답 스키마 검증 후에만 적용
 *   - 키 미설정 시 즉시 abort (오작동 방지)
 *   - rate limit 보호: 음료 간 700ms 간격
 *
 * 거버넌스:
 *   - Secret Key는 환경변수로만. 코드/repo에 박지 않음.
 *   - GitHub Actions Secrets 또는 로컬 ~/.openclaw/.secrets/coupang/ 에서 로드.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const DRINKS_PATH = path.join(ROOT, 'data', 'drinks.json');

const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY;
const SECRET_KEY = process.env.COUPANG_SECRET_KEY;
const SUBID = process.env.COUPANG_SUBID || 'zerocheck';
const API_HOST = 'api-gateway.coupang.com';
const API_PATH = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
const RATE_LIMIT_MS = 700;

function abort(msg, code = 1) {
  console.error(`✗ ${msg}`);
  process.exit(code);
}

if (!ACCESS_KEY || !SECRET_KEY) {
  abort('환경변수 COUPANG_ACCESS_KEY · COUPANG_SECRET_KEY 가 없음. ~/.openclaw/.secrets/coupang/ 로드 확인.');
}

/**
 * HMAC SHA256 인증 헤더 생성 (쿠팡 OpenAPI 표준).
 * 형식: CEA algorithm=HmacSHA256, access-key={ak}, signed-date={ts}, signature={sig}
 */
function authHeader(method, urlPath, query = '') {
  const now = new Date();
  const datetime =
    now.getUTCFullYear().toString().slice(2) +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0') +
    'T' +
    String(now.getUTCHours()).padStart(2, '0') +
    String(now.getUTCMinutes()).padStart(2, '0') +
    String(now.getUTCSeconds()).padStart(2, '0') +
    'Z';
  const message = datetime + method + urlPath + query;
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(message).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;
}

async function convertOne(searchUrl) {
  const body = JSON.stringify({ coupangUrls: [searchUrl], subId: SUBID });
  const res = await fetch(`https://${API_HOST}${API_PATH}`, {
    method: 'POST',
    headers: {
      Authorization: authHeader('POST', API_PATH),
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body,
  });
  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text() };
  }
  const json = await res.json();
  const item = json?.data?.[0];
  if (!item?.shortenUrl) {
    return { ok: false, status: 200, error: '응답 스키마 mismatch (shortenUrl 없음)' };
  }
  return { ok: true, shortenUrl: item.shortenUrl, landingUrl: item.landingUrl };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const raw = fs.readFileSync(DRINKS_PATH, 'utf8');
  const data = JSON.parse(raw);
  let changed = 0;
  let skipped = 0;
  for (const drink of data.drinks) {
    const searchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(drink.name)}&channel=user`;
    process.stdout.write(`· ${drink.name} … `);
    const r = await convertOne(searchUrl);
    if (r.ok) {
      drink.affiliate_url = r.shortenUrl;
      drink.affiliate_landing = r.landingUrl;
      drink.affiliate_updated_at = new Date().toISOString();
      changed++;
      console.log(`✓ ${r.shortenUrl}`);
    } else {
      skipped++;
      console.log(`✗ ${r.status}: ${r.error?.slice(0, 80)}`);
    }
    await sleep(RATE_LIMIT_MS);
  }
  data.affiliate_built_at = new Date().toISOString();
  fs.writeFileSync(DRINKS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`\n변환 ${changed}/${data.drinks.length} · skipped ${skipped}`);
}

main().catch((e) => abort(e.stack || e.message));
