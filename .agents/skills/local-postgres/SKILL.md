---
name: local-postgres
description: Sports Grow 로컬 Postgres 컨테이너, 역할 타임아웃, 마이그레이션 파일을 다룰 때 사용합니다. compose로 올리거나 컨테이너를 다시 만드는 작업 전에 읽습니다.
---

# 로컬 Postgres

컨테이너 이름은 `sportsgrow-db-1`입니다. 이미지 `postgres:16`, 호스트 포트 5432, 데이터베이스 `sportsgrow`, 볼륨 `sportsgrow_pg`.

## 허용

꺼져 있고 5432가 비어 있을 때 기존 컨테이너만 다시 켭니다.

```bash
docker start sportsgrow-db-1
docker exec sportsgrow-db-1 pg_isready -U sportsgrow_migrate -d sportsgrow
```

## 금지

사용자 지시 없이 다음을 하지 않습니다.

- `docker compose up`, `docker compose restart`, 컨테이너 재생성
- `server/src/migrate.ts` 실행과 마이그레이션 적용
- 다른 프로젝트 컨테이너 조작. `refac_bid_box` 스택이 여기에 해당합니다

`docker-compose.yml`의 `pg_stat_statements.track=top`은 파일을 고친 상태입니다. 실행 중인 서버에 반영하려면 컨테이너를 다시 만들어야 하므로, 그 작업은 별도 지시가 있기 전에는 하지 않습니다.

`server/migrations/010_goals_unique.sql`은 `DROP INDEX IF EXISTS goals_athlete_metric` 한 줄입니다. 테이블의 `UNIQUE(athlete_id, metric)`는 남깁니다. 이 파일도 아직 적용하지 않았습니다.

## 연결

앱 역할은 `statement_timeout` 2초, 리포트와 잡 역할은 30초, 마이그레이션 역할은 5분입니다. 일일 잡과 메일은 `jobPool`만 쓰고, 그 클라이언트에서 타임아웃을 다시 설정합니다. API `pool`과 섞지 않습니다.

로컬 비밀번호는 `server/sql/init.sql`과 `server/.env.example`에만 있습니다. 문서와 채팅에 다시 적지 않습니다.
