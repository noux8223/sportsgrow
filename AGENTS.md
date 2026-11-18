# Sports Grow — Agent Guidelines (정본)

> **작성일**: 2026-11-18
> **버전**: v0.1.0
> 이 파일은 Claude, Grok, Command Code가 공유하는 규칙 정본입니다.
> 규칙은 여기만 고칩니다. 기동 절차는 [`docs/ops/multi_agent_setup.md`](docs/ops/multi_agent_setup.md), 지금 상태는 [`docs/context/CURRENT_STATE.md`](docs/context/CURRENT_STATE.md), 제품 설계는 [`docs/상용화-유료배포-설계서.md`](docs/상용화-유료배포-설계서.md)입니다.

---

## 0. 부트스트랩

역할에 맞는 문서만 읽고 시작합니다.

| 모드 | 읽는 것 |
| --- | --- |
| Coordinator | 이 파일, `docs/context/CURRENT_STATE.md`, 작업에 해당하는 스킬 하나 |
| Orca Worker | 주입된 Task Capsule. Capsule의 허용 파일만 수정 |
| Reviewer | Capsule, 변경 파일, `git diff`, 테스트 결과. 구현·커밋·푸시 금지 |
| Standalone | 이 파일과 [`SKILLS.md`](SKILLS.md)에서 스킬 하나 |

워커는 `SKILLS.md`와 설계서 전체를 다시 읽지 않습니다. 코디네이터가 Capsule에 필요한 사실만 넣습니다.

---

## 1. 프로젝트

Sports Grow는 유소년 선수(데모의 김하람, `p-haram`)의 훈련·경기·목표를 학생, 학부모, 코치, 아카데미, 운영자가 보는 제품입니다.

화면은 vanilla HTML/CSS/JS IIFE입니다. 유료 파일럿 API는 `server/`의 Fastify + TypeScript + PostgreSQL입니다. `js/env.js`의 `api`가 꺼져 있으면 데모 원장 `sportsgrow.demo.v1`이 그대로 동작해야 합니다. 데모 원장을 운영 데이터로 옮기지 않습니다.

원격은 `https://github.com/noux8223/sportsgrow.git`의 `main`입니다. 작업 폴더는 이 저장소 루트입니다.

---

## 2. 기술 스택

| 영역 | 기술 |
| --- | --- |
| 화면 | vanilla IIFE, `"use strict"`. 프레임워크와 새 프론트 의존성 없음 |
| API | Node.js 22, TypeScript, Fastify |
| DB | PostgreSQL 16, `pg`, `server/sql/`의 `$1` 파라미터 SQL. ORM 없음 |
| 비밀번호 | argon2id, 메모리 19456 KiB, iterations 2, parallelism 1 |
| 세션 | HttpOnly 쿠키 `sg_session`. 역할 문자열을 권한으로 쓰지 않음 |
| 미디어 | 서버 JPEG 재인코딩, EXIF 제거. 영상과 공개 프로필은 첫 유료 범위 밖 |
| 청구 | 아카데미 월 구독 하나. 수동 입금. PG SDK 없음. 웹훅은 501 |
| 로컬 DB | 컨테이너 `sportsgrow-db-1`, `localhost:5432`, 데이터베이스 `sportsgrow` |

Next.js, NestJS, Redis, Prisma, Drizzle, Kysely는 파일럿 경로가 아닙니다.

---

## 3. 코딩 규칙

1. 대화와 문서는 한국어. 코드, 변수, 환경 변수는 영어.
2. 코드 주석, 커밋 메시지, 문서에 이모지를 쓰지 않습니다.
3. 파일 경로는 저장소 루트 기준 상대 경로입니다.
4. 브라우저 코드는 IIFE와 `"use strict"`를 유지합니다. 데모 날짜는 실행 시점의 로컬 날짜에서 뺀 값입니다.
5. `env.api === false`이면 지금 데모 화면과 같아야 합니다.
6. API 모드의 화면은 `js/api.js`를 통합니다. 역할 페이지를 새 프레임워크로 다시 만들지 않습니다.
7. 서버 테스트는 맡은 파일만 실행합니다. `cd server && node --import tsx --test test/<file>.test.ts`. 끝나면 `pool`과 `jobPool`을 `end`합니다.
8. 여러 워커가 전체 `npm test`를 동시에 돌리지 않습니다. 데이터베이스가 하나입니다.
9. 새 npm 의존성은 합의 전에 넣지 않습니다.

---

## 4. 아동 데이터

만 14세 미만은 계정이 없습니다. 현재 `child_account` 동의가 있기 전에는 이름, 생년월일, 조직, 팀만 저장합니다. 훈련, 경기, 사진, 목표, 메모는 `status === active`일 때만 열립니다.

활성화에 성공한 트랜잭션에서만 목표 세 줄을 넣습니다. 이미 있으면 `ON CONFLICT (athlete_id, metric) DO NOTHING`입니다.

