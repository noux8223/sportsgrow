# 서울 파일럿 인프라

이 구성은 설계서 PR 16의 AWS 파일럿 기반을 만든다. **Terraform apply는 AWS 자원을 만들고 비용을 발생시킨다. 이 저장소 작업에서는 apply하지 않았다.** 실제 사업자 정보, 도메인, 네트워크 ID, SSM 값, 인증서는 운영 주체가 준비해야 한다.

## 포함 자원

- PostgreSQL 16 RDS `db.t4g.small`, Multi-AZ, gp3 20 GiB, KMS 암호화, 35일 백업, private DB subnet, SSL 강제
- API용 ALB + Fargate 1 vCPU 미만 task, 별도 migration task, ECR 저장소
- 비공개 미디어/내보내기/파기 매니페스트 S3 버킷, SSE-KMS, 미완료 업로드 1일 삭제, 브라우저 PUT용 제한 CORS
- 파일럿·운영 호스트별 private S3 + CloudFront OAC, `/api/*` TTL 0 및 쿠키/헤더 전달
- 서울 SES 도메인 확인, DKIM·MAIL FROM Route 53 레코드
- SSM SecureString 런타임 시크릿 권한, JSON 로그 30일 보관, RDS CPU 경보

Fargate task는 public subnet에 퍼블릭 IP를 받지만 인바운드는 ALB 보안 그룹에서만 허용한다. DB는 별도 private subnet이고 API task/migration task 보안 그룹만 DB 5432에 접근한다. 기존 VPC와 서브넷은 이 구성이 만들지 않는다.

## 사전 준비

1. Terraform 1.10 이상, AWS CLI, Docker, AWS 계정 권한을 준비한다.
2. 두 개 이상의 AZ에 걸친 VPC public subnet 2개와 private DB subnet 2개를 준비한다. public subnet에는 Internet Gateway 경로가 있어야 한다.
3. Route 53 hosted zone을 준비한다. `app_domain`, `ops_domain`, `api_origin_domain`, `mail_domain`, `mail_from_domain`이 해당 zone에서 관리 가능해야 한다.
4. ACM 인증서를 준비한다. CloudFront viewer 인증서는 `us-east-1`에서 app·ops 이름을 포함하고, ALB 인증서는 `ap-northeast-2`에서 `api_origin_domain`을 포함해야 한다.
5. SSM SecureString에 `DATABASE_URL`, 법인 고지 6개 값, `MAIL_FROM`, `MIGRATE_DATABASE_URL`, `APP_DATABASE_PASSWORD`, `REPORT_DATABASE_PASSWORD`를 저장한다. 실행 태스크는 `DATABASE_URL`만 받고, 일회성 마이그레이션 태스크만 master/migration URL과 두 DB 역할 비밀번호를 받는다.
6. `DATABASE_URL`은 `sportsgrow_app`, `MIGRATE_DATABASE_URL`은 RDS master 사용자(`sportsgrow_migrate`)를 사용한다. 각각 RDS endpoint와 `sportsgrow` DB를 가리키며 비밀번호의 URL 예약 문자는 percent-encode한다. SSM SecureString 암호화 KMS 키 ARN은 `secret_kms_key_arns`에 넣는다.
7. 원격 Terraform state 버킷은 별도로 만들고 버전 관리, 서버 측 암호화, 퍼블릭 차단, 최소 IAM 권한을 적용한다. RDS 비밀번호와 parameter ARN이 Terraform state에 기록되므로 state 접근은 운영 시크릿 권한과 같은 수준으로 제한한다.

## 빌드와 배포 순서

1. 파일럿 정적 자산과 페이지별 인라인 스크립트 CSP 해시를 만든다.

   ```sh
   npm run build:pilot
   ```

2. `infra/backend.hcl.example`과 `infra/pilot.tfvars.example`을 로컬 파일로 복사해 실제 값을 입력한다. 비밀번호는 tfvars에 쓰지 말고 `TF_VAR_db_master_password` 환경 변수나 승인된 시크릿 주입 경로로 전달한다. 실제 설정 파일은 저장소에 넣지 않는다.
3. Terraform 초기화와 plan을 만든다. 예제 tfvars에는 인증서·주소·ARN 자리표시자만 있다.

   ```sh
   terraform -chdir=infra init -backend-config=backend.hcl
   terraform -chdir=infra plan \
     -var-file=pilot.tfvars \
     -var-file=../dist/security-csp.auto.tfvars.json \
     -out=pilot.tfplan
   ```

4. plan을 검토한 뒤 운영 승인 절차에서 apply한다. 첫 apply는 `api_desired_count=0` 상태로 RDS, 저장소, ECR, CloudFront와 ECS task 정의를 준비한다.
5. `server/Dockerfile`로 이미지를 빌드하고 ECR에 `bootstrap` 태그로 push한다. migration task를 한 번 실행한다. 이 task는 RDS 역할을 만들거나 비밀번호를 동기화하고 `node dist/migrate.js`를 호출한다.
6. migration 성공을 확인한 뒤 `api_image_tag`를 불변 image tag로 바꾸고 `api_desired_count=2`로 plan/apply한다. task는 `TRUST_PROXY=true`로 실행되고 ALB에서만 요청을 받는다.
7. `dist/pilot/`과 `dist/ops/`를 각각 출력된 S3 버킷에 배포하고 해당 CloudFront distribution을 무효화한다. API 정적 호스트 연결 전에 DB 마이그레이션과 API 헬스체크가 통과해야 한다.

ECR push와 ECS migration 실행을 위한 운영 권한이 실제 계정에서 준비되지 않았기 때문에 여기서는 외부 자원을 만들거나 배포하지 않았다.

## 로컬 정적 검증

Terraform 형식·구문 검증은 provider 다운로드 없이 다음처럼 실행할 수 있다.

```sh
docker run --rm -v "$PWD/infra:/workspace" -w /workspace hashicorp/terraform:1.12.2 fmt -check -recursive
docker run --rm -v "$PWD/infra:/workspace" -w /workspace hashicorp/terraform:1.12.2 init -backend=false
docker run --rm -v "$PWD/infra:/workspace" -w /workspace hashicorp/terraform:1.12.2 validate
```

실제 plan에는 AWS credentials, VPC/도메인/인증서 정보, SSM parameter, 원격 backend가 필요하다. `validate` 성공은 AWS quota·서비스 한도·계정 인증·리전별 자원 생성 가능성을 확인하지 않는다.
