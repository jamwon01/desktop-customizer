# macOS 테마 정밀 분석 스펙 (MACOS_THEME_SPEC)

> 목적: 데스크탑 커스터마이저에 "거의 카피에 가까운" macOS 테마를 구현하기 위한 정밀 분석.
> 원칙: Apple 실제 에셋(이미지/폰트/아이콘)은 번들하지 않고, 수치와 기법만 재현한다. (개인 사용 목적)

## 1. 구성 요소 총괄표

| 요소 | macOS 특성 | 우리 구현 방식 | 난이도 |
|---|---|---|---|
| Dock | 하단 유리 바 + 마그니피케이션 | 신규 컴포넌트 (JS/CSS) | ★★★ |
| 아이콘 타일 | 스퀘클 마스크 | SVG 스퀘클 마스크 | ★★ |
| 배경화면 | 흐르는 대형 그라데이션 | CSS 그라데이션 프리셋 + 느린 흐름 애니메이션 | ★ |
| 메뉴바 | 상단 반투명 24px + 시계 | 신규 바 (선택) | ★★ |
| 우클릭 메뉴 | vibrancy 반투명 | backdrop-filter 재질 교체 | ★ |
| 데스크탑 라벨 | 11px 흰색 + 그림자 | CSS 조정 | ★ |
| 타이포 | SF Pro | Inter 웹폰트(무료) 번들 | ★ |

## 2. 아이콘 — 스퀘클(Squircle)

macOS 앱 아이콘은 일반 `border-radius`(원호)가 아니라 **초타원(superellipse) 연속곡률**.

- Big Sur+ 공식 템플릿: 1024px 캔버스에 아이콘 본체 824px 중앙 배치,
  본체 기준 코너 반경 **약 185px ≈ 22.5%** (역설계 수치, 공식 벡터 스펙 없음)
- CSS 근사만으로는 초타원이 안 나옴 → **SVG path로 superellipse 모양 정의 후
  `clip-path` / `mask-image` 적용**이 정확한 방법

```
/* 근사(빠름): */ border-radius: 22.5%;
/* 정밀(권장): */ mask-image: url("squircle.svg"); /* superellipse n≈5 */
```

- 스퀘클 타일 위에 캐릭터 이미지를 얹는 구조: 타일 = 유리 질감(흰 반투명 그라데이션),
  이미지는 타일 안 80~90% 크기로 센터 정렬
- 그림자: macOS식 소프트 섀도 → `filter: drop-shadow(0 4px 12px rgba(0,0,0,.25))`

## 3. Dock — 작업 볼륨 최대

### 3.1 지오메트리
- 화면 **하단에 밀착**(모서리 노출 없음), 상단 2코너만 라운드 (1080p 기준 약 18~20px)
- 아이콘 기본 크기 64px(설정 32~128), 바 높이 = 아이콘 + 상하 패딩(≈10px)
- 좌우 패딩 ≈ 12px, 아이콘 간격 ≈ 8~10px

### 3.2 재질 (vibrancy 재현)
```css
background: rgba(255, 255, 255, 0.22);
backdrop-filter: blur(30px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.35);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
```
- `saturate(180%)`가 macOS "유리 느낌"의 핵심 (blur만으로는 안 비슷해짐)
- 배경이 밝으면 바가 밝아지고 어두우면 어두워지는 효과가 backdrop-filter로 자동 재현됨

### 3.3 마그니피케이션 (정밀)
- 커서에서의 거리 d에 대해 **가우시안 폴오프**:
  `scale = 1 + (maxScale − 1) × e^(−(d/σ)²)`
  - maxScale ≈ 1.5, σ ≈ 아이콘 폭 × 1.2 (영향 반경 ~2.5개 아이콘)
  - falloff 도메인 밖(멀리)은 반드시 scale 1로 clamp (Infinity/발산 방지)
- 스케일 변화는 매 mousemove마다 계산, transition 없이 즉시 적용 + 커서가 떠나면
  spring 비슷한 `transition: transform .25s cubic-bezier(.2,.9,.3,1.2)`로 복귀
- 아이콘 하단 정렬 유지 (커져도 바닥에 붙어있게 `transform-origin: bottom center`)
- 옆 아이콘 밀어내기: 실제 macOS는 간격이 늘어남 → transform scale만 쓰면 겹침.
  각 아이콘의 margin-left/right를 scale 비례로 동시 계산하거나, 컨테이너에
  `width` 변화 반영 (참고 구현: dashersw/macos-dock-in-css)

### 3.4 도크 인터랙션
- hover 시 이름 툴팁: 아이콘 **위쪽**에 다크 반투명 캡슐 (11~12px)
- 우측 구분선(세로 1px) + 휴지통/폴더 영역
- 우리 앱 연동: 편집 모드에서 아이콘을 하단으로 드래그 → 도킹 (그룹 흡수와 동일 패턴),
  도크 아이콘을 위로 드래그 → 꺼내기
- 데이터: `config.dock = { items: [...] }` (group과 같은 스키마 재사용)

## 4. 상단 메뉴바 (선택 요소)

- 높이 **24~25px**, 배경은 vibrancy 반투명(아래 배경색 따라감)
  → `backdrop-filter: blur(20px) saturate(180%); background: rgba(255,255,255,.15)`
