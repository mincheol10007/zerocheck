# 🪙 쿠팡 파트너스 제휴 링크 연결 가이드 (v1.0)

> zerocheck 음료 카드 모달의 "쿠팡에서 보기" 버튼이 *제휴 URL*로 자동 변환되게 박는 안내.

| 작성 | Cache (캐시) |
| :--- | :--- |
| 일시 | 2026-05-28 |
| 상태 | 집사 *API Key 발급* 단계 대기 중 |

---

## 1. 현재 상태

zerocheck 음료 카드 → 클릭 → 모달 → "쿠팡에서 보기" 버튼은 *단순 검색 URL*로 박혀있음:

```
https://www.coupang.com/np/search?q=<음료명>
```

이건 *제휴 추적이 안 되는 일반 검색 URL*. 클릭해도 수익 0.

## 2. 목표

각 음료별로 *제휴 URL*로 자동 변환되어 — 클릭·구매 시 *집사 쿠팡 파트너스 계정에 수익 누적*.

```
https://link.coupang.com/a/XXXXXX
```

또는

```
https://www.coupang.com/.../products/XXXXXX?lptag=AFXXXXXX  // 제휴 ID 자동 부착
```

## 3. 집사 액션 (3단계)

### 3-1. 쿠팡 파트너스 대시보드 로그인
- URL: https://partners.coupang.com/
- 이미 *승인된 파트너스 계정* 사용

### 3-2. 개발자 센터 → Access Key + Secret Key 발급
- 메뉴: **개발자센터** 또는 **API 관리** → **API 키**
- *Access Key* 와 *Secret Key* 2개를 받음 (Secret Key는 발급 시 1회만 노출 → 안전한 곳에 저장)
- Rate Limit 정책 확인 (2026-03-17 정책 변경 적용)

### 3-3. 키 캐시에게 전달
- *슬랙 DM* 또는 *.secrets/* 디렉토리에 저장
- 권장 위치: `~/.openclaw/.secrets/coupang/credentials.json`
  ```json
  {
    "access_key": "...",
    "secret_key": "...",
    "subid": "zerocheck",
    "created_at": "2026-05-28"
  }
  ```
- 파일 권한: `chmod 600`

## 4. 캐시 액션 (키 받은 후)

### 4-1. Deeplink Convert 함수 박기
`assets/app.js`의 `coupangSearchUrl(name)` 옆에 `coupangAffiliateUrl(productUrl)` 추가:

```js
// 정적 사이트에서 직접 API 호출은 보안상 X (Secret Key 노출 위험).
// 빌드 타임 또는 서버리스 함수에서 변환 후 정적 JSON에 박는 패턴.
window.zc.coupangAffiliateUrl = function(drink) {
  // drink.affiliate_url이 빌드 타임에 박혀있으면 그걸, 없으면 검색 URL fallback
  return drink.affiliate_url || window.zc.coupangSearchUrl(drink.name);
};
```

### 4-2. 빌드 타임 변환 스크립트
- 위치: `scripts/build-affiliate-urls.js` 또는 GitHub Actions
- 동작: drinks.json 순회 → 쿠팡 Deeplink API 호출 → affiliate URL 받아서 drinks.json `affiliate_url` 필드에 저장
- 호출 시점: 일주일에 1회 cron 또는 PR 머지 시
- 환경변수: `COUPANG_ACCESS_KEY` · `COUPANG_SECRET_KEY` (GitHub Actions Secrets에 박음)

### 4-3. Deeplink API 호출 패턴 (개략)
```javascript
const url = 'https://api-gateway.coupang.com/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
const body = { coupangUrls: ['https://www.coupang.com/vp/products/123'] };
// HMAC SHA256 서명 헤더 (Access Key + Secret Key + timestamp)
// Authorization: CEA algorithm=HmacSHA256, access-key=..., signed-date=..., signature=...
// → response.data[0].shortenUrl
```

(정식 구현은 `vivoldi.com` 가이드 또는 yourtime.kr 글 참조)

## 5. 거버넌스 / 보안 룰

- ❌ Secret Key를 *클라이언트 JS / 정적 사이트*에 박지 않는다
- ❌ Secret Key를 *공개 GitHub repo*에 commit하지 않는다
- ✅ GitHub Actions Secrets 또는 Vercel Environment Variables에 박는다
- ✅ 변환 결과는 *정적 JSON*으로 박아서 클라이언트는 *읽기만*

## 6. 향후 트랙

- **Phase 1** (현재): 검색 URL placeholder
- **Phase 2** (키 발급 후): Deeplink Convert로 음료별 affiliate URL 박기
- **Phase 3**: 오티스가 새 음료 크롤 → Deeplink Convert 자동 호출 → drinks.json PR
- **Phase 4**: 수익 대시보드 (쿠팡 파트너스 리포트 API 또는 수동)

## 7. 예상 수익 흐름 (참고)

- 음료 1캔 기준 평균 단가: 1,000~3,000원
- 쿠팡 파트너스 일반 수수료: 카테고리별 *1~3%* (식품 보통 3%)
- 클릭→구매 전환율: 평균 1~3%
- *현실적 시뮬*: zerocheck 월 방문 1,000명 · 음료 카드 클릭 30% · 구매 전환 1% = 월 3건 구매. 객단가 5,000원이면 *월 150원* 정도. 

→ 수익 자체는 적음. zerocheck는 *수익 사이트가 아니라 정보 사이트*. 제휴 링크는 *사용자가 사고 싶으면 사기 편리하게*가 핵심.

## 변경 이력

| v | 일자 | 내용 |
| :- | :- | :- |
| 1.0 | 2026-05-28 19:55 | 최초 작성 (집사 요청) |
