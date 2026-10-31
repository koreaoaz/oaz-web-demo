# Demo 환경변수 점검

이 폴더는 Demo 프로젝트 `ctbwaqtqubmjmltbxfzm` 전용이다. 값은 `.env.example`을 참고하여 각자 로컬 `.env.local` 또는 Netlify 환경변수에 직접 입력한다. `.env.local`과 실제 키는 Git에 넣지 않는다.

- `NEXT_PUBLIC_SUPABASE_URL`: 정확히 `https://ctbwaqtqubmjmltbxfzm.supabase.co`. 빌드 및 서버 실행에서 필수다. 다른 호스트·프로토콜·포트·경로는 거부한다.
- `NEXT_PUBLIC_SUPABASE_KEY`: Demo 공개 `sb_publishable_` 또는 ref가 Demo이고 role이 anon인 legacy JWT. 누락, secret 키, service_role 또는 다른 ref의 legacy JWT는 거부한다. 새 publishable 키의 접두사만으로 프로젝트 소속을 로컬에서 증명할 수 없으므로 Demo Dashboard에서 사용자가 직접 대조한다. 브라우저에 공개되는 값이다.
- `DEMO_VISITOR_SERVICE_KEY`: 방문자 집계 사용 시 서버의 Functions 범위에만 저장할 **Demo ref의 legacy service_role JWT**. 공식 운영 키를 절대 사용하지 않는다. 현재 `sb_secret_` 키는 프로젝트 ref를 로컬 검증할 수 없어 지원하지 않는다. 없으면 방문자 API는 503을 반환한다.
- `DEMO_VISITOR_HMAC_KEY`: 방문자 집계용 서버 전용 무작위 비밀 문자열, 32자 이상. 서비스 키와 별도로 생성·보관한다. 브라우저에 노출하는 접두사를 붙이지 않는다. 변경 시 같은 날 이전 식별자와의 중복 제거가 끊긴다.

Next.js 공개 변수는 빌드 산출물에 포함된다. Netlify에서는 Builds와 Functions 양쪽 범위에서 같은 공개 변수 값을 제공한다. 서버 부팅은 실행 환경의 Demo URL/키를 다시 확인하고 빌드된 설정과 다르면 거부한다. 서버 전용 키와 HMAC 키는 Functions 범위에만 둔다. 환경변수나 키를 로그·스크린샷·이슈에 넣지 않는다.
