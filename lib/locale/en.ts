// English translations (default)
export const en = {
  // Common
  common: {
    close: "Close",
    cancel: "Cancel",
    save: "Save",
    create: "Create",
    delete: "Delete",
    edit: "Edit",
    copy: "Copy",
    copied: "Copied!",
    search: "Search",
    loading: "Loading...",
    error: "Error",
    success: "Success",
  },

  // Navigation
  nav: {
    topics: "Topics",
    inbox: "Inbox",
    circles: "Circles",
  },

  // Topics page
  topics: {
    title: "Topics",
    today: "Today",
    thisWeek: "This week",
    summary: "Summary",
    keyPoints: "Key Points",
    fromNewsletters: "From these newsletters",
    shareToCircle: "Share to circle",
  },

  // Inbox page
  inbox: {
    title: "Inbox",
    all: "All",
    byTopic: "By topic",
    today: "Today",
    yesterday: "Yesterday",
    earlierThisWeek: "Earlier this week",
    aiSummary: "AI Summary",
    highlights: "Highlights",
    addHighlight: "Add highlight",
    addHighlightManually: "+ Add highlight manually",
    originalEmail: "Original email",
    showMore: "Show more",
    showLess: "Show less",
  },

  // Circles page
  circles: {
    title: "Circles",
    subtitle: "Discuss newsletters with friends",
    myFriends: "My Friends",
    friendsHelper: "Manage friends to invite to circles.",
    viewFriendList: "View friend list",
    inviteFriends: "Invite friends",
    addCircle: "Add circle",
    createCircle: "Create circle",
    friendList: "Friend list",
    inviteFriend: "Invite friend",
    inviteHelper: "Copy the invite link and share via iMessage, WhatsApp, etc.",
    copyLink: "Copy link",
    members: "members",
  },

  // Create circle page
  createCircle: {
    title: "Create new circle",
    circleName: "Circle name",
    circleNamePlaceholder: "e.g. AI Enthusiasts",
    circleNameHelper: "You can change this later in settings.",
    addFriends: "Add friends",
    searchFriends: "Search friends...",
    inviteByLink: "Invite by link",
    inviteLinkHelper: "Share the invite link via iMessage, WhatsApp, etc.",
    invited: "Invited",
    invite: "Invite",
    createButton: "Create circle",
    validationMessage: "Enter a circle name and select at least one friend.",
    successTitle: "Circle created!",
    successMessage: "Your circle has been created and invites sent to your friends.",
    goToCircles: "Go to circles",
  },

  // Highlights
  highlights: {
    highlight: "Highlight",
    shareToCircle: "Share to circle",
    remove: "Remove",
    myMemo: "My memo",
    addMemo: "Add a memo (optional)...",
    saveHighlight: "Save highlight",
    selectCircle: "Select a circle",
    share: "Share",
    shared: "Shared",
    missionProgress: "Daily mission progress",
    missionComplete: "Daily mission complete!",
    highlightCreated: "highlight created",
    highlightShared: "highlight shared",
  },

  // Time
  time: {
    justNow: "Just now",
    minutesAgo: "min ago",
    hoursAgo: "hr ago",
    daysAgo: "days ago",
  },
} as const

export type Locale = typeof en
