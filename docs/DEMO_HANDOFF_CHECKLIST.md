# Demo 인계 전 체크리스트

체크는 실제 소유자 확인 또는 테스트 근거가 있을 때만 표시한다. 이 파일은 원격 변경 승인이 아니다.

## 확인된 사실과 사용자 확인

- [x] 별도 Demo 저장소·Supabase ref·Netlify 사이트를 코드에서 사용한다. 코드 수정자가 차단을 제거할 수 있으므로 계정 권한 분리는 별도다.
- [x] Netlify Git 자동 빌드 중지는 사용자가 확인했다. 다시 켜거나 연결을 바꾸지 않는다.
- [x] 사용자가 CSS 404 수정 후 새 Draft 레이아웃이 정상임을 확인했다. 이 문서 작성자가 직접 재검증한 결과는 아니다.
- [x] 기존 `[DEMO TEST]` 자료는 학습 예시로 보존한다.

## 인계 전 남은 확인

- [ ] 소유자가 각 친구의 GitHub 개인 계정이 **Demo에만 쓰기 권한**을 갖는지 공식 저장소까지 확인한다. `Larry826`은 사용자가 지정한 양쪽 관리 계정으로 유지한다.
- [ ] 개인 Private 저장소의 브랜치 보호·ruleset·플랜 제약을 확인하고, 강제할 수 없는 main 직접 push·PR 병합·workflow 변경 위험을 팀이 수용하거나 별도 강제 수단을 마련한다.
- [ ] PR 검사 SHA와 최종 main SHA를 구분한다. 릴리스 스크립트는 정확한 main SHA의 push CI를 확인하며 실패·대기·누락·조회 실패 시 차단한다. 담당자도 GitHub 결과와 배포 SHA를 확인한다.
- [ ] Netlify 팀원 추가 제약과 담당자·Draft/Production 권한을 확인한다. 자동 빌드 중지를 유지하며 Owner 계정과 토큰을 공유하지 않는다. Owner 2FA는 사용자가 설정을 보류했다.
- [ ] Demo·공식 Supabase 조직과 각 멤버·프로젝트 권한, OAuth 앱·Redirect URL, 웹훅 및 비밀 접근 범위를 소유자가 확인한다.
- [ ] 실제 Demo의 익명·미승인·일반 회원·관리자로 REST와 Storage 허용·거부를 가짜 계정 및 승인된 가짜 데이터로 검증한다. 현재 일반 회원 실환경 검증은 미완료다.
- [ ] 현시점 Demo DB·Auth·Storage·환경 설정의 백업 범위와 복원 절차를 확인한다. `demo_public_before_rebuild_20261031.dump`는 재구축 전 public 백업이며 현재 전체 환경의 복원 보증이 아니다.
- [ ] 개인정보와 키 노출을 재점검하고 테스트 자료 보존, 오류 보고 및 접근 철회 담당자를 정한다.
- [ ] 방문자 API의 503 차단을 유지한다.

## 검토 자료

`STUDENT_DEVELOPMENT_GUIDE.md`, `GITHUB_COLLABORATION_GUIDE.md`, `DEMO_DEPLOYMENT_GUIDE.md`, `DEMO_SECURITY_BOUNDARIES.md`, 저장소 루트의 `DEMO_FINAL_RELEASE_RUNBOOK.md`, `MILESTONE_C_ROLE_TEST_GUIDE.md`, `database/demo_security_reference.sql`을 함께 확인한다. 참고 SQL은 실제 원격 정책을 증명하지 않는다.
