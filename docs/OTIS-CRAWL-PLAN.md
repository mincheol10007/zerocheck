# 🦉 오티스 — 쿠팡 제로 음료 크롤링 계획 (v1.0)

> 5/23 메타 오케스트레이터 설계의 *Worker 2 (오티스)* 위임 명세. 집사가 새 슬랙 채널 만들고 `@Hermes_otis` 초대하면 캐시가 거기서 이 문서 첨부해서 위임 송출.

| 필드 | 값 |
| :--- | :--- |
| 작성 | Cache (캐시) |
| 일시 | 2026-05-28 18:55 KST |
| Worker | 오티스 (Hermes Agent · Hostinger VPS `srv1683720` · codex/gpt-5.5) |
| 위임 채널 | 집사가 곧 만들 슬랙 채널 (`@Hermes_otis` 멘션) |
| 산출물 | `data/coupang-zero-extended.json` (zerocheck repo에 PR) |

---

## 0. 한 줄 목표

쿠팡 검색 결과에서 **제로 음료 추가 20~30종**을 수집해 `data/coupang-zero-extended.json` 형식으로 zerocheck repo에 PR.

---

## 1. 보상 계약 (Otis Sub-Reward Contract)

이 작업도 메타 오케스트레이터의 *루프 1단계 (보상 계약)* 원칙을 따른다 — Worker 위임에도 검증 가능한 성공 기준을 박는다.

### Success
쿠팡 검색 페이지에서 *제로 음료 20+종*의 *이름·브랜드·이미지·가격·쿠팡 URL*을 JSON으로 추출, zerocheck repo에 PR 생성.

### Verifier
- **OV1** `coupang-zero-extended.json` 파일 존재 + 유효한 JSON
- **OV2** 항목 수 ≥ 20
- **OV3** 각 항목에 필수 필드 6개: `name, brand, image_url, price_krw, coupang_url, search_query`
- **OV4** 기존 `drinks.json`과 *id 중복 0건* (새 데이터만)
- **OV5** rate limit 준수 — 검색 페이지 호출 간격 ≥ 2초

### Stop
- OV1~OV5 PASS 또는 *3회 재시도 실패 시 캐시에게 에스컬레이션* (`LOG.md` 갱신)
- 절대 데드라인: 21:00 KST (zerocheck 게시글 마감)

---

## 2. 검색 쿼리 후보

쿠팡 검색 URL 패턴: `https://www.coupang.com/np/search?q=<URL_ENCODED>&channel=user`

| 쿼리 | 예상 결과 |
| :--- | :--- |
| `제로콜라` | 코카콜라/펩시/PB 제로콜라 |
| `제로사이다` | 칠성/스프라이트 등 |
| `제로 탄산음료` | 환타/마운틴듀 등 |
| `제로 에너지드링크` | 몬스터/레드불/락스타 |
| `제로 스포츠음료` | 파워에이드/게토레이/포카리 |
| `다이어트 음료` | 추가 카테고리 |
| `슈가프리 음료` | 영어 표기 제품 |

쿼리별 *상위 5~8개* 상품을 가져오면 20~30종 확보.

---

## 3. 기술 스택 (오티스 VPS 환경)

```python
# 권장 stack
- Python 3.10+ (이미 hermes-agent 의존성)
- requests + BeautifulSoup4 (정적 페이지면 충분)
- playwright (JS 렌더링 필요 시 fallback)
- json (산출물 직렬화)
```

쿠팡 검색 결과 페이지는 *대부분 정적 HTML*에 상품 목록 포함. JS 렌더링 필요할 가능성 낮음 — 먼저 `requests`로 시도.

### Headers (봇 탐지 회피·일반 사용자 시늉)
```python
headers = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ...",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.coupang.com/",
}
```

### Rate limit
- 검색 페이지 간 *2초 sleep*
- 상품 상세 추출 시 *3초 sleep*
- 실패 시 *exponential backoff* (3회 한도)

---

## 4. 추출 스키마

