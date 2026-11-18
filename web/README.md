# Sports Grow 웹

로그인한 사용자가 쓰는 Vite + React + TypeScript 앱입니다. 저장소 루트의 정적 HTML과 데모 원장(`sportsgrow.demo.v1`)은 그대로 두고, 이 디렉터리는 로그인 제품 골격만 담습니다.

## 실행

```sh
cd web
npm install --include=dev
npm run dev
```

개발 서버는 `http://localhost:5173`에서 뜨고 `/api` 요청을 `http://127.0.0.1:3000`으로 프록시합니다. 다른 주소를 쓰려면 `SPORTSGROW_API_TARGET`을 지정합니다.

```sh
SPORTSGROW_API_TARGET=http://127.0.0.1:3000 npm run dev
```

빌드는 다음과 같습니다.

```sh
cd web
npm run build
```

## API 연결

- `POST /api/auth/login` 본문 `{ email, password }`
- `GET /api/me`
- `POST /api/session/active-membership` 본문 `{ membershipId }`
- `POST /api/auth/logout`

모든 요청은 `credentials: 'include'`로 보내고, 변경 요청에는 `x-sportsgrow-client: 1` 헤더를 붙입니다. 세션은 브라우저의 HttpOnly 쿠키 `sg_session`만 사용합니다. 응답 본문의 토큰을 저장하지 않고, `localStorage`와 `sessionStorage`도 쓰지 않습니다.

## 화면 범위

- 로그인, 세션 확인, 소속 선택, 소속 전환, 로그아웃
- 역할별 홈: 선수·보호자는 학생·보호자 홈, `coach`는 코치 홈, `org_admin`은 아카데미 홈
- `platformStaff`는 운영 콘솔이 이 앱 밖에 있다는 안내만 봅니다.
- 기록 입력 폼은 보이지만 제출하지 않습니다. 저장 API는 다음 단계에서 연결합니다.
- 학원 결제와 운영 콘솔 화면은 이 앱에 없습니다.
