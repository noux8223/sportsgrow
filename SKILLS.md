# Sports Grow — 스킬 색인

> **작성일**: 2026-11-18
> **버전**: v0.1.0
> Coordinator와 Standalone이 고르는 색인입니다.
> Orca 워커는 이 파일을 읽지 않습니다. 주입된 Task Capsule의 허용 파일만 사용합니다.

---

## 1. 정본

| 문서 | 역할 |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | 규칙 |
| [`docs/context/CURRENT_STATE.md`](docs/context/CURRENT_STATE.md) | 지금 상태 |
| [`docs/상용화-유료배포-설계서.md`](docs/상용화-유료배포-설계서.md) | 제품 설계와 PR 순서 |
| [`docs/ops/multi_agent_setup.md`](docs/ops/multi_agent_setup.md) | 워커 기동 |

---

## 2. 작업별 문서

| 작업 | 문서와 스킬 |
| --- | --- |
| API, SQL, 테스트 | `.agents/skills/pilot-server/` |
| 데모 화면, API 플래그 | `.agents/skills/demo-client/` |
| 아동 동의, 사진, 활성화 | `.agents/skills/minor-athlete-data/` |
| 로컬 데이터베이스 | `.agents/skills/local-postgres/` |
| 여러 워커 | `.agents/skills/orca-coordination/` |
| 커밋 | `.agents/skills/git-workflow/` |
| 브라우저 확인 | `.agents/skills/dev-servers/` |

---

## 3. 폴더

| 경로 | 내용 |
| --- | --- |
| `js/`, `*.html`, `sw.js` | 데모와 API 클라이언트. IIFE |
| `server/src/` | Fastify API |
| `server/migrations/` | SQL 마이그레이션. 적용은 별도 지시 |
| `server/test/` | `node --import tsx --test` |
| `server/sql/init.sql` | 로컬 Postgres 초기 역할 |
| `legal/` | 약관 초안 |
| `infra/` | 파일럿 Terraform. 적용은 별도 지시 |
| `docs/` | 설계, 사업계획서, 에이전트 운영 문서 |
| `.agents/skills/` | 스킬 정본 |
| `.claude/skills/`, `.opencode/skills/` | 정본을 가리키는 링크 |
| `.grok/rules/` | Grok 코디네이터 접두부 |
| `.agents/templates/task_capsule.yaml` | 워커 작업 지시 양식 |

---

## 4. 세션 시작

- [ ] `AGENTS.md`의 스택과 금지 목록
- [ ] `docs/context/CURRENT_STATE.md`의 미커밋 범위
- [ ] 이번 작업의 스킬 하나
- [ ] 다른 워커와 파일이 겹치면 Run과 Task로 등록
- [ ] 화면을 브라우저로 보면 `node scripts/dev-servers.mjs`로 API, 웹, 루트 정적 서버를 연 뒤 확인