```json
{
  "schema_version": "1.0",
  "crawled_at": "2026-05-28T19:30:00+09:00",
  "source": "coupang_search",
  "queries_used": ["제로콜라", "제로사이다", "..."],
  "items": [
    {
      "id": "coupang-XXXXXX",                 // 쿠팡 상품ID (URL에서 추출)
      "name": "코카콜라 제로 캔 355ml x 30개",
      "brand": "코카콜라",
      "category_guess": "콜라",                 // 쿼리 기반 추정
      "image_url": "https://thumbnail9.coupangcdn.com/...",
      "price_krw": 23900,
      "coupang_url": "https://www.coupang.com/vp/products/XXXXXX",
      "search_query": "제로콜라",
      "rank": 1                                  // 검색 결과 순위
    }
  ]
}
```

---

## 5. 쿠팡 파트너스 Deeplink API (다음 단계)

**현재 단계**: 단순 상품 URL 수집만.

**다음 단계** (집사가 API key 발급해주면):
- 쿠팡 파트너스 Open API `Deeplink Convert` 호출로 `coupang_url` → `affiliate_url` 변환
- 환경변수 `COUPANG_ACCESS_KEY`·`COUPANG_SECRET_KEY` (오티스 `~/.hermes/env` 에 박음)
- Rate limit 정책 준수 (2026-03-17 정책 변경)

---

## 6. 거버넌스 (오티스 자율 범위)

화이트리스트:
- 쿠팡 검색·상품 URL fetch (read-only)
- JSON 파일 작성
- GitHub PR 생성 (오티스 `gh` 인증 있으면)
- 캐시·집사에 슬랙 보고

블랙리스트:
- 회원가입·로그인 시도 X
- 결제·장바구니 호출 X
- robots.txt 위반 X (사전 점검: `https://www.coupang.com/robots.txt`)
- 개인정보·세션 쿠키 X

HITL (사람 승인 필요):
- 항목 30개 초과 수집 — 캐시에 확인
- 같은 IP 30분당 100req 초과 — 캐시에 알림
- 실패·차단 시 → 캐시 에스컬레이션

---

## 7. 위임 메시지 (집사 채널 만들면 캐시가 보낼 것)

```
🦉 오티스, 보상계약 zerocheck-otis-v1 위임 송출.

목표: 쿠팡 검색에서 제로 음료 20+종 수집 → JSON.
명세: zerocheck repo의 docs/OTIS-CRAWL-PLAN.md 풀로 읽기.
검증: OV1~OV5 (문서 § 1)
산출물 PR 대상: github.com/mincheol10007/zerocheck → data/coupang-zero-extended.json
데드라인: 오늘 21:00 KST.

진행 중 막힘 → 이 채널에 보고. 잘 모르겠으면 캐시에 콜.
보상계약 승인 답해줘.
```

---

## 8. 캐시(Supervisor) 모니터링

- 19:30 — 오티스 시작 확인·OV1~OV5 진행 채점
- 20:00 — 산출물 PR 확인·zerocheck repo merge
- 20:30 — 본문 글에 "오티스 사례" 박기

오티스가 21:00까지 산출물 못 내면 → Replanner 레벨 0/1: 캐시가 *수동 5종 추가 입력*으로 fallback (V4 verifier는 이미 PASS라 게시글 영향 없음).

---

## 8.5 Phase 2 — 성분 추출 + 위험도 매기기

> Phase 1 (위 § 1~8)은 *수집*까지. Phase 2는 *각 음료의 성분 추출 → ingredients.json 매핑 → 위험도 라벨링*. 오티스 codex/gpt-5.5의 멀티모달·자율 cron 강점이 살아남.

### Phase 2 — Otis Sub-Reward Contract

**Success:**
Phase 1로 수집한 각 음료의 *성분표를 추출*하고, 우리 `ingredients.json` 표준에 매핑·신규 성분은 *위험도 1차 분류*까지 제안.

