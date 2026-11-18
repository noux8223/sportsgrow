---
name: minor-athlete-data
description: Sports Grow의 아동 동의, 활성화, 사진, 공개 범위, 주간 리포트 수신을 고칠 때 사용합니다.
---

# 아동 데이터

정본 문장은 `AGENTS.md` 4장과 설계서의 동의 절입니다. 여기에는 코드에 이미 있는 판정만 적습니다.

## 활성화

`POST /api/athletes/:id/activate`는 `status = draft`인 행만 바꿉니다. 아니면 409 `athlete_not_draft`이고 목표는 늘지 않습니다.

만 14세 미만은 연결된 보호자의 `child_account` 허용이 있어야 합니다. `APP_ENV=pilot`이고 개인정보 처리방침의 `counsel_reviewed`가 아니면 409 `counsel_pending`입니다. 실아동을 그 플래그 전에 활성화하지 않습니다.

## 사진

만 18세 미만 업로드는 호출자 본인의 최신 `portrait` 동의가 개인정보 처리방침에 연결되고 `granted = true`일 때만 통과합니다. 다른 보호자의 동의는 통과가 아닙니다. 만 18세 이상은 그 확인을 건너뜁니다.

운영 직원 삭제는 열린 티켓 id가 있을 때만 됩니다. 없으면 404 `not_found`이고, 감사 행에 `ticket_id`를 남깁니다. 작성자, 기관 관리자, 연결된 보호자, 선수 본인은 티켓 없이 지웁니다.

저장 바이트는 서버가 JPEG로 다시 인코딩하고 EXIF를 뺀 뒤입니다. 영상은 거절합니다.

## 주간 리포트

선정은 활성 선수 중 최신 `report_email` 동의가 `granted = true`인 경우만입니다. 생성 시각 게이트는 서울 월요일 07:00입니다. 목표는 `goals_visibility`가 `team`일 때만 본문에 넣습니다. 이미 있는 `weekly_reports` 행은 건너뜁니다.

## 가시성

기본은 `private`입니다. `public`은 400입니다. 배정 코치는 목표가 비공개여도 읽고 수정할 수 있습니다. 보호자와 주간 메일은 팀 공개일 때만 목표를 받습니다.