- 좌측: 애플 로고 위치 + 앱 이름(Finder 느낌) / 우측: 시계 + 아이콘들
- 시계 형식: `10월 24일 (금) 오후 4:26` 한국어 형식 — clock widget은 이 바 안에 포함
- 우리 앱에서: 레이어 최상단에 고정 바, 높이 25px, 클릭 통과 유지
  (시계 text만 interactive)

## 5. 배경화면 — Sonoma/Sequoia식 흐르는 그라데이션

- 특징: 2~4색의 대형 유기적 그라데이션이 천천히 흐름
- 재현: CSS `radial-gradient` 여러 겹 + 배경 요소를 느리게 회전/스케일하는 애니메이션
  (60s 주기, GPU 저부하 — transform만 사용)
- 프리셋 3~5개: Sonoma 호라이즌(주황→보라), Sequoia 스카이(파랑→민트),
  모하비 느낌(주황→남색), 다크(청록→검정) 등
- 대안: 배경 프리셋에 "macOS 시리즈" 그룹으로 묶어서 제공

## 6. 우클릭 컨텍스트 메뉴 / 모달 재질

현재 어두운 불투명(#2b2b33) → macOS vibrancy로 교체:
```css
background: rgba(245, 245, 247, 0.85);   /* 라이트 테마 */
backdrop-filter: blur(25px) saturate(180%);
border-radius: 12px;
box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
/* 텍스트: #1d1d1f, hover 하이라이트: rgba(0,0,0,.08) */
```
- 항목 높이 ≈ 28px, 폰트 13px, 좌우 패딩 14px, 구분선 rgba(0,0,0,.1)
- macOS는 컨텍스트 메뉴가 라이트/다크를 배경에 따라 따라감 → 라이트 고정으로 시작

## 7. 타이포그래피

- SF Pro는 라이선스상 번들 불가 → **Inter**(OFL 무료)가 사실상 표준 대체재
- 시스템에 이미 있는 경우: `font-family: 'Inter', 'SF Pro Text', system-ui, sans-serif`
- Desktop 라벨: **11px, 흰색, text-shadow(0 1px 3px rgba(0,0,0,.6))**,
  아이콘 아래 중앙 정렬, hover 시 배경 하이라이트 없음(macOS는 라벨만 표시)
- 메뉴/모달 텍스트: 13px, #1d1d1f

## 8. 데스크탑 아이콘 배치 (authentic 디테일)

- macOS 기본: **화면 오른쪽 상단부터 아래로 세로 열 정렬** (Windows는 좌→우)
- 그리드 정렬 옵션에 "macOS식(우측 열)" 추가하면 실감 상승 — 저비용 고연출
- 아이콘 간격: 아이콘 64px 기준 셀 간격 약 54px 수직

## 9. 인터랙션 디테일 (실감 미세 요소)

- 아이콘 **더블클릭 불필요, 단일 클릭 실행은 유지** (macOS는 더블클릭이지만
  우리 앱은 런처이므로 단일 클릭 유지 — 기획상 결정)
- Dock 아이콘 클릭 시 살짝 눌리는 효과: `active` 시 scale 0.95
- 온보딩/설정 모달에도 동일 재질 적용해 테마 일관성 유지
- 커서: 기본 화살표 유지

## 10. 100% 카피가 불가능한 것 (한계 명시)

| 항목 | 이유 | 대안 |
|---|---|---|
| 진짜 vibrancy | Apple 비공개 GPU material | backdrop-filter blur+saturate로 90% 재현 |
| Genie 최소화 효과 | 창 관리 시스템 종속 | 범위 밖 (우리는 런처) |
| Launchpad/Spotlight | 별도 전체화면 UI | 추후 신규 컴포넌트로 검토 가능 |
| SF Pro | 라이선스 | Inter 대체 |
| Apple 월페이퍼 이미지 | 저작물 | CSS 그라데이션 재현 |
| Dock 반사 효과(구버전) | 현 세대 macOS엔 없음 | 불필요 |

## 11. 구현 단계 (제안)

1. **테마 플래그**: `config.theme` → `body.theme-macos` 클래스, CSS 변수로 재질 상수화
2. **아이콘/메뉴/모달 재질 교체** (스퀘클 마스크, vibrancy, Inter, 라벨 스타일)
3. **배경 프리셋**: "macOS 시리즈" 그라데이션 4종 + 느린 흐름 애니메이션
4. **Dock 컴포넌트**: 지오메트리 → 재질 → 마그니피케이션 → 도킹/꺼내기 → 툴팁
5. **메뉴바** (선택): 시계 포함
6. **그리드 정렬 macOS식 옵션**

## 참고 자료

- Apple HIG — App icons: https://developer.apple.com/design/human-interface-guidelines/app-icons
- Big Sur 아이콘 제작 가이드(역설계 수치): https://medium.com/design-bootcamp/creating-app-icons-for-macos-11-and-up-1132ccd479bc
- iOS/macOS 아이콘 가이드(마스크 비율): https://splitmetrics.com/blog/guide-to-mobile-icons
- Dock 마그니피케이션 순수 CSS 구현: https://github.com/dashersw/macos-dock-in-css
- Dock 마그니파이 CSS+JS 재현(폴오프 도메인 처리): https://buildui.com/recipes/magnified-dock
- Dock 마그니파이 원리 설명: https://medium.com/@dev48v/i-rebuilt-the-macos-dock-magnify-effect-in-css-js-9fc2b9ec3b6a
