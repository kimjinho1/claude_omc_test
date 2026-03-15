# Deep Interview Spec: 레드마인 기반 자동 개발 워크플로우

## Metadata
- Interview ID: redmine-dev-workflow-20260316
- Rounds: 4
- Final Ambiguity Score: 17%
- Type: greenfield
- Generated: 2026-03-16
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| 차원 | 점수 | 가중치 | 기여 |
|------|------|--------|------|
| 목표 명확도 | 0.88 | 40% | 0.35 |
| 제약 명확도 | 0.78 | 30% | 0.23 |
| 성공 기준 | 0.80 | 30% | 0.24 |
| **총 명확도** | | | **0.83** |
| **모호도** | | | **17%** |

## Goal
레드마인 일감 번호와 내용을 Claude에게 전달하면, **분석 → 기획(피드백) → 개발(테스트 포함) → 커밋별 승인 → PR** 전 과정을 Claude가 자동으로 진행한다.

## 전체 워크플로우

```
1. [사용자] 레드마인 일감 번호 + 내용 복붙
      ↓
2. [Claude] 일감 분석 → 필요 정보 요청
   (장비 매뉴얼, 명령어 파일 등 — 필요할 때마다 요청)
      ↓
3. [Claude] 개발 기획서 작성 → 사용자 피드백
      ↓
4. [사용자] 피드백 제공 → 기획 확정
      ↓
5. [Claude] 개발 진행 (모든 코드에 테스트 코드 포함)
   - 테스트 프레임워크 유무 확인 → 없으면 상황에 맞게 제안/구축
      ↓
6. [커밋마다] Claude가 diff 보여줌 → 사용자 승인 → 커밋
      ↓
7. [Claude] 전체 커밋 완료 후 PR 생성
      ↓
8. [사용자] 실제 장비 연동 후 수동 테스트
```

## Constraints
- **레드마인 접근:** 사용자가 일감 내용을 직접 복붙 (API 연동 없음)
- **장비 매뉴얼:** Claude가 필요 시 요청 → 사용자가 그때그때 제공 (파일 첨부 또는 텍스트)
- **커밋 방식:** diff 제시 → 사용자 승인 후 커밋 (자동 커밋 없음)
- **테스트 환경:** 일감마다 다름 — 기존 프레임워크 있으면 사용, 없으면 Claude가 상황에 맞게 제안
- **실제 동작 테스트:** 네트워크 장비 연동이 필요하므로 개발자가 직접 수행 (자동화 불가)
- **브랜치 네이밍:** 레드마인 일감 번호 기반 (`feature/redmine-{번호}` 또는 `fix/redmine-{번호}`)

## Non-Goals
- 레드마인 API 직접 연동 (현재 범위 외)
- 실제 장비 연동 테스트 자동화 (물리적 테스트는 개발자 직접 수행)
- CI/CD 파이프라인 구축
- 레드마인 일감 상태 자동 업데이트

## Acceptance Criteria
- [ ] 일감 번호 + 내용 입력 시 Claude가 문제를 분석하고 부족한 정보를 명확히 요청함
- [ ] 개발 기획서가 작성되고 사용자 피드백 반영 후 개발이 시작됨
- [ ] 모든 구현 코드에 테스트 코드가 함께 작성됨
- [ ] 커밋마다 diff를 보여주고 사용자 승인 후 커밋이 이루어짐
- [ ] 일감 번호로 브랜치가 생성됨
- [ ] 모든 커밋 완료 후 PR이 자동 생성됨
- [ ] 테스트 프레임워크 유무를 파악하고 없을 경우 적절히 대응함

## Assumptions Exposed & Resolved
| 가정 | 질문 | 결론 |
|------|------|------|
| Redmine API로 자동 조회 | "어떻게 내용을 읽을까?" | 사용자 직접 복붙으로 결정 |
| 커밋 후 리뷰 | "커밋 확인이 어떤 방식?" | diff 보여주고 커밋 전 승인 |
| 매뉴얼 미리 저장 | "장비 매뉴얼 제공 방식?" | 필요 시 Claude가 요청 |
| 테스트 환경 항상 존재 | "테스트 프레임워크 있나?" | 일감마다 다름, 동적 대응 |

## Technical Context
- 이 레포에는 현재 소스 코드 없음 (설정/문서 레포)
- 실제 구현은 워크플로우 정의 파일 (CLAUDE.md 규칙)로 구성
- 기술 스택은 일감마다 다르므로 Claude가 상황에 맞게 파악

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| RedmineTicket | external system | number, title, description, type | triggers Workflow |
| Developer | core domain | role | approves Commit, provides DeviceManual |
| DevPlan | core domain | content, status, feedback | derived from RedmineTicket |
| NetworkDevice | external system | model, commands, manual | referenced in DevPlan |
| DeviceManual | supporting | content, format | provided by Developer on request |
| Branch | supporting | name (redmine-{number}) | contains Commits |
| Commit | supporting | diff, message, status | approved by Developer |
| PullRequest | core domain | title, body, branch | created after all Commits approved |
| TestCode | supporting | framework, coverage | accompanies all source code |

## 구현 방법 (CLAUDE.md 워크플로우)

이 워크플로우는 `.claude/CLAUDE.md`에 규칙으로 정의하여 팀 전체가 동일하게 사용:

```markdown
## 레드마인 개발 워크플로우

레드마인 일감 번호 + 내용이 제공되면 아래 순서를 따른다:

1. **일감 분석**: 문제 파악, 필요 정보 목록 작성 후 사용자에게 요청
2. **기획서 작성**: 구현 방법, 예상 파일 변경, 테스트 전략 포함
3. **피드백 수렴**: 사용자 피드백 반영 후 개발 시작 선언
4. **브랜치 생성**: `feature/redmine-{번호}` 또는 `fix/redmine-{번호}`
5. **개발**: 기능 코드 + 테스트 코드 동시 작성
6. **커밋 승인**: 각 커밋 전 diff 제시 → 사용자 승인 대기
7. **PR 생성**: 전체 완료 후 gh pr create 실행
```

## Interview Transcript
<details>
<summary>전체 Q&A (4 라운드)</summary>

### Round 1
**Q:** 레드마인 일감 번호를 주면 Claude가 내용을 어떻게 읽어야 할까요?
**A:** 사용자가 내용 복붙
**모호도:** 46%

### Round 2
**Q:** '커밋마다 나한테 확인을 받아야 한다'는 게 정확히 어떤 의미인가요?
**A:** diff 보여주고 커밋 전 승인
**모호도:** 34%

### Round 3
**Q:** 네트워크 장비 매뉴얼이나 명령어 정리 파일을 Claude에게 어떻게 전달할 게요?
**A:** 필요할 때마다 요청
**모호도:** 26%

### Round 4 (Contrarian Mode)
**Q:** 테스트 프레임워크가 이미 세팅되어 있나요? 없다면 범위에 포함되나요?
**A:** 일감마다 다름
**모호도:** 17% ✓

</details>
