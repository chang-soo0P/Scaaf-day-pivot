// Korean translations
import type { Locale } from "./en"

export const ko: Locale = {
  // Common
  common: {
    close: "닫기",
    cancel: "취소",
    save: "저장",
    create: "생성",
    delete: "삭제",
    edit: "수정",
    copy: "복사",
    copied: "복사됨!",
    search: "검색",
    loading: "로딩 중...",
    error: "오류",
    success: "성공",
  },

  // Navigation
  nav: {
    topics: "주제",
    inbox: "받은 편지함",
    circles: "써클",
  },

  // Topics page
  topics: {
    title: "주제",
    today: "오늘",
    thisWeek: "이번 주",
    summary: "요약",
    keyPoints: "핵심 포인트",
    fromNewsletters: "이 뉴스레터들에서",
    shareToCircle: "써클에 공유",
  },

  // Inbox page
  inbox: {
    title: "받은 편지함",
    all: "전체",
    byTopic: "주제별",
    today: "오늘",
    yesterday: "어제",
    earlierThisWeek: "이번 주 초",
    aiSummary: "AI 요약",
    highlights: "하이라이트",
    addHighlight: "하이라이트 추가",
    addHighlightManually: "+ 직접 하이라이트 추가",
    originalEmail: "원본 이메일",
    showMore: "더 보기",
    showLess: "간략히",
  },

  // Circles page
  circles: {
    title: "써클",
    subtitle: "친구들과 뉴스레터를 논의하세요",
    myFriends: "내 친구",
    friendsHelper: "써클에 초대할 친구들을 관리해요.",
    viewFriendList: "내 친구 목록 보기",
    inviteFriends: "친구 초대하기",
    addCircle: "써클 추가",
    createCircle: "써클 생성",
    friendList: "친구 목록",
    inviteFriend: "친구 초대하기",
    inviteHelper: "아래 초대 링크를 복사해서 카카오톡, iMessage 등으로 보내세요.",
    copyLink: "링크 복사하기",
    members: "명",
  },

  // Create circle page
  createCircle: {
    title: "새 써클 생성하기",
    circleName: "써클 이름",
    circleNamePlaceholder: "예: AI 덕후 모임",
    circleNameHelper: "나중에 설정에서 언제든지 변경할 수 있어요.",
    addFriends: "친구 추가하기",
    searchFriends: "친구 검색...",
    inviteByLink: "링크로 초대하기",
    inviteLinkHelper: "카카오톡, iMessage 등 외부 메신저로 초대 링크를 공유하세요.",
    invited: "초대됨",
    invite: "초대",
    createButton: "써클 생성하기",
    validationMessage: "써클 이름을 입력하고 최소 한 명의 친구를 선택하세요.",
    successTitle: "써클이 생성되었습니다!",
    successMessage: "써클이 생성되었고, 친구들에게 초대가 전송되었어요.",
    goToCircles: "써클 목록으로 이동",
  },

  // Highlights
  highlights: {
    highlight: "하이라이트",
    shareToCircle: "써클에 공유",
    remove: "삭제",
    myMemo: "내 메모",
    addMemo: "메모 추가 (선택)...",
    saveHighlight: "하이라이트 저장",
    selectCircle: "써클 선택",
    share: "공유",
    shared: "공유됨",
    missionProgress: "일일 미션 진행중",
    missionComplete: "일일 미션 완료!",
    highlightCreated: "하이라이트 생성",
    highlightShared: "하이라이트 공유",
  },

  // Time
  time: {
    justNow: "방금",
    minutesAgo: "분 전",
    hoursAgo: "시간 전",
    daysAgo: "일 전",
  },
}
