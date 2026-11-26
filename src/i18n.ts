export type Lang = 'ru' | 'en' | 'uz';

export const LANG_LABELS: Record<Lang, string> = {
  ru: 'Русский',
  en: 'English',
  uz: 'Oʻzbekcha',
};

export interface Translations {
  appName: string;
  tagline: string;
  register: string;
  loginByKey: string;
  firstName: string;
  lastNameOptional: string;
  username: string;
  usernameHint: string;
  bioOptional: string;
  bioPlaceholder: string;
  avatarOptional: string;
  choosePhoto: string;
  removePhoto: string;
  creating: string;
  createProfileBtn: string;
  accessKeyLabel: string;
  accessKeyPlaceholder: string;
  accessKeyHint: string;
  checking: string;
  signInBtn: string;
  accountCreatedTitle: string;
  accountCreatedDesc: string;
  yourAccessKey: string;
  copy: string;
  copied: string;
  downloadTxt: string;
  goToChats: string;
  networkError: string;
  searchPlaceholder: string;
  searchResults: string;
  noUsersFound: string;
  peopleInApp: string;
  noChatsYet: string;
  noChatsHint: string;
  selectChatTitle: string;
  selectChatDesc: string;
  openMyProfile: string;
  loadingMessages: string;
  startChatWith: string;
  startChatHint: string;
  writeMessagePlaceholder: string;
  sendMessageAria: string;
  backToChats: string;
  myProfile: string;
  memberSince: string;
  noSimNote: string;
  avatarColor: string;
  lastNamePlaceholder: string;
  bioLabel: string;
  bioEditPlaceholder: string;
  cancel: string;
  save: string;
  saving: string;
  profileUpdated: string;
  accessKeySection: string;
  show: string;
  hide: string;
  rotateKey: string;
  confirmRotate: string;
  rotating: string;
  newKeyCreated: string;
  logout: string;
  languageLabel: string;
  profileTitle: string;
  callAudio: string;
  callVideo: string;
  usernameNoNumber: string;
  bioEmpty: string;
  registeredAt: string;
  callHistory: string;
  noCallsYet: string;
  callbackAudio: string;
  callbackVideo: string;
  createGroup: string;
  groupName: string;
  groupNamePlaceholder: string;
  groupDescOptional: string;
  groupDescPlaceholder: string;
  addMembers: string;
  selectedCount: string;
  createGroupBtn: string;
  groupInfo: string;
  membersCount: string;
  onlineShort: string;
  creatorBadge: string;
  writeDm: string;
  removeMember: string;
  addMemberBtn: string;
  leaveGroup: string;
  confirmLeaveGroup: string;
  editGroup: string;
  saveGroup: string;
  groupCreatedSys: string;
  groupLeftSys: string;
  groupAddedSys: string;
  groupRemovedSys: string;
  incomingCall: string;
  outgoingCall: string;
  missedCall: string;
  incomingVideoCall: string;
  outgoingVideoCall: string;
  missedVideoCall: string;
  callDeclined: string;
  callBusy: string;
  callCancelled: string;
  callUnanswered: string;
  callMissed: string;
  calling: string;
  connecting: string;
  answer: string;
  decline: string;
  hangup: string;
  mic: string;
  muted: string;
  camera: string;
  today: string;
  yesterday: string;
  online: string;
  lastSeenJustNow: string;
  lastSeenMinsAgo: string;
  lastSeenAt: string;
  lastSeenDate: string;
  toastFinishCallFirst: string;
  toastNoMediaAudio: string;
  toastNoMediaVideo: string;
  toastUserOfflineCallLogged: string;
  toastUserBusy: string;
  toastNoAnswer: string;
  toastCallDeclined: string;
  toastCallStartFailed: string;
  toastLoadHistoryFailed: string;
  toastSendFailed: string;
  toastGroupEmptyTitle: string;
  photoReadError: string;
  photoTypeError: string;
  photoSizeError: string;
  firstNamePlaceholder: string;
  lastNameInputPlaceholder: string;
  installApp: string;
  installOnIOS: string;
  installGuideTitle: string;
  installGuideAndroid: string;
  installGuideIOS: string;
  installGuideWindows: string;
  close: string;
  offlineBanner: string;
}

