export const AppState = {
    user: null,
    tokens: {
        access: sessionStorage.getItem("accessToken"),
        refresh: localStorage.getItem("refreshToken")
    },
    ui: {
        activeModal: null, // 'addContact', 'profile',  'contactProfile', 'editMessage', 'callLogs', 'incomingCall', 'videoCall'
        globalMessage: null
    },
    conversations: {
        status: 'idle', // 'idle' | 'loading' | 'success' | 'empty' | 'error'
        data: [],
        error: null
    },
    activeChat: {
        status: 'idle',
        partner: null,
        messages: [],
        inputText: "",
        oldestCursor: null,
        isFetchingOld: false,
        selectedMessageId: null,
        selectedMessageText: null
    },
    call: {
        status: 'idle',
        isAudioCall: false,
        partnerId: null,
        pendingOffer: null
    }
};