---
name: demo-client
description: Sports Grow 화면을 고칠 때 사용합니다. HTML, js IIFE, 서비스 워커, env.api가 꺼진 데모 동작을 다룹니다.
---

# 데모 클라이언트

`js/env.js`는 `demoLogin: true`, `api: false`입니다. 이 값이면 학생, 코치, 아카데미, 운영 화면은 `js/demo-data.js`의 `sportsgrow.demo.v1`을 그대로 씁니다.

## 규칙

- 브라우저 코드는 IIFE와 `"use strict"`입니다. 프레임워크와 새 스크립트 의존성을 넣지 않습니다.
- 데모에 보이는 날짜는 실행 시점의 로컬 날짜에서 뺀 오프셋입니다. 고정 달력을 새로 넣지 않습니다.
- API 모드 분기는 `window.SportsGrowApi.enabled`를 봅니다. 켜져 있을 때만 `js/api.js` 경로를 탑니다.
- `js/student.js`와 `js/demo-data.js`를 다른 폴더의 사본으로 덮어쓰지 않습니다.
- 서비스 워커는 `/api/` GET을 캐시하지 않고 바로 return합니다. 데모 프리캐시에 `admin.html`과 `js/auth.js`를 넣는 분기는 `deployment-mode.json`의 `demoLogin`이 꺼져 있지 않을 때로 한정합니다.
- 화면을 바꾸면 해당 HTML을 브라우저에서 데모 로그인으로 확인합니다. 공통 비밀번호는 데모 전용 `grow1234`입니다.

## 파일

| 화면 | 스크립트 |
| --- | --- |
| `student.html` | `js/student.js` |
| `coach.html` | `js/coach.js` |
| `academy.html` | `js/academy.js` |
| `admin.html` | `js/admin.js` |
| `index.html` | `js/site.js` |
| 로그인 | `js/auth.js`, API일 때 `js/auth-login-api.js` |
