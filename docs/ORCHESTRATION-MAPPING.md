# 5/23 메타 오케스트레이터 → zerocheck 실전 매핑

> 5/23에 ai-agent-architect 스킬로 만든 *Adaptive Meta-Orchestrator* 설계가, 5/28 zerocheck 사이드 시드에 어떻게 박히는지 한 페이지 정리.
> 원본: `projects/meta-orchestrator-agent/{architecture-spec, system-prompt, worksheet-filled, meta-orchestrator-skeleton}`

---

## 0. 핵심 결론 (TL;DR)

> 5/23은 *설계*였고, 5/28 zerocheck는 그 설계의 *첫 실전 케이스*.
> 집사 = 사용자, 캐시 = 메타코어(Supervisor), 모카·오티스 = Worker, `projects/zerocheck/` 디렉토리 = Blackboard, `LOG.md` = 감사 로그.

---

## 1. 5/23 문서 4종 — 무엇이 어디 박혔나

| 문서 | 한 줄 | 협업 구조 관련? |
| :--- | :--- | :--- |
| `architecture-spec.md` | *전체 그림* — 토폴로지·공식·다이어그램 | ⭐⭐⭐ (§ 2·4·8) |
| `system-prompt.md` | 메타코어(캐시)의 *행동 규칙·자기점검 체크리스트* | ⭐⭐ (8단계 루프) |
| `worksheet-filled.md` | 11단계 인터뷰 답 — *왜 이렇게 설계했는지* 의사결정 기록 | ⭐ (STEP 4·6·7) |
| `meta-orchestrator-skeleton.py` | LangGraph 코드 뼈대 — *코드로 박으면* 이렇게 생김 | 참고용 |

---

## 2. 핵심 4단계 (8단계 중 협업에 직접 박힘)

### ▸ 1단계 — Goal (보상 계약)
"무엇이 성공인지" 사용자와 *검증 가능한* 합의. 셋 다 박아야:
- **Success** — 무엇이 되면 합격
- **Verifier** — 그걸 기계가 채점할 방법 (curl·테스트·count)
- **Stop** — 언제 멈춤

📍 zerocheck: `REWARD-CONTRACT.md` (이미 v1.0 박힘 · 집사 사인 대기)

### ▸ 2단계 — Planner (분해)
큰 목표를 Worker 단위로 쪼갬. zerocheck에선 캐시가 이미 분배함.

### ▸ 5단계 — Evaluator (검증)
도중에 결과를 *보상계약 기준으로* 채점. 3중:
- 규칙 (curl·count 자동)
- Critic LLM (Sonnet으로 품질 점검)
- HITL (집사 사인)

📍 zerocheck: 19:30·20:30 두 차례 게이트

### ▸ 7단계 — Governance (권한·감사)
화이트/블랙리스트 + HITL + 감사 로그. *위험 액션*은 사람 사인 필요.

📍 zerocheck:
- 화이트: GitHub push·Vercel 배포·파일 작성
- HITL (집사 사인 필수): ①보상계약 승인 ②19:30 중간 게이트 ③게시글 발행 직전
- 감사: `LOG.md` append-only

---

## 3. 토폴로지 1:1 매핑 (architecture-spec.md § 2)

```
5/23 설계 (Hybrid)                        zerocheck 실전
─────────────────────────────────────────────────────────
User (사용자)                  ←→         집사
  ↓ 보상 계약 합의
Cognitive Core (Claude)        ←→         캐시 (메타 오케스트레이터)
  ↓ Planner·Reasoner
Supervisor (위임)              ←→         캐시가 슬랙·sessions_send로 던짐
  ↓
Worker 1                       ←→         모카 (Next.js·UI)
Worker 2                       ←→         오티스 (쿠팡 크롤러·VPS)
  ↓ read/write
Blackboard (공유 상태)         ←→         `projects/zerocheck/` 디렉토리
  ↓                                           ├─ data/ (drinks·ingredients·crawl)
Evaluator (규칙+Critic+HITL)   ←→             ├─ app/ (모카가 push)
  ↓                                           └─ LOG.md (감사)
Replanner (에스컬레이션 사다리)←→         재시도 3회 → 집사 콜
  ↓
Governance (HITL·감사)         ←→         `LOG.md` + 집사 사인 게이트 3곳
```

---

## 4. 도구 매핑 (architecture-spec.md § 8)

| 5/23 설계 도구 | zerocheck 실전 |
| :--- | :--- |
| `delegate_to_subagent(subgoal, role)` | 슬랙 멘션 (`@모카`·`@Hermes_otis`) + `sessions_send` |
| `run_code(code, tests)` | `curl` 검증·`jq` count·`gh run` |
| `file_rw` | `projects/zerocheck/` 안 직접 작성·git push |
| `db_query` | (이번엔 X — JSON 정적 파일로 대체) |
| `web_search` | 오티스가 쿠팡 크롤로 대체 |

---

## 5. 협업 흐름 — 실제 4시간 안에 어떻게 도는지

```
17:13  캐시 → Reward Contract v1.0 작성
17:??  집사 → "approved" (HITL 1)
17:??  캐시 → 모카·오티스에 위임 송출
       │
       ├─ 모카: Next.js 스캐폴드 → UI 컴포넌트
       └─ 오티스: 쿠팡 크롤러
       │
18:30  Blackboard 1차 점검 (data·app)
19:30  Evaluator (V1~V5 자동 + Critic) → 집사 사인 (HITL 2)
       │
       └ FAIL이면 Replanner: 같은계획 → 도구교체 → 시드축소 → 집사콜
       │
20:30  최종 채점 + 본문 글 마감
21:00  집사 사인 (HITL 3) → 지피터스 발행 → 보상계약 종료
```

---

## 6. HITL 게이트 — *집사가 손 대야 할 곳 3곳*

1. **지금 — 보상 계약 승인** (Reward Contract v1.0)
2. **19:30 중간 게이트** — 시드 축소 fallback 판단
3. **21:00 직전 — 게시글 발행 사인**

그 외엔 캐시가 Supervisor로 자동 진행. 막히면 LOG.md 보고 집사 콜.

---

## 7. 5/23 설계 충실도 자가체크

| 5/23 설계 원칙 | zerocheck 준수? |
| :--- | :--- |
| ✅ 보상 계약 없이 실행 금지 | 집사 사인 대기 중 |
| ✅ 검증 가능한 verifier | V1~V6 모두 기계 채점 |
| ✅ 멈춤 조건 명시 | 20:30 fallback · 21:00 절대 마감 · 재시도 3회 |
| ✅ HITL 지점 명시 | 3곳 |
| ✅ 감사 로그 | `LOG.md` append-only |
| ✅ 화이트/블랙리스트 | REWARD-CONTRACT § 8 |
| ✅ 에스컬레이션 사다리 | REWARD-CONTRACT § 6 |
| ✅ Blackboard 공유상태 | `projects/zerocheck/` |

8/8 ☑ — *5/23 설계 그대로 실전 투입*.

---

## 변경 이력

| v | 일자 | 내용 |
| :- | :- | :- |
| 1.0 | 2026-05-28 17:55 | 최초 매핑 (집사 합의 대기) |