export const TRANSLATIONS: Record<Lang, Translations> = {
  ru: {
    appName: 'Эфир',
    tagline: 'Мессенджер без SIM-карты и номера телефона',
    register: 'Регистрация',
    loginByKey: 'Вход по ключу',
    firstName: 'Имя',
    lastNameOptional: 'Фамилия (необяз.)',
    username: 'Юзернейм',
    usernameHint: '3–20 символов: латиница, цифры и _',
    bioOptional: 'О себе (необяз.)',
    bioPlaceholder: 'На связи в любое время',
    avatarOptional: 'Аватар (по желанию)',
    choosePhoto: 'Выбрать фото',
    removePhoto: 'Удалить фото',
    creating: 'Создание...',
    createProfileBtn: 'Создать профиль и получить ключ',
    accessKeyLabel: 'Личный ключ доступа',
    accessKeyPlaceholder: 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX',
    accessKeyHint: 'Введите 24-значный ключ, выданный при регистрации',
    checking: 'Проверка...',
    signInBtn: 'Войти в мессенджер',
    accountCreatedTitle: 'Аккаунт создан',
    accountCreatedDesc:
      'Сохраните ваш личный ключ доступа. В мессенджере нет привязки к SIM-карте или номеру телефона — этот ключ нужен для входа на любых устройствах.',
    yourAccessKey: 'Ваш ключ доступа',
    copy: 'Копировать',
    copied: 'Скопировано',
    downloadTxt: 'Скачать .txt',
    goToChats: 'Перейти в чаты',
    networkError: 'Ошибка соединения с сервером',
    searchPlaceholder: 'Поиск по @юзернейму или имени',
    searchResults: 'Результаты поиска',
    noUsersFound: 'Пользователи не найдены',
    peopleInApp: 'Пользователи в Эфире',
    noChatsYet: 'Пока нет активных диалогов',
    noChatsHint:
      'Найдите собеседника через поиск или создайте группу для совместного общения.',
    selectChatTitle: 'Выберите чат или создайте группу',
    selectChatDesc:
      'Общайтесь в личных чатах и группах без номера телефона и SIM-карты. Все звонки сохраняются в истории.',
    openMyProfile: 'Открыть мой профиль',
    loadingMessages: 'Загрузка сообщений...',
    startChatWith: 'Начните общение',
    startChatHint:
      'Отправьте сообщение или совершите звонок — запись о звонке автоматически появится в чате.',
    writeMessagePlaceholder: 'Написать сообщение...',
    sendMessageAria: 'Отправить сообщение',
    backToChats: 'Назад к чатам',
    myProfile: 'Мой профиль',
    memberSince: 'В Эфире с',
    noSimNote: 'Без SIM-карты',
    avatarColor: 'Цвет аватара',
    lastNamePlaceholder: 'Необязательно',
    bioLabel: 'О себе',
    bioEditPlaceholder: 'Расскажите о себе или укажите статус...',
    cancel: 'Отмена',
    save: 'Сохранить',
    saving: 'Сохранение...',
    profileUpdated: 'Профиль обновлён',
    accessKeySection: 'Ключ доступа (вход без SIM)',
    show: 'Показать',
    hide: 'Скрыть',
    rotateKey: 'Сменить ключ',
    confirmRotate: 'Подтвердить смену',
    rotating: 'Обновление...',
    newKeyCreated: 'Новый ключ создан — сохраните его',
    logout: 'Выйти из аккаунта',
    languageLabel: 'Язык интерфейса',
    profileTitle: 'Профиль',
    callAudio: 'Позвонить',
    callVideo: 'Видео',
    usernameNoNumber: 'Юзернейм (без номера)',
    bioEmpty: 'Информация о себе не заполнена',
    registeredAt: 'Дата регистрации',
    callHistory: 'История звонков',
    noCallsYet:
      'После аудио- или видеозвонка запись о вызове появится здесь и в ленте чата.',
    callbackAudio: 'Перезвонить',
    callbackVideo: 'Перезвонить по видео',
    createGroup: 'Создать группу',
    groupName: 'Название группы',
    groupNamePlaceholder: 'Например: Команда проекта',
    groupDescOptional: 'Описание (необяз.)',
    groupDescPlaceholder: 'О чём эта группа...',
    addMembers: 'Участники',
    selectedCount: 'Выбрано',
    createGroupBtn: 'Создать группу',
    groupInfo: 'О группе',
    membersCount: 'участников',
    onlineShort: 'в сети',
    creatorBadge: 'Создатель',
    writeDm: 'Написать',
    removeMember: 'Удалить',
    addMemberBtn: 'Добавить участника',
    leaveGroup: 'Покинуть группу',
    confirmLeaveGroup: 'Подтвердить выход',
    editGroup: 'Редактировать группу',
    saveGroup: 'Сохранить группу',
    groupCreatedSys: 'создал(а) группу',
    groupLeftSys: 'покинул(а) группу',
    groupAddedSys: 'добавил(а) в группу',
    groupRemovedSys: 'удалил(а) из группы',
    incomingCall: 'Входящий звонок',
    outgoingCall: 'Исходящий звонок',
    missedCall: 'Пропущенный звонок',
    incomingVideoCall: 'Входящий видеозвонок',
    outgoingVideoCall: 'Исходящий видеозвонок',
    missedVideoCall: 'Пропущенный видеозвонок',
    callDeclined: 'Отклонён',
    callBusy: 'Занято',
    callCancelled: 'Отменён',
    callUnanswered: 'Не отвечен',
    callMissed: 'Пропущен',
    calling: 'Вызов...',
    connecting: 'Соединение...',
    answer: 'Ответить',
    decline: 'Отклонить',
    hangup: 'Завершить',
    mic: 'Микрофон',
    muted: 'Без звука',
    camera: 'Камера',
    today: 'Сегодня',
    yesterday: 'Вчера',
    online: 'в сети',
    lastSeenJustNow: 'был(а) только что',
    lastSeenMinsAgo: 'мин. назад',
    lastSeenAt: 'был(а) в',
    lastSeenDate: 'был(а)',
    toastFinishCallFirst: 'Сначала завершите текущий звонок',
    toastNoMediaAudio: 'Нет доступа к микрофону',
    toastNoMediaVideo: 'Нет доступа к камере или микрофону',
    toastUserOfflineCallLogged: 'Пользователь не в сети — звонок записан в чат',
    toastUserBusy: 'Абонент сейчас разговаривает',
    toastNoAnswer: 'Абонент не отвечает',
    toastCallDeclined: 'Собеседник отклонил звонок',
    toastCallStartFailed: 'Не удалось начать звонок',
    toastLoadHistoryFailed: 'Не удалось загрузить историю',
    toastSendFailed: 'Не удалось отправить сообщение',
    toastGroupEmptyTitle: 'Введите название группы',
    photoReadError: 'Не удалось прочитать изображение',
    photoTypeError: 'Выберите изображение PNG, JPEG или WebP',
    photoSizeError: 'Файл слишком большой (максимум 8 МБ)',
    firstNamePlaceholder: 'Алексей',
    lastNameInputPlaceholder: 'Волков',
    installApp: 'Установить',
    installOnIOS: 'На iPhone',
    installGuideTitle: 'Установка как приложение',
    installGuideAndroid: 'Android (Chrome): меню ⋮ → «Установить приложение»',
    installGuideIOS: 'iPhone (Safari): кнопка «Поделиться» ↑ → «На экран „Домой“»',
    installGuideWindows: 'Windows (Chrome / Edge): иконка установки в адресной строке справа',
    close: 'Понятно',
    offlineBanner: 'Нет подключения к сети — работа в офлайн-режиме',
  },
  en: {
    appName: 'Efir',
    tagline: 'Messenger without a SIM card or phone number',
    register: 'Register',
    loginByKey: 'Sign in with key',
    firstName: 'First name',
    lastNameOptional: 'Last name (optional)',
    username: 'Username',
    usernameHint: '3–20 chars: letters, digits and _',
    bioOptional: 'Bio (optional)',
    bioPlaceholder: 'Available anytime',
    avatarOptional: 'Avatar (optional)',
    choosePhoto: 'Choose photo',
    removePhoto: 'Remove photo',
    creating: 'Creating...',
    createProfileBtn: 'Create profile & get key',
    accessKeyLabel: 'Personal access key',
    accessKeyPlaceholder: 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX',
    accessKeyHint: 'Enter the 24-character key given at registration',
    checking: 'Checking...',
    signInBtn: 'Sign in',
    accountCreatedTitle: 'Account created',
    accountCreatedDesc:
      'Save your personal access key. This messenger has no SIM or phone number binding — use this key to sign in on any device.',
    yourAccessKey: 'Your access key',
    copy: 'Copy',
    copied: 'Copied',
    downloadTxt: 'Download .txt',
    goToChats: 'Open chats',
    networkError: 'Server connection error',
    searchPlaceholder: 'Search @username or name',
    searchResults: 'Search results',
    noUsersFound: 'No users found',
    peopleInApp: 'People in Efir',
    noChatsYet: 'No conversations yet',
    noChatsHint:
      'Search for a contact by @username or create a group chat.',
    selectChatTitle: 'Select a chat or create a group',
    selectChatDesc:
      'Chat and call without a phone number or SIM card. Every call is logged right inside the chat.',
    openMyProfile: 'Open my profile',
    loadingMessages: 'Loading messages...',
    startChatWith: 'Start chatting',
    startChatHint:
      'Send a message or place a call — call details are automatically logged in chat.',
    writeMessagePlaceholder: 'Write a message...',
    sendMessageAria: 'Send message',
    backToChats: 'Back to chats',
    myProfile: 'My profile',
    memberSince: 'Joined',
    noSimNote: 'SIM-free',
    avatarColor: 'Avatar color',
    lastNamePlaceholder: 'Optional',
    bioLabel: 'Bio',
    bioEditPlaceholder: 'Tell people about yourself...',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    profileUpdated: 'Profile updated',
    accessKeySection: 'Access key (SIM-free login)',
    show: 'Show',
    hide: 'Hide',
    rotateKey: 'Rotate key',
    confirmRotate: 'Confirm rotation',
    rotating: 'Rotating...',
    newKeyCreated: 'New key generated — save it',
    logout: 'Sign out',
    languageLabel: 'Interface language',
    profileTitle: 'Profile',
    callAudio: 'Call',
    callVideo: 'Video',
    usernameNoNumber: 'Username (no phone)',
    bioEmpty: 'No bio provided yet',
    registeredAt: 'Member since',
    callHistory: 'Call history',
    noCallsYet:
      'After an audio or video call, a call card will appear here and in the chat.',
    callbackAudio: 'Call back',
    callbackVideo: 'Video call back',
    createGroup: 'New group',
    groupName: 'Group name',
    groupNamePlaceholder: 'e.g. Core Team',
    groupDescOptional: 'Description (optional)',
    groupDescPlaceholder: 'What is this group about...',
    addMembers: 'Members',
    selectedCount: 'Selected',
    createGroupBtn: 'Create group',
    groupInfo: 'Group info',
    membersCount: 'members',
    onlineShort: 'online',
    creatorBadge: 'Owner',
    writeDm: 'Message',
    removeMember: 'Remove',
    addMemberBtn: 'Add member',
    leaveGroup: 'Leave group',
    confirmLeaveGroup: 'Confirm leave',
    editGroup: 'Edit group',
    saveGroup: 'Save group',
    groupCreatedSys: 'created the group',
    groupLeftSys: 'left the group',
    groupAddedSys: 'added',
    groupRemovedSys: 'removed',
    incomingCall: 'Incoming call',
    outgoingCall: 'Outgoing call',
    missedCall: 'Missed call',
    incomingVideoCall: 'Incoming video call',
    outgoingVideoCall: 'Outgoing video call',
    missedVideoCall: 'Missed video call',
    callDeclined: 'Declined',
    callBusy: 'Busy',
    callCancelled: 'Cancelled',
    callUnanswered: 'No answer',
    callMissed: 'Missed',
    calling: 'Calling...',
    connecting: 'Connecting...',
    answer: 'Answer',
    decline: 'Decline',
    hangup: 'End call',
    mic: 'Mic',
    muted: 'Muted',
    camera: 'Camera',
    today: 'Today',
    yesterday: 'Yesterday',
    online: 'online',
    lastSeenJustNow: 'last seen just now',
    lastSeenMinsAgo: 'min ago',
    lastSeenAt: 'last seen at',
    lastSeenDate: 'last seen',
    toastFinishCallFirst: 'End your current call first',
    toastNoMediaAudio: 'Microphone access denied',
    toastNoMediaVideo: 'Camera or microphone access denied',
    toastUserOfflineCallLogged: 'User is offline — missed call logged in chat',
    toastUserBusy: 'User is on another call',
    toastNoAnswer: 'No answer',
    toastCallDeclined: 'Call declined',
    toastCallStartFailed: 'Failed to start call',
    toastLoadHistoryFailed: 'Failed to load chat history',
    toastSendFailed: 'Failed to send message',
    toastGroupEmptyTitle: 'Enter a group name',
    photoReadError: 'Failed to read image',
    photoTypeError: 'Select a PNG, JPEG or WebP image',
    photoSizeError: 'File too large (max 8 MB)',
    firstNamePlaceholder: 'Alex',
    lastNameInputPlaceholder: 'Miller',
    installApp: 'Install App',
    installOnIOS: 'iPhone App',
    installGuideTitle: 'Install as an app',
    installGuideAndroid: 'Android (Chrome): menu ⋮ → Install app',
    installGuideIOS: 'iPhone (Safari): Share button ↑ → Add to Home Screen',
    installGuideWindows: 'Windows (Chrome / Edge): click the Install icon in the address bar',
    close: 'Got it',
    offlineBanner: 'Offline — waiting for connection',
  },
  uz: {
    appName: 'Efir',
    tagline: 'SIM-karta va telefon raqamisiz messenjer',
    register: 'Roʻyxatdan oʻtish',
    loginByKey: 'Kalit bilan kirish',
    firstName: 'Ism',
    lastNameOptional: 'Familiya (ixtiyoriy)',
    username: 'Foydalanuvchi nomi',
    usernameHint: '3–20 belgi: lotin harflari, raqamlar va _',
    bioOptional: 'Oʻzingiz haqingizda (ixtiyoriy)',
    bioPlaceholder: 'Doim aloqadaman',
    avatarOptional: 'Avatar (ixtiyoriy)',
    choosePhoto: 'Rasm tanlash',
    removePhoto: 'Rasmni oʻchirish',
    creating: 'Yaratilmoqda...',
    createProfileBtn: 'Profil yaratish va kalit olish',
    accessKeyLabel: 'Shaxsiy kirish kaliti',
    accessKeyPlaceholder: 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX',
    accessKeyHint: 'Roʻyxatdan oʻtganda berilgan 24 belgili kalitni kiriting',
    checking: 'Tekshirilmoqda...',
    signInBtn: 'Messenjerga kirish',
    accountCreatedTitle: 'Hisob yaratildi',
    accountCreatedDesc:
      'Shaxsiy kirish kalitingizni saqlab qoʻying. Messenjerda SIM-karta yoki telefon raqami talab qilinmaydi — bu kalit har qanday qurilmadan kirish uchun kerak.',
    yourAccessKey: 'Sizning kirish kalitingiz',
    copy: 'Nusxalash',
    copied: 'Nusxalandi',
    downloadTxt: '.txt yuklash',
    goToChats: 'Chatlarga oʻtish',
    networkError: 'Server bilan ulanishda xatolik',
    searchPlaceholder: '@username yoki ism boʻyicha qidirish',
    searchResults: 'Qidiruv natijalari',
    noUsersFound: 'Foydalanuvchilar topilmadi',
    peopleInApp: 'Efirdagi foydalanuvchilar',
    noChatsYet: 'Hozircha suhbatlar yoʻq',
    noChatsHint:
      'Qidiruv orqali suhbatdosh toping yoki guruh chat yarating.',
    selectChatTitle: 'Chat tanlang yoki guruh yarating',
    selectChatDesc:
      'Telefon raqami va SIM-kartasiz muloqot qiling. Barcha qoʻngʻiroqlar chat tarixida saqlanadi.',
    openMyProfile: 'Profilimni ochish',
    loadingMessages: 'Xabarlar yuklanmoqda...',
    startChatWith: 'Suhbatni boshlang',
    startChatHint:
      'Xabar yozing yoki qoʻngʻiroq qiling — qoʻngʻiroq yozuvi chatda avtomatik koʻrinadi.',
    writeMessagePlaceholder: 'Xabar yozish...',
    sendMessageAria: 'Xabar yuborish',
    backToChats: 'Chatlarga qaytish',
    myProfile: 'Mening profilim',
    memberSince: 'Efirda:',
    noSimNote: 'SIM-kartasiz',
    avatarColor: 'Avatar rangi',
    lastNamePlaceholder: 'Ixtiyoriy',
    bioLabel: 'Men haqimda',
    bioEditPlaceholder: 'Oʻzingiz haqingizda yozing...',
    cancel: 'Bekor qilish',
    save: 'Saqlash',
    saving: 'Saqlanmoqda...',
    profileUpdated: 'Profil yangilandi',
    accessKeySection: 'Kirish kaliti (SIM-kartasiz)',
    show: 'Koʻrsatish',
    hide: 'Yashirish',
    rotateKey: 'Kalitni yangilash',
    confirmRotate: 'Tasdiqlash',
    rotating: 'Yangilanmoqda...',
    newKeyCreated: 'Yangi kalit yaratildi — saqlab qoʻying',
    logout: 'Hisobdan chiqish',
    languageLabel: 'Interfeys tili',
    profileTitle: 'Profil',
    callAudio: 'Qoʻngʻiroq',
    callVideo: 'Video',
    usernameNoNumber: 'Username (raqamsiz)',
    bioEmpty: 'Maʼlumot kiritilmagan',
    registeredAt: 'Roʻyxatdan oʻtgan sana',
    callHistory: 'Qoʻngʻiroqlar tarixi',
    noCallsYet:
      'Audio yoki video qoʻngʻiroqdan soʻng qoʻngʻiroq kartasi shu yerda va chatda koʻrinadi.',
    callbackAudio: 'Qayta qoʻngʻiroq',
    callbackVideo: 'Video qayta qoʻngʻiroq',
    createGroup: 'Guruh yaratish',
    groupName: 'Guruh nomi',
    groupNamePlaceholder: 'Masalan: Doʻstlar',
    groupDescOptional: 'Tavsif (ixtiyoriy)',
    groupDescPlaceholder: 'Bu guruh nima haqida...',
    addMembers: 'Aʼzolar',
    selectedCount: 'Tanlandi',
    createGroupBtn: 'Guruh yaratish',
    groupInfo: 'Guruh haqida',
    membersCount: 'aʼzo',
    onlineShort: 'tarmoqda',
    creatorBadge: 'Yaratuvchi',
    writeDm: 'Yozish',
    removeMember: 'Olib tashlash',
    addMemberBtn: 'Aʼzo qoʻshish',
    leaveGroup: 'Guruhdan chiqish',
    confirmLeaveGroup: 'Chiqishni tasdiqlash',
    editGroup: 'Guruhni tahrirlash',
    saveGroup: 'Saqlash',
    groupCreatedSys: 'guruhni yaratdi',
    groupLeftSys: 'guruhdan chiqdi',
    groupAddedSys: 'guruhga qoʻshdi:',
    groupRemovedSys: 'guruhdan chiqardi:',
    incomingCall: 'Kiruvchi qoʻngʻiroq',
    outgoingCall: 'Chiquvchi qoʻngʻiroq',
    missedCall: 'Oʻtkazib yuborilgan qoʻngʻiroq',
    incomingVideoCall: 'Kiruvchi video qoʻngʻiroq',
    outgoingVideoCall: 'Chiquvchi video qoʻngʻiroq',
    missedVideoCall: 'Oʻtkazib yuborilgan video',
    callDeclined: 'Rad etilgan',
    callBusy: 'Band',
    callCancelled: 'Bekor qilingan',
    callUnanswered: 'Javobsiz',
    callMissed: 'Oʻtkazib yuborildi',
    calling: 'Chaqirilmoqda...',
    connecting: 'Ulanmoqda...',
    answer: 'Javob berish',
    decline: 'Rad etish',
    hangup: 'Tugatish',
    mic: 'Mikrofon',
    muted: 'Ovoz oʻchirilgan',
    camera: 'Kamera',
    today: 'Bugun',
    yesterday: 'Kecha',
    online: 'tarmoqda',
    lastSeenJustNow: 'hozirgina onlayn edi',
    lastSeenMinsAgo: 'daq. oldin',
    lastSeenAt: 'onlayn:',
    lastSeenDate: 'oxirgi faollik:',
    toastFinishCallFirst: 'Avval joriy qoʻngʻiroqni tugating',
    toastNoMediaAudio: 'Mikrofonga ruxsat yoʻq',
    toastNoMediaVideo: 'Kamera yoki mikrofonga ruxsat yoʻq',
    toastUserOfflineCallLogged: 'Foydalanuvchi oflayn — qoʻngʻiroq chatga yozildi',
    toastUserBusy: 'Suhbatdosh hozir band',
    toastNoAnswer: 'Javob bermadi',
    toastCallDeclined: 'Qoʻngʻiroq rad etildi',
    toastCallStartFailed: 'Qoʻngʻiroqni boshlab boʻlmadi',
    toastLoadHistoryFailed: 'Tarixni yuklab boʻlmadi',
    toastSendFailed: 'Xabar yuborib boʻlmadi',
    toastGroupEmptyTitle: 'Guruh nomini kiriting',
    photoReadError: 'Rasmni oʻqib boʻlmadi',
    photoTypeError: 'PNG, JPEG yoki WebP rasm tanlang',
    photoSizeError: 'Fayl juda katta (maks. 8 MB)',
    firstNamePlaceholder: 'Jasur',
    lastNameInputPlaceholder: 'Karimov',
    installApp: 'Ilovani oʻrnatish',
    installOnIOS: 'iPhone’ga oʻrnatish',
    installGuideTitle: 'Ilova sifatida oʻrnatish',
    installGuideAndroid: 'Android (Chrome): menyu ⋮ → «Ilovani oʻrnatish»',
    installGuideIOS: 'iPhone (Safari): «Ulashish» ↑ tugmasi → «Bosh ekranga qoʻshish»',
    installGuideWindows: 'Windows (Chrome / Edge): manzil satridagi oʻrnatish belgisini bosing',
    close: 'Tushunarli',
    offlineBanner: 'Internet aloqasi yoʻq — oflayn rejim',
  },
};