**Verifier (OV6~OV9):**
- **OV6** 각 음료에 `ingredient_ids[]` 필드 추가 (drinks.json 표준 일치)
- **OV7** *신규 성분*은 별도 파일 `data/coupang-new-ingredients.json`으로 분리 (캐시 검토 대기)
- **OV8** 신규 성분 각각에 `risk_proposal: green|yellow|red` + `evidence_note` (한 줄 근거·source URL)
- **OV9** 환각·날조 0건 — 모든 위험도는 *공개된 기관/연구 근거*만 인용 (WHO/FDA/EFSA/NEJM 등). 근거 못 찾으면 `risk_proposal: "needs-review"`로 표시.

**Stop:** OV6~OV9 PASS / 신규 성분 30개 초과 시 캐시 검토 게이트 / 21:00 절대 마감

### 추출 방법

1. **상품 상세 페이지 크롤** — `https://www.coupang.com/vp/products/{id}` 에서 *상세 이미지·텍스트 영역*의 성분표 영역 식별
2. **텍스트 추출**:
   - 텍스트 기반 성분표면 → 정규식·LLM 파싱
   - 이미지 성분표면 → 오티스 codex *멀티모달*로 OCR (codex는 vision 지원)
3. **매핑**:
   - 한글 이름 → ingredients.json `name_ko` 일치
   - 영문 약어 → `name_en` 일치 (Ace-K = Acesulfame Potassium)
   - 부분 일치 시 → 신규 성분 후보로 분리
4. **위험도 1차 분류** (신규 성분만):
   - codex가 *공개 자료 검색* → 결론·출처 정리
   - 우리 *위험도 룰* 적용:
     - 🟢 천연 유래·FDA GRAS·논쟁 거의 없음
     - 🟡 일부 우려·논쟁·과량 주의
     - 🔴 명확한 건강 우려 보고
   - 모호하면 `needs-review`

### 거버넌스 (Phase 2 추가 룰)
- ❌ 위험도 라벨을 *근거 없이* 박지 않음 — 환각 = 즉시 fail
- ❌ *의료적 단언* 금지 ("암 유발", "독성" 등 단정 표현 X) — 항상 "보고됨", "연구 진행 중" 같은 *완화된 어조*
- ✅ 출처 명시 — `source` 필드에 기관·연구·URL
- ✅ 신규 성분 매핑은 *캐시 사인* 후에만 ingredients.json에 머지

### 산출물 형식
```json
// data/coupang-new-ingredients.json
{
  "schema_version": "1.0",
  "crawled_at": "2026-05-28T20:00:00+09:00",
  "ingredients": [
    {
      "id": "isomaltulose",
      "name_ko": "이소말툴로스",
      "name_en": "Isomaltulose",
      "category_proposal": "희소당",
      "risk_proposal": "green",
      "summary": "혈당 영향이 설탕보다 낮은 천연당. EFSA 안전 평가 통과.",
      "evidence_note": "EFSA Scientific Opinion 2007 — 안전 결론",
      "source": "https://efsa.europa.eu/en/efsajournal/pub/523",
      "found_in_drinks": ["coupang-XXXX"]
    }
  ]
}
```

### Phase 2 위임 메시지 (Phase 1 끝나면 캐시가 추가 송출)

```
🦉 오티스, Phase 2 위임.

목표: Phase 1 수집 음료들의 *성분 추출 + 위험도 1차 분류*.
명세: docs/OTIS-CRAWL-PLAN.md § 8.5 풀로 읽기.
검증: OV6~OV9.
산출물: data/coupang-new-ingredients.json (PR)
주의: 환각 = 즉시 fail. 근거 없으면 needs-review로.
```

---

## 9. 위임 후 예상 시나리오

| 결과 | 처리 |
| :--- | :--- |
| ✅ 20+종 수집 성공 | merge → 게시글에 "오티스 자율 크롤링 사례"로 박기 |
| ⚠️ 일부 수집 (10~20종) | 부분 merge + 게시글에 "rate limit과의 협상" 솔직히 |
| ❌ 차단·실패 | 게시글에 "오티스 1차 시도·다음 트랙 Deeplink API"로 |

---

## 변경 이력

| v | 일자 | 내용 |
| :- | :- | :- |
| 1.0 | 2026-05-28 18:55 | 최초 작성 (집사 요청) |
