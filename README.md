# 선물노트 GitHub Pages 시작하기

## 공개 범위

이 묶음은 개인 GitHub Pages 주소(`https://깃허브아이디.github.io`)로 게시하는 용도입니다. 사이트에 접속할 수 있는 사람은 누구나 페이지와 상품 글 작성 기능을 볼 수 있습니다. 저장소를 비공개로 두더라도 게시된 Pages 사이트가 비공개가 되는 것은 아닙니다. 공개 사용을 선택한 경우에만 진행하세요.

## 1. 저장소 만들기

1. GitHub에서 새 저장소를 만듭니다.
2. 저장소 이름을 GitHub 아이디와 똑같이 붙여 `깃허브아이디.github.io`로 입력합니다. 예: 아이디가 `minji77`이면 `minji77.github.io`입니다.
3. 처음 설정은 **Public(공개)** 으로 선택합니다.
4. 이 ZIP을 컴퓨터에서 압축 해제하고, 압축을 푼 폴더 안의 파일과 폴더를 저장소 최상위에 올립니다. `.github` 폴더도 포함해야 합니다.

## 2. Pages 배포 켜기

1. 저장소의 **Settings → Pages**로 들어갑니다.
2. **Build and deployment → Source**에서 **GitHub Actions**를 선택합니다.
3. 저장소의 **Actions** 탭에서 `Publish GitHub Pages` 작업이 완료될 때까지 기다립니다.
4. 완료 후 `https://깃허브아이디.github.io`에 접속합니다. 첫 배포에는 몇 분 걸릴 수 있습니다.

이후 `web` 폴더의 사이트 파일을 바꾸고 `main` 브랜치에 올리면 자동으로 다시 배포됩니다.

## 상품 불러오기 연결

GitHub Pages는 정적 웹 호스팅이라 상품 링크 수집은 별도 API 서버에 요청합니다. 이 패키지는 현재 연결된 API 주소를 `scripts/build-pages.mjs`에 미리 설정했고, API 서버의 GitHub Pages 허용 설정도 함께 준비했습니다. 별도 API 키를 입력할 필요는 없습니다. Pages에 연결할 사용자 주소는 기본 형태인 `https://깃허브아이디.github.io`를 사용하세요. 자체 도메인을 연결하면 API의 허용 주소 설정을 추가로 바꿔야 합니다.

## 포함 파일

- `web/`: 사이트 화면과 글 생성 코드
- `scripts/build-pages.mjs`: GitHub Pages용 파일 생성
- `.github/workflows/pages.yml`: GitHub Actions 자동 배포
- `worker/handler.mjs`: 기존 상품 API가 GitHub Pages 요청을 허용하는 설정
- `GITHUB_PAGES_시작하기.md`: 이 안내서