선수 user가 있으면 그 user만 훈련·경기를 씁니다. 없으면 배정 코치만 기존 `coach.html`에서 씁니다. 기관 관리자와 보호자는 그 행을 쓰지 않습니다. 작성자만 고치고 지웁니다.

만 18세 미만 사진 업로드는 호출자 본인의 최신 초상 동의(`portrait`, 개인정보 처리방침)가 허용일 때만 됩니다. 운영 직원 삭제는 열린 티켓이 있을 때만 됩니다.

---

## 5. Orca 조율

겹치는 파일, 순서, 공유 데이터베이스가 있으면 [`orca-coordination`](.agents/skills/orca-coordination/SKILL.md)을 먼저 읽습니다. 파일이 겹치지 않는 구현은 이 저장소 `main`에서 병렬로 돌립니다. 자식 git 워크트리는 만들지 않습니다.

1. 작업 묶음은 Orca Run이고, 각 조각은 Task입니다.
2. 리뷰 Task는 대응 빌더 Task에 `--deps`로 묶습니다. 빌더 `worker_done` 전에 리뷰를 시작하지 않습니다.
3. 빌더는 Command Code, 모델 `deepseek/deepseek-v4.1-flash`, effort `high`입니다.
4. 리뷰어는 Command Code, 모델 `z-ai/glm-5.3-flash`, effort `high`입니다. 리뷰어는 파일을 고치지 않습니다.
5. 독립 빌더는 한 번에 시작합니다. 한 파일의 동시 쓰기는 금지합니다.
6. 워커는 검증 결과, 변경 파일, 남은 위험을 `worker_done`으로 알립니다.
7. Orca가 떠 있지 않으면 조율을 시작하지 않고 그 사실을 보고합니다.

`orca worker-start`는 Command Code에 `--model`을 붙이지 못합니다. 이 저장소의 기동 절차는 `docs/ops/multi_agent_setup.md`의 터미널 생성과 `dispatch --inject`입니다. 그 경로는 비감독입니다.

---

## 6. 공유 자원

| 자원 | 규칙 |
| --- | --- |
| `sportsgrow-db-1` | 꺼져 있고 5432가 비어 있을 때만 `docker start sportsgrow-db-1`. `docker compose up`, 재시작, 컨테이너 재생성, 마이그레이션 적용은 사용자 지시가 있을 때만 |
| 다른 프로젝트 Docker | `refac_bid_box`의 app, worker, db, redis, meilisearch와 그 워크트리는 읽기 조사 외에는 건드리지 않습니다 |
| Postgres 역할 | 앱 풀 타임아웃 2초, 잡 풀 30초. 잡은 `jobPool`만 사용 |
| `.env` | `server/.env`를 커밋하거나 문서에 값을 적지 않습니다 |

---

## 7. Git

1인 저장소입니다. Pull Request를 만들지 않습니다.

- 커밋과 푸시는 사용자가 요청할 때만 합니다.
- 커밋 제목은 기존 이력처럼 한국어 한 문장입니다.
- 커밋하지 않는 것: `.commandcode/`, `node_modules/`, `server/dist/`, `server/.env`, Terraform 상태, `.orca/`.
- 워커 기본값은 커밋하지 않고 작업 트리에 남기는 것입니다. 코디네이터가 사용자 요청으로 모아서 커밋합니다.

---

## 8. 금지

1. 이모지.
2. 대화와 문서를 영어로 작성.
3. 합의 없는 의존성 추가.
4. ORM, Redis, 프레임워크 전환.
5. `env.api === false`인 데모 동작을 깨는 변경.
6. 데모 원장 이관, 데모 JSON 업로드 라우트.
7. PG SDK와 웹훅 구현. 웹훅은 501입니다.
8. 사용자 지시 없는 마이그레이션 적용과 컨테이너 재생성.
9. `refac_bid_box` 워크트리와 그 Docker 스택 수정.
10. 리뷰어의 구현, 커밋, 푸시.
11. Capsule 허용 파일 밖의 수정.

---

## 9. 스킬

| 스킬 | 경로 | 언제 |
| --- | --- | --- |
| `pilot-server` | `.agents/skills/pilot-server/` | `server/` API, SQL, 테스트 |
| `demo-client` | `.agents/skills/demo-client/` | HTML, `js/`, 서비스 워커 |
| `minor-athlete-data` | `.agents/skills/minor-athlete-data/` | 동의, 활성화, 사진, 가시성 |
| `local-postgres` | `.agents/skills/local-postgres/` | 로컬 Postgres, 마이그레이션 |
| `orca-coordination` | `.agents/skills/orca-coordination/` | 워커 분할과 기동 |
| `git-workflow` | `.agents/skills/git-workflow/` | 커밋과 푸시 |
