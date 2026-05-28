# zerocheck — Reward Contract v1.0

> 5/23 만든 Adaptive Meta-Orchestrator의 *루프 1단계 (Goal/보상 계약)* 를 실전 투입.
> 캐시(메타 오케스트레이터) ← 집사 승인 ← 서브에이전트(모카·오티스) 위임 → Evaluator 채점 → 21:00 마감.

| 필드 | 값 |
| :--- | :--- |
| 작성 | Cache (캐시) |
| 일시 | 2026-05-28 17:10 KST |
| 데드라인 | 2026-05-28 21:00 KST (3시간 50분) |
| 사용자 | 김민철 (집사) |
| 사용자 승인 | ☐ 대기 |

---

## 1. Success — 성공의 정의

"21:00까지 *zerocheck.vercel.app* 라이브 + 지피터스 게시글 1편 발행 — *5/23 설계한 Adaptive Meta-Orchestrator를 5/28 실전 투입해서 봇팀(캐시·모카·오티스)이 4시간 안에 사이드 프로젝트 시드를 낳은 사례*."

### 산출물
- 🟢 `zerocheck.vercel.app` 200 OK (Vercel 배포)
- 🟢 GitHub `mincheol10007/zerocheck` public repo
- 🟢 메인 페이지 — 음료 카드 그리드 (10종)
- 🟢 검색 페이지 — 음료명·성분명 양방향 검색
- 🟢 비교 페이지 — 음료 2개 골라 성분 diff 카드
- 🟢 위험도 시각화 — 🟢🟡🔴 색 카드 + 한 줄 코멘트
- 🟢 데이터: 음료 ≥10 · 성분 ≥15
- 🟢 (옵션) 쿠팡 크롤러 시도 — 막히면 수동 fallback 명시
- 🟢 지피터스 게시글 1편 (집사 1인칭) 발행 URL

### Stretch (시간 남으면)
- 🟡 GitHub Actions로 매일 크롤 갱신 cron
- 🟡 도메인 (vercel 기본 OK)
- 🟡 자체 제품화·공구 비전 카드

---

## 2. Verifier — 객관 검증식

| # | 검증 항목 | 방법 | PASS 조건 |
| :- | :- | :- | :- |
| V1 | 사이트 라이브 | `curl -I https://zerocheck.vercel.app` | HTTP 200 |
| V2 | 검색 작동 | `/search?q=제로콜라` | 결과 ≥1 카드 렌더 |
| V3 | 비교 작동 | `/compare?a=제로콜라&b=제로사이다` | diff 카드 렌더 |
| V4 | 데이터 충분 | `data/drinks.json` · `data/ingredients.json` | drinks ≥10, ingredients ≥15 |
| V5 | 위험도 시각화 | 메인·비교 페이지 | 🟢🟡🔴 색 카드 + 코멘트 모두 표시 |
| V6 | 게시글 발행 | gpters.org URL | 살아있는 URL 1개 |

*PASS 기준: V1~V6 전부 ☑*. V6 빼고 5/6도 *부분 PASS*로 인정 (글은 21:00 마감 전 발행).

---

## 3. Stop — 멈춤 조건

- ☑ V1~V6 6/6 PASS (정상 종료)
- ☑ 2026-05-28 *20:30 도달 + 미달*이면 → 시드 축소 fallback (크롤러·비교 페이지 빼고 메인+검색만으로 V1·V2·V4·V5로 게시글)
- ☑ 2026-05-28 *21:00 도달* → 절대 데드라인. 현재 상태로 게시글 발행
- ☑ Replanner 재시도 3회 초과 → 사람(집사) 에스컬레이션

---

## 4. Subagent 위임 (Hierarchical Supervisor)

| 봇 | 역할 | 위임 채널 | 산출물 |
| :- | :- | :- | :- |
| 캐시 (메타) | Supervisor·통합·데이터 입력·본문 글 | (self) | LOG.md 갱신·Vercel 배포·게시글 발행 |
| 모카 | Next.js + UI 컴포넌트 | sessions_send / Slack 봇 (가용 확인 후) | `app/` 디렉토리에 코드 push |
| 오티스 | 쿠팡 크롤러 (VPS) | Slack `@Hermes_otis` (T0B00TBE7KN) | `data/coupang-zero.json` |

### 위임 메시지 템플릿 (모카)
> "[보상계약 zerocheck v1.0] Next.js 14 (App Router) + Tailwind 스캐폴드 + 메인/검색/비교 페이지 3개 + 위험도 카드 컴포넌트. 데이터는 `data/drinks.json` `data/ingredients.json` 형식(스키마 첨부). repo: github.com/mincheol10007/zerocheck. 18:30까지 골격, 19:30까지 완성. Vercel 배포는 캐시. 산출물 push 후 LOG.md에 진행 기록."

### 위임 메시지 템플릿 (오티스)
> "[보상계약 zerocheck v1.0] 쿠팡 검색 결과 '제로콜라', '제로사이다', '제로몬스터' 등 10종의 *상품명·이미지URL·가격·성분표(있으면)* 를 JSON으로. 18:30까지 시도, 막히면 'BLOCKED: <이유>' 한 줄로. 산출물: `data/coupang-zero.json`."

---

## 5. Evaluator — Critic + HITL

- **규칙 기반:** V1~V6 검증식 자동 채점 (curl·count)
- **Critic LLM:** 19:30·20:30 두 차례 — Sonnet으로 게시글 품질·결과 일치 채점
- **HITL:**
  - 보상 계약 승인 (← 지금 집사 승인 대기)
  - 19:30 중간 게이트 (시드 축소 fallback 판단)
  - 게시글 발행 직전 최종 확인

---

## 6. Replanner — 에스컬레이션 사다리

| 레벨 | 트리거 | 액션 |
| :- | :- | :- |
| 0 | 모카 골격 18:30 미달 | 같은 plan 재시도·30분 연장 |
| 1 | 오티스 크롤 18:30 BLOCKED | 도구 교체: 수동 입력으로 fallback |
| 2 | 19:30 종합 미달 | 시드 축소: 비교 페이지·크롤러 빼고 메인+검색만 |
| 사람 | 20:30 종합 미달 | 집사 에스컬레이션·게시글 톤 조정 |

---

## 7. 감사 로그 (Audit)

`projects/zerocheck/LOG.md` 에 시간순 기록. 보상계약 → 위임 → 도구 호출 → Evaluator 판정 → Replanner 결정 모두.

---

## 8. 거버넌스 게이트 (레벨 b)

- **외부 발송:** 지피터스 게시글 발행은 *HITL* — 집사가 최종 검토 후 발행 (캐시가 자동 발행 X)
- **영구 변경:** GitHub push·Vercel 배포 OK (보상계약에 포함됨)
- **블랙리스트:** 결제·DB 삭제·외부 메시지 발송 X

---

## 변경 이력

| v | 일자 | 내용 |
| :- | :- | :- |
| 1.0 | 2026-05-28 17:10 | 최초 작성 (집사 승인 대기) |
