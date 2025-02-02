import { date, Platform } from 'quasar'
import { VEmojiPicker } from 'v-emoji-picker'
import Vue from 'vue'
import { EntityState } from 'libcolla'
import { CollaUtil, TypeUtil, BlobUtil, UUID, StringUtil } from 'libcolla'
import { myself, dataBlockService, peerClientService, queryValueAction } from 'libcolla'
import { BlockType } from 'libcolla'

import pinyinUtil from '@/libs/base/colla-pinyin'
import { audioCaptureComponent, mediaCaptureComponent, mediaComponent, cameraComponent, alloyFingerComponent, mediaPickerComponent, mediaRecorderComponent, mediaStreamComponent, audioInputComponent } from '@/libs/base/colla-media'
import { statusBarComponent, fileComponent, photoLibraryComponent } from '@/libs/base/colla-cordova'
import { chatComponent, ChatContentType, ChatMessageStatus, ChatDataType, P2pChatMessageType, SubjectType, chatBlockComponent } from '@/libs/biz/colla-chat'
import { ActiveStatus, contactComponent, ContactDataType, MemberType, RequestStatus, RequestType } from '@/libs/biz/colla-contact'
import { SrcEntityType, CollectionType } from '@/libs/biz/colla-collection'
import { collectionUtil } from '@/libs/biz/colla-collection-util'

import GroupAvatar from '@/components/groupAvatar'
import ContactsDetails from '@/components/contactsDetails'
import FindContacts from '@/components/findContacts'
import SelectContacts from '@/components/selectContacts'
import SelectChat from '@/components/selectChat'
import MergeMessageDialog from '@/components/mergeMessageDialog'
import NoteMessageDialog from '@/components/noteMessageDialog'
import MessageContent from '@/components/messageContent'
import Collection from '@/components/collection'
import CaptureMedia from '@/components/captureMedia'

export default {
  name: "Message",
  components: {
    contactsDetails: ContactsDetails,
    findContacts: FindContacts,
    selectContacts: SelectContacts,
    selectChat: SelectChat,
    collection: Collection,
    captureMedia: CaptureMedia,
    groupAvatar: GroupAvatar,
    vEmojiPicker: VEmojiPicker,
    mergeMessageDialog: MergeMessageDialog,
    noteMessageDialog: NoteMessageDialog,
    messageContent: MessageContent
  },
  props: [],
  data() {
    return {
      sending: false,
      Platform: Platform,
      subKind: this.$store.messageEntry === 'search' ? 'searchChatHistory' : 'default',
      SubjectType: SubjectType,
      ActiveStatus: ActiveStatus,
      ChatMessageStatus: ChatMessageStatus,
      MemberType: MemberType,
      messageMultiSelectedVal: [],
      messageMultiSelectMode: false,
      P2pChatMessageType: P2pChatMessageType,
      ChatContentType: ChatContentType,
      videoDialog: false,
      mediaMemberList: [],
      captureType: null,
      srcStream: null,
      captureStatus: false,
      captureRecorder: null,
      currentStream: null,
      currentCallChat: null,
      zoomStream: null,
      imageUrl: null,
      audioUrl: null,
      videoUrl: null,
      date: date,
      percent: {},
      destroyClock: false,
      clockOptions: [
        { label: this.$i18n.t('10 min'), value: 600000 },
        { label: this.$i18n.t('5 min'), value: 300000 },
        { label: this.$i18n.t('1 min'), value: 60000 },
        { label: this.$i18n.t('30 sec'), value: 30000 },
        { label: this.$i18n.t('10 sec'), value: 10000 },
        { label: this.$i18n.t('Off'), value: 0 }
      ],
      //richTextEditor
      editor: null,
      currentMergeMessage: null,
      selectFocusMemberFilter: null,
      focusGroupMemberDialog: false,
      emojiShow: false,
      slide: 'slide1',
      keyboardMode: true,
      //auidoTouch
      eY1: 0,
      eY2: 0,
      eY3: 0,
      isDrag: true,
      voiceIdx: null,
      difftime: 0,
      audioTouchDialog: false,
      localStream: null,
      mediaTimer: null,
      audioTouchHoldStatus: false,
      audioTouchTimeOut: null,
      imageTouchTimeOut: null,
      nonsysChatContentTypeIndex: 0,
      searchableChatContentTypeIndex: 0,
      nonsysChatContentTypes: [
        { label: this.$i18n.t(ChatContentType.ALL), value: ChatContentType.ALL },
        { label: this.$i18n.t(ChatContentType.NOTE), value: ChatContentType.NOTE },
        { label: this.$i18n.t(ChatContentType.CHAT), value: ChatContentType.CHAT },
        { label: this.$i18n.t(ChatContentType.TEXT), value: ChatContentType.TEXT },
        { label: this.$i18n.t(ChatContentType.IMAGE), value: ChatContentType.IMAGE },
        { label: this.$i18n.t(ChatContentType.VIDEO), value: ChatContentType.VIDEO },
        { label: this.$i18n.t(ChatContentType.AUDIO), value: ChatContentType.AUDIO },
        { label: this.$i18n.t(ChatContentType.FILE), value: ChatContentType.FILE },
        { label: this.$i18n.t(ChatContentType.VOICE), value: ChatContentType.VOICE },
        //{ label: this.$i18n.t(ChatContentType.LINK), value: ChatContentType.LINK },
        //{ label: this.$i18n.t(ChatContentType.POSITION), value: ChatContentType.POSITION },
        { label: this.$i18n.t(ChatContentType.CARD), value: ChatContentType.CARD }
      ],
      searchableChatContentTypes: [
        { label: this.$i18n.t(ChatContentType.ALL), value: ChatContentType.ALL },
        { label: this.$i18n.t(ChatContentType.NOTE), value: ChatContentType.NOTE },
        { label: this.$i18n.t(ChatContentType.CHAT), value: ChatContentType.CHAT },
        { label: this.$i18n.t(ChatContentType.TEXT), value: ChatContentType.TEXT },
        //{ label: this.$i18n.t(ChatContentType.IMAGE), value: ChatContentType.IMAGE },
        //{ label: this.$i18n.t(ChatContentType.VIDEO), value: ChatContentType.VIDEO },
        //{ label: this.$i18n.t(ChatContentType.AUDIO), value: ChatContentType.AUDIO },
        { label: this.$i18n.t(ChatContentType.FILE), value: ChatContentType.FILE },
        //{ label: this.$i18n.t(ChatContentType.VOICE), value: ChatContentType.VOICE },
        //{ label: this.$i18n.t(ChatContentType.LINK), value: ChatContentType.LINK },
        //{ label: this.$i18n.t(ChatContentType.POSITION), value: ChatContentType.POSITION },
        { label: this.$i18n.t(ChatContentType.CARD), value: ChatContentType.CARD }
      ],
      chatContentTypeOptions: {
        activeColor: myself.myselfPeerClient.primaryColor
      },
      searchPrefix: this.$store.messageEntry === 'search' ? this.$store.messageSearchPrefix : null,
      searchText: this.$store.messageEntry === 'search' ? this.$store.messageSearchText : null,
      searchDate: null,
      searchSenderPeerId: null,
      searchSenderName: null,
      messageResultList: this.$store.messageEntry === 'search' ? this.$store.messageResultList : [],
      searching: this.$store.messageEntry === 'search' ? true : false,
      chatMessageResultList: [],
      // group chat ///////////////////////////////////////////////////////////////////////////////////
      selectGroupChatMemberFlag: null, // removeGroupChatMember, ownershipHandover, selectedGroupCallMember, searchMessage
      selectedGroupChatMembers: [], // removeGroupChatMember, selectedGroupCallMember
      selectedGroupChatMemberPeerId: null, // ownershipHandover
      groupChatMemberfilter: null,
      groupChatData: {
        name: null,
        description: null,
        givenName: null,
        tag: null,
        myAlias: null
      },
      placeholder: '\ue672' + ' ' + this.$i18n.t('Search'),
      placeholder2: '\ue672' + ' ' + (myself.myselfPeerClient.localDataCryptoSwitch === true ? this.$i18n.t('Local Data Crypto mode only search by Tag') : this.$i18n.t('Search')),
      groupFileList: [],
      groupFileFilter: null
    }
  },
  computed: {
    ifMobileSize() {
      return (!window.device && this.$q.screen.width < 481)
    },
    ifIAmGroupOwner() {
      let _that = this
      let store = _that.$store
      return function (currentChat) {
        let ret = false
        if (currentChat) {
          let groupChat = store.state.groupChatMap[currentChat.subjectId]
          if (groupChat) {
            if (groupChat.groupOwnerPeerId === myself.myselfPeerClient.peerId) {
              ret = true
            }
          }
        }
        return ret
      }
    },
    ifObsoleteGroupChat() {
      let _that = this
      let store = _that.$store
      return function (currentChat) {
        let ret = true
        if (currentChat) {
          let groupChat = store.state.groupChatMap[currentChat.subjectId]
          if (groupChat && groupChat.groupMembers && groupChat.groupMembers.length > 0) {
            for (groupMember of groupChat.groupMembers) {
              if (groupMember.memberPeerId === myself.myselfPeerClient.peerId) {
                ret = false
              }
            }
          }
        }
        return ret
      }
    },
    MessageName() {
      let _that = this
      let store = _that.$store
      return function (message) {
        return (message.subjectType === SubjectType.CHAT) ? '' : (message.senderPeerId == store.state.myselfPeerClient.peerId ? store.state.myselfPeerClient.name : (store.state.linkmanMap[message.senderPeerId].givenName ? store.state.linkmanMap[message.senderPeerId].givenName : store.state.linkmanMap[message.senderPeerId].name))
      }
    },
    MessageAvatar() {
      let _that = this
      let store = _that.$store
      return function (message) {
        return message.senderPeerId == store.state.myselfPeerClient.peerId ? (store.state.myselfPeerClient.avatar ? store.state.myselfPeerClient.avatar : store.defaultActiveAvatar) : (store.state.linkmanMap[message.senderPeerId].avatar ? store.state.linkmanMap[message.senderPeerId].avatar : store.defaultActiveAvatar);
      }
    },
    ChatTitle() {
      let _that = this
      let store = _that.$store
      return function (currentChat) {
        let chatTitle = ''
        if (currentChat) {
          if (currentChat.subjectType === SubjectType.CHAT) {
            let linkman = store.state.linkmanMap[currentChat.subjectId]
            if (linkman) {
              chatTitle = linkman.givenName ? linkman.givenName : linkman.name
            }
          } else if (currentChat.subjectType === SubjectType.GROUP_CHAT) {
            let groupChat = store.state.groupChatMap[currentChat.subjectId]
            if (groupChat) {
              chatTitle = (groupChat.givenName ? groupChat.givenName : (groupChat.name ? groupChat.name : _that.$i18n.t('Group Chat'))) + '(' + groupChat.groupMembers.length + ')'
            }
          }
        }
        return chatTitle
      }
    },
    isRecallTimeLimit() {
      let _that = this
      let store = _that.$store

      return function (message) {
        if (message.senderPeerId !== store.state.myselfPeerClient.peerId) {
          return true
        }
        let result = false
        let recallTimeLimit
        if (message.subjectType === SubjectType.CHAT) {
          let linkman = store.state.linkmanMap[message.subjectId]
          if (!linkman) return true
          recallTimeLimit = linkman.recallTimeLimit
        } else if (message.subjectType === SubjectType.GROUP_CHAT) {
          let group = store.state.groupChatMap[message.subjectId]
          if (!group) return true
          recallTimeLimit = group.recallTimeLimit
        }
        if (recallTimeLimit) {
          return (new Date().getTime() - message.createDate) > 2 * 60 * 1000
        }
      }
    },
    ifSelfChat() {
      let _that = this
      let store = _that.$store
      let currentChat = store.state.currentChat
      if (currentChat && currentChat.subjectId === myself.myselfPeerClient.peerId) {
        return true
      } else {
        return false
      }
    },
    activeStatus() {
      let _that = this
      let store = _that.$store
      return function (currentChat) {
        if (!currentChat) {
          return false;
        } else if (currentChat.subjectType === SubjectType.CHAT) {
          return store.state.linkmanMap[currentChat.subjectId] && store.state.linkmanMap[currentChat.subjectId].activeStatus === ActiveStatus.UP;
        } else if (currentChat.subjectType === SubjectType.GROUP_CHAT) {
          return store.state.groupChatMap[currentChat.subjectId] && store.state.groupChatMap[currentChat.subjectId].activeStatus === ActiveStatus.UP;
        }
      }
    },
    detailDateFormat() {
      let _that = this
      return function (createDate) {
        if (createDate) {
          createDate = new Date(createDate)
          let currentDate = new Date()
          let dateString = createDate.toDateString()
          let currentDateString = currentDate.toDateString()
          if (dateString === currentDateString) {
            return date.formatDate(createDate, 'HH:mm')
          } else if ((new Date(currentDateString) - new Date(dateString)) / (1000 * 60 * 60 * 24) < 7) {
            let weekTimeString = date.formatDate(createDate, 'dddd HH:mm')
            let weekTimeArrary = weekTimeString.split(' ')
            let weekString = `${_that.$i18n.t(weekTimeArrary[0])} ${weekTimeArrary[1]}`
            return weekString
          } else {
            return date.formatDate(createDate, 'YYYY-MM-DD HH:mm')
          }
        }
      }
    },
    ChatName() {
      let _that = this
      let store = _that.$store
      return function (chat) {
        let subjectType = chat.subjectType
        let subjectId = chat.subjectId
        return store.getChatName(subjectType, subjectId)
      }
    },
    FocusGroupMemberOptions() {
      let _that = this
      let store = _that.$store
      if (store.state.currentChat.subjectType !== SubjectType.GROUP_CHAT) return
      let selectFocusMemberFilteredArray = []
      let members = store.state.groupChatMap[store.state.currentChat.subjectId].groupMembers
      let selectFocusMemberFilter = _that.selectFocusMemberFilter
      if (selectFocusMemberFilter) {
        selectFocusMemberFilteredArray = members.filter((member) => {
          if (member) {
            let linkman = store.state.linkmanMap[member.memberPeerId]
            return (linkman.peerId.toLowerCase().includes(selectFocusMemberFilter.toLowerCase())
              || linkman.mobile.toLowerCase().includes(selectFocusMemberFilter.toLowerCase())
              || linkman.name.toLowerCase().includes(selectFocusMemberFilter.toLowerCase())
              || linkman.pyName.toLowerCase().includes(selectFocusMemberFilter.toLowerCase())
              || (linkman.givenName && linkman.givenName.toLowerCase().includes(selectFocusMemberFilter.toLowerCase()))
              || (linkman.pyGivenName && linkman.pyGivenName.toLowerCase().includes(selectFocusMemberFilter.toLowerCase()))
              || (linkman.tag && chat.tag.toLowerCase().includes(selectFocusMemberFilter.toLowerCase()))
              || (linkman.pyTag && chat.pyTag.toLowerCase().includes(selectFocusMemberFilter.toLowerCase())))
              && (member.memberPeerId !== myself.myselfPeerClient.peerId)
          }
        })
      } else {
        selectFocusMemberFilteredArray = members.filter((member) => {
          if (member) {
            return member.memberPeerId !== myself.myselfPeerClient.peerId && store.state.linkmanMap[member.memberPeerId]
          }
        })
      }
      return selectFocusMemberFilteredArray
    },
    // group chat ///////////////////////////////////////////////////////////////////////////////////
    GroupChatMemberFilteredList() { // 删除群组成员、群主身份转让待选择群组成员（groupChatMemberfilter过滤搜索），实际选择的不是GroupChatMember，而是对应的linkman
      let _that = this
      let store = _that.$store
      let GroupChatMemberFilteredArray = []
      let currentChat = store.state.currentChat
      if (currentChat) {
        let groupChat = store.state.groupChatMap[currentChat.subjectId]
        if (groupChat) {
          let linkmans = []
          for (let groupChatMember of groupChat.groupMembers) {
            if (groupChatMember.memberPeerId === currentChat.ownerPeerId && _that.selectGroupChatMemberFlag !== 'searchMessage') {
              continue;
            }
            let linkman = store.state.linkmanMap[groupChatMember.memberPeerId]
            if (linkman) {
              linkmans.push(linkman)
            }
          }
          let groupChatMemberfilter = _that.groupChatMemberfilter
          if (groupChatMemberfilter) {
            GroupChatMemberFilteredArray = linkmans.filter((linkman) => {
              return (linkman.peerId.toLowerCase().includes(groupChatMemberfilter.toLowerCase())
                || linkman.mobile.toLowerCase().includes(groupChatMemberfilter.toLowerCase())
                || linkman.name.toLowerCase().includes(groupChatMemberfilter.toLowerCase())
                || linkman.pyName.toLowerCase().includes(groupChatMemberfilter.toLowerCase())
                || (linkman.givenName && linkman.givenName.toLowerCase().includes(groupChatMemberfilter.toLowerCase()))
                || (linkman.pyGivenName && linkman.pyGivenName.toLowerCase().includes(groupChatMemberfilter.toLowerCase()))
                || (linkman.tag && linkman.tag.toLowerCase().includes(groupChatMemberfilter.toLowerCase()))
                || (linkman.pyTag && linkman.pyTag.toLowerCase().includes(groupChatMemberfilter.toLowerCase())))
            })
          } else {
            GroupChatMemberFilteredArray = linkmans
          }
        }
      }
      return GroupChatMemberFilteredArray
    },
    /*GetMemberAlias() {
      let _that = this
      let store = _that.$store
      return function (peerId) {
        let currentChat = store.state.currentChat
        if (currentChat && currentChat.subjectType === 'GroupChat') {
          let groupMembers = currentChat.groupMembers
          if (groupMembers && groupMembers.length > 0) {
            for (let groupMember of groupMembers) {
              if (groupMember.memberPeerId === peerId) {
                return groupMember.memberAlias
              }
            }
          }
        }
      }
    }*/
    GroupFileFilteredList() {
      let _that = this
      let store = _that.$store
      let groupFileFilteredArray = []
      let groupFileList = _that.groupFileList
      if (groupFileList && groupFileList.length > 0) {
        let groupFileFilter = _that.groupFileFilter
        if (groupFileFilter) {
          groupFileFilteredArray = groupFileList.filter((groupFile) => {
            if (groupFile) {
              return groupFile.name.toLowerCase().includes(groupFileFilter.toLowerCase())
                || pinyinUtil.getPinyin(groupFile.name).toLowerCase().includes(groupFileFilter.toLowerCase())
            }
          })
        } else {
          groupFileFilteredArray = groupFileList
        }
        if (groupFileFilteredArray.length > 0) {
          CollaUtil.sortByKey(groupFileFilteredArray, 'createTimestamp', 'desc')
        }
      }
      return groupFileFilteredArray
    },
    FileIconName() {
      let _that = this
      let store = _that.$store
      return function (name) {
        let iconName = 'insert_drive_file'
        if (name) {
          let arr = name.split('.')
          let suffix = arr[arr.length - 1]
          suffix = suffix.toUpperCase()
          if (suffix === 'JPG' || suffix === 'JPEG' || suffix === 'PNG' || suffix === 'BMP') {
            iconName = 'image'
          } else if (suffix === 'MP4' || suffix === 'MPG' || suffix === 'MPEG' || suffix === 'WMV' || suffix === 'MOV' || suffix === 'AVI' || suffix === 'MKV' || suffix === 'FLV') {
            iconName = 'videocam'
          } else if (suffix === 'MP3' || suffix === 'MPG' || suffix === 'MPEG' || suffix === 'WMA' || suffix === 'WAV' || suffix === 'APE') {
            iconName = 'audiotrack'
          }
        }
        return iconName
      }
    }
  },
  methods: {
    talkHeight() {
      let _that = this
      if (_that.$refs.editor) {
        let height = _that.$q.height - (_that.$refs.editor.$el.offsetHeight + 25 + 50)
        document.getElementById('talk').style.height = height + 'px'
      }
    },
    switchEmoji() {
      let _that = this
      _that.emojiShow = true
      _that.$nextTick(() => {
        let emojiDom = document.getElementById('emojiPicker')
        emojiDom.focus()
      })
    },
    emojiPickerBlur(e) {
      this.emojiShow = false
    },
    selectEmoji(emoji) {
      let _that = this
      let store = _that.$store
      let editor = _that.$refs.editor
      let emojiVal = emoji.data
      let selectionStart = editor.$refs.input?editor.$refs.input.selectionStart:null
      if (selectionStart == null) {
        selectionStart = 0
      }
      let currentText = store.state.currentChat.tempText ? store.state.currentChat.tempText : ""
      if (selectionStart == currentText.length - 1) {
        store.state.currentChat.tempText = currentText.slice(0, selectionStart) + emojiVal
      } else {
        store.state.currentChat.tempText = currentText.slice(0, selectionStart) + emojiVal + currentText.slice(selectionStart, currentText.length - 1)
      }
      _that.emojiShow = false
    },
    selectedFocusGroupMember(groupMember) {
      let _that = this
      let store = _that.$store
      let editor = _that.$refs.editor
      let alias = store.state.linkmanMap[groupMember.memberPeerId].givenName ? store.state.linkmanMap[groupMember.memberPeerId].givenName : store.state.linkmanMap[groupMember.memberPeerId].name
      let selectionStart = editor.selectionStart
      if (selectionStart == null) {
        selectionStart = 0
      }
      if (selectionStart == store.state.currentChat.tempText.length - 1) {
        store.state.currentChat.tempText = store.state.currentChat.tempText.slice(0, selectionStart) + '@' + alias + " "
      } else {
        store.state.currentChat.tempText = store.state.currentChat.tempText.slice(0, selectionStart) + '@' + alias + " " + store.state.currentChat.tempText.slice(selectionStart, store.state.currentChat.tempText.length - 1)
      }
      _that.focusGroupMemberDialog = false
    },
    async updateReadTime() {
      let _that = this
      let store = _that.$store
      store.state.currentChat.unReadCount = 0
      let unReadMessages = await chatComponent.loadMessage(
        {
          ownerPeerId: store.state.currentChat.ownerPeerId,
          subjectId: store.state.currentChat.subjectId,
          //senderPeerId: store.state.currentChat.ownerPeerId
          readTime: null
        }
      )
      if (unReadMessages && unReadMessages.length > 0) {
        for (let message of unReadMessages) {
          message.readTime = new Date().getTime()
        }
        await chatComponent.update(ChatDataType.MESSAGE, unReadMessages)
      }
    },
    async load_message(done) {
      let _that = this
      let store = _that.$store
      if (!store.state.currentChat || !store.state.currentChat.messages || store.state.currentChat.messages.length == 0) return;
      let messages = await chatComponent.loadMessage(
        {
          ownerPeerId: myself.myselfPeerClient.peerId,
          subjectId: store.state.currentChat.subjectId,
          //messageType: P2pChatMessageType.CHAT_LINKMAN,
        }, [{ _id: 'desc' }], store.state.currentChat.messages.length > 0 ? store.state.currentChat.messages[0].receiveTime : null, 10
      )
      CollaUtil.sortByKey(messages, 'receiveTime', 'asc');
      if (messages && messages.length > 0) {
        store.state.currentChat.messages = messages.concat(store.state.currentChat.messages)
      } else {
        store.state.currentChat.noMoreMessageTag = true
      }
      if (typeof done == 'function') {
        done()
      }
    },
    async capture(type) {
      let _that = this
      let store = _that.$store
      _that.captureType = type
      if (store.ios === true || store.android === true) {
        let mediaFiles = null
        if (type === 'image') {
          _that.mobileTakePhoto()
        }
        if (type === 'video') {
          mediaFiles = await mediaCaptureComponent.captureVideo()
          _that.videoUrl = mediaFiles
        }
        _that.saveChatMediaFile()
      } else if (store.chrome === true || store.safari === true) {
        store.captureMediaEntry = 'message'
        store.captureType = type
        _that.subKind = 'captureMedia'
      } else {
        console.error('Not support browser safari!')
      }
    },
    async saveChatMediaFile() {
      let _that = this
      let store = _that.$store
      let mediaUrl = null
      if (store.captureType) {
        mediaUrl = store.mediaUrl
      }
      if (!mediaUrl) {
        if (_that.captureType === 'image') {
          mediaUrl = _that.imageUrl
        } else if (_that.captureType === 'audio') {
          mediaUrl = _that.audioUrl
        } else if (_that.captureType === 'video') {
          mediaUrl = _that.videoUrl
        }
      }
      if (mediaUrl) {
        await _that._saveChatMediaFile(mediaUrl)
      }
      _that.captureType = null
      _that.imageUrl = null
      _that.audioUrl = null
      _that.videoUrl = null
    },
    async _saveChatMediaFile(url) {
      let _that = this
      let store = _that.$store
      let urls = []
      if (!TypeUtil.isArray(url)) {
        urls.push(url)
      } else {
        urls = url
      }
      let files = []
      for (let u of urls) {
        if (u) {
          let blob = null
          if ((store.ios === true || store.android === true) && (u.localURL || u.uri)) {
            let localURL = u.localURL
            if (!localURL) { // 使用mediaPicker时
              localURL = u.uri
            }
            console.log('localURL:' + localURL)
            let type = u.type
            if (!type && u.name) {
              let unameType = u.name.split('.')[1]
              if (unameType.toUpperCase() === 'JPG') {
                type = 'image/jpeg'
              } else if (unameType.toUpperCase() === 'MP4') {
                type = 'video/mp4'
              } else if (unameType.toUpperCase() === 'WAV') {
                type = 'audio/wav'
              }
            }
            if (localURL && localURL.toUpperCase().indexOf('.HEIC') > -1) {
              u.quality = 99
              u = await mediaPickerComponent.compressImage(u)
              localURL = u.uri
            }
            let fileEntry = await fileComponent.getFileEntry(localURL)
            blob = await fileComponent.readFile(fileEntry, { format: 'blob', type: type })
            if (blob.type.indexOf('audio/webm') > -1) {
              _that.audioBlobMessageHandle(blob)
            } else {
              _that.videoBlobMessageHandle(blob)
            }
          } else {
            blob = u
            if (blob.substring(0, 10) === 'data:audio') {
              _that.audioUrl = blob
              await _that.audioMessageSend();
            } else if (blob.substring(0, 10) === 'data:video') {
              _that.videoUrl = blob
              await store.saveFileAndSendMessage(store.state.currentChat, _that.videoUrl, ChatContentType.VIDEO)
            } else if (blob.substring(0, 10) === 'data:image') {
              _that.imageUrl = blob
              await store.saveFileAndSendMessage(store.state.currentChat, _that.imageUrl, ChatContentType.IMAGE)
            }
          }
        }
      }
    },
    audioBlobMessageHandle(blob) {
      let _that = this
      let store = _that.$store
      let audio = new FileReader();
      audio.onload = async function (e) {
        _that.audioUrl = e.target.result;
        await _that.audioMessageSend();
      }
      audio.readAsDataURL(blob);
    },
    async audioMessageSend() {
      let _that = this
      let store = _that.$store
      let message = {}
      message.messageType = P2pChatMessageType.CHAT_LINKMAN
      message.thumbnail = _that.audioUrl
      message.contentType = ChatContentType.VOICE
      await store.sendChatMessage(store.state.currentChat, message)
    },
    videoBlobMessageHandle(blob) {
      let _that = this
      let store = _that.$store
      let video = new FileReader();
      video.onload = async function (e) {
        _that.videoUrl = e.target.result;
        _that.videoUrl = mediaComponent.fixVideoUrl(_that.videoUrl)
        await _that.videoMessageSend();
      }
      video.readAsDataURL(blob);
    },
    async videoMessageSend() {
      let _that = this
      let store = _that.$store
      let fileData = _that.videoUrl
      await store.saveFileAndSendMessage(store.state.currentChat, fileData, ChatContentType.VIDEO, null)
    },
    async reverseCamera() {
      let _that = this
      let store = _that.$store
      let currentChat = store.state.currentChat
      let mediaProperty = currentChat.mediaProperty
      if (mediaProperty.options.video === true || (mediaProperty.options.video.facingMode && mediaProperty.options.video.facingMode === 'user')) {
        mediaProperty.options.video = { facingMode: { exact: "environment" } }
      } else {
        mediaProperty.options.video = { facingMode: "user" }
      }
      let targetPeerIdArray = []
      if (currentChat.subjectType === SubjectType.CHAT) {
        targetPeerIdArray.push(currentChat.subjectId)
      } else if (currentChat.subjectType === SubjectType.GROUP_CHAT) {
        for (let peerId of mediaProperty.queue) {
          if (peerId !== currentChat.ownerPeerId) {
            targetPeerIdArray.push(peerId)
          }
        }
      }
      let stream = await mediaStreamComponent.openUserMedia(mediaProperty.options);
      let videoTrack = stream.getVideoTracks()[0];
      for (let peerId of targetPeerIdArray) {
        let PCsItem
        // let PCsItem = webrtcComponent.peerConnections[peerId]

        PCsItem.forEach(function (pc) {
          let sender = pc.getSenders().find(function (s) {
            return s.track.kind == videoTrack.kind;
          });
          console.log('found sender:', sender);
          sender.replaceTrack(videoTrack);
        });
      }
    },
    groupMediaSelect() {
      let linkmans = this.$store.state.linkmans // 实际选择的不是GroupChatMember，而是对应的linkman
      if (linkmans && linkmans.length > 0) {
        for (let linkman of linkmans) {
          linkman.selected = false
          linkman.existing = false
        }
      }
      this.selectedGroupChatMembers = []
      this.selectedGroupChatMemberPeerId = null
      this.selectGroupChatMemberFlag = 'selectedGroupCallMember'
      this.subKind = 'selectGroupChatMember'
    },
    startMediaTimer() {
      let _that = this
      _that.mediaTimer = CollaUtil.timerInterval(_that.$refs.mediaTimer)
    },
    async getMessageFile(message) {
      let _that = this
      let store = _that.$store
      let fileData = chatComponent.localFileDataMap[message.attachBlockId]
      if (!fileData) {
        let localAttachs
        localAttachs = await chatBlockComponent.loadLocalAttach(message.attachBlockId)
        if (localAttachs && localAttachs.length > 0) {
          fileData = localAttachs[0].content
        } else {
          message.loading = true
          // 指定connectPeerId以优化速度
          let connectPeerId = message.connectPeerId
          let block = await dataBlockService.findTxPayload(connectPeerId, message.attachBlockId)
          if (block && block.length > 0 && block[0]) {
            if (block[0].attachs && block[0].attachs.length > 0) {
              let attach = block[0].attachs[0]
              if (attach) {
                fileData = attach.content
                if (!message.messageId) { // 群共享接收方创建message
                  message.ownerPeerId = myself.myselfPeerClient.peerId
                  message.messageId = UUID.string(null, null)
                  message.messageType = P2pChatMessageType.GROUP_FILE
                  message.fileSize = StringUtil.getSize(fileData)
                  message.contentType = attach.contentType
                  message.connectPeerId = null
                  if (attach.contentType === ChatContentType.IMAGE) {
                    message.thumbnail = await mediaComponent.compressImage(fileData)
                  } else if (attach.contentType === ChatContentType.VIDEO) {
                    message.thumbnail = await mediaComponent.createVideoThumbnailByBase64(fileData)
                  }
                  await chatComponent.insert(ChatDataType.MESSAGE, message, null)
                }
                attach.ownerPeerId = myself.myselfPeerClient.peerId
                await chatBlockComponent.saveLocalAttach({ attachs: [attach] })
                if (message.contentType === ChatContentType.VIDEO) {
                  fileData = mediaComponent.fixVideoUrl(fileData)
                }
                if (attach.originalMessageId) {
                  message.fileoriginalMessageId = attach.originalMessageId
                }
              }
            }
          }
          message.loading = false
        }
        chatComponent.localFileDataMap[message.attachBlockId] = fileData
      }
      if (!fileData) {
        _that.$q.notify({
          message: _that.$i18n.t("This file has expired"),
          timeout: 3000,
          type: "warning",
          color: "warning",
        })
      }
      return fileData
    },
    async getMessageFileAndOpen(message) {
      let _that = this
      let store = _that.$store
      let fileData = await store.getMessageFile(message)
      if (message.contentType === ChatContentType.IMAGE) {
        store.state.imageMessageSrc = fileData
        _that.$nextTick(() => {
          store.state.imageMessageViewDialog = true
          _that.$nextTick(() => {
            if (store.ifMobile()) {
              setTimeout(function () {
                var img = new Image()
                img.src = store.state.imageMessageSrc
                console.log('img.width: ' + img.width + ', img.height: ' + img.height)
                let selectedContainer = document.getElementById('dialog-image-container')
                let canvas = document.getElementById('dialog-image-canvas')
                let ctx = canvas.getContext('2d')
                canvas.width = _that.ifMobileSize || store.state.ifMobileStyle ? _that.$q.screen.width : (img.width > selectedContainer.clientWidth ? selectedContainer.clientWidth : img.width)
                canvas.height = canvas.width * img.height / img.width
                ctx.clearRect(0, 0, canvas.width, canvas.height)
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                let selectedImg = document.querySelector('#dialog-image')
                selectedImg.src = canvas.toDataURL('image/png', 1.0)
                let marginTop = 0
                marginTop = (store.screenHeight - canvas.height) / 2 // 不使用_that.$q.screen.height，避免键盘弹出时的影响
                marginTop = marginTop < 0 ? 0 : marginTop
                console.log('$q.screen.Height:' + _that.$q.screen.height + ',canvas.width:' + canvas.width + ',canvas.height:' + canvas.height + ',marginTop:' + marginTop)
                selectedImg.style.cssText += 'margin-top: ' + marginTop + 'px'
                alloyFingerComponent.initImage('#dialog-image')
                alloyFingerComponent.initLongSingleTap('#dialog-image-container', _that.mediaHold, _that.fullscreenBack)
              }, 0)
            }
          })
        })
      } else if (message.contentType === ChatContentType.AUDIO) {
        store.state.audioRecordMessageSrc = fileData
        _that.$nextTick(() => {
          store.state.audioRecordMessageViewDialog = true
        })
      } else if (message.contentType === ChatContentType.VIDEO) {

        if (window.device && window.device.platform === 'iOS' && fileData.indexOf('data:video/webm;base64,') > -1) {
          _that.$q.notify({
            message: _that.$i18n.t("Can not play this video"),
            timeout: 3000,
            type: "warning",
            color: "warning",
          })
        } else {
          store.state.videoRecordMessageSrc = fileData
          _that.$nextTick(() => {
            store.state.videoRecordMessageViewDialog = true
          })
        }
      }
      else if (message.contentType === ChatContentType.FILE) {
        let filename = message.content
        if (store.ios === true || store.android === true) {
          let storageLocation = ''
          if (window.device) {
            if (window.device.platform === 'Android') {
              storageLocation = 'file:///storage/emulated/0/'
            } else if (window.device.platform === 'iOS') {
              storageLocation = cordova.file.documentsDirectory //cordova.file.applicationStorageDirectory, dataDirectory
            }
          }
          console.log('storageLocation:' + storageLocation)
          let dirEntry = await fileComponent.getDirEntry(storageLocation)
          await fileComponent.createDirectory(dirEntry, 'Colla')
          let dirPath = storageLocation + 'Colla/'
          let fileEntry = await fileComponent.createNewFileEntry(filename, dirPath)
          fileComponent.writeFile(fileEntry, BlobUtil.base64ToBlob(fileData), false).then(function () {
            _that.$q.notify({
              message: "save success",
              timeout: 3000,
              type: "info",
              color: "info",
            })
          }).catch(function (err) {
            console.error(JSON.stringify(err))
            _that.$q.notify({
              message: "save failure",
              timeout: 3000,
              type: "warning",
              color: "warning",
            })
          })
        } else {
          let hyperlink = document.createElement("a"),
            mouseEvent = new MouseEvent('click', {
              view: window,
              bubbles: true,
              cancelable: true
            });
          hyperlink.href = fileData;
          hyperlink.target = '_blank';
          hyperlink.download = message.content;
          hyperlink.dispatchEvent(mouseEvent);
          (window.URL || window.webkitURL).revokeObjectURL(hyperlink.href);
        }
      }
    },
    fullscreenBack() {
      let _that = this
      let bottomSheet = document.getElementsByClassName('q-bottom-sheet')
      if (!bottomSheet || !bottomSheet[0] || bottomSheet[0].style.display === 'none') { // 排除longTap触发的singleTapCallback
        store.state.imageMessageViewDialog = false
      }
    },
    async uploadMessageFile(file) {
      let _that = this
      let store = _that.$store
      let peerId = store.state.currentChat.subjectId
      if (file.size > 2097152*100) { // 2M
          _that.$q.notify({
            message: `${_that.$i18n.t("Upload file cannot exceed")} 200M`,
            timeout: 3000,
            type: "warning",
            color: "warning",
          })
          _that.$refs.messageUpload.reset()
          return
      }
      let fileType
      if (file.name) {
        let index = file.name.lastIndexOf(".")
        fileType = file.name.substr(index + 1)
      }
      let fileData = await BlobUtil.fileObjectToBase64(file)
      
      let type, name, fileSize;
      if (mediaComponent.isAssetTypeAnImage(fileType)) {
       
        type = ChatContentType.IMAGE
      } else if (mediaComponent.isAssetTypeAVideo(fileType)) {
        type = ChatContentType.VIDEO
      } else if (mediaComponent.isAssetTypeAnAudio(fileType)) {
        type = ChatContentType.AUDIO
      } else {
        type = ChatContentType.FILE
      }
      name = file.name
      fileSize = file.size
      await store.saveFileAndSendMessage(store.state.currentChat, fileData, type, name)
    },
    async uploadMessageFilePC(file) {
      let _that = this
      let store = _that.$store
      if (file) {
        await _that.uploadMessageFile(file)
      }
      _that.$refs.messageUpload.reset()
    },
    uploadMessageFileMobile(file) {
      let _that = this
      let store = _that.$store
      _that.$nextTick(async () => {
        let messageUpload = document.getElementById('messageUpload')
        if (messageUpload && messageUpload.files) {
          let file = messageUpload.files[0]
          if (file) {
            await _that.uploadMessageFile(file)
          }
          let form = document.getElementById('messageUploadForm')
          if (form) {
            form.reset()
          }
        }
      })
    },
    uploadMobileMessageImage: async function () {
      let _that = this
      let store = _that.$store
      let medias = await mediaPickerComponent.getMedias()
      if (medias && medias.length > 0) {
        for (let i = 0; i < medias.length; i++) {
          let media = medias[i]
          let type;
          MediaPicker.fileToBlob(media.path, async function (data) {
            let blob, fileData;
            if (media.mediaType === 'image') {
              blob = new Blob([data], { "type": "image/jpeg" });
              type = ChatContentType.IMAGE
            } else {
              blob = new Blob([data], { "type": "video/mp4" });
              type = ChatContentType.VIDEO
            }
            let fileReader = new FileReader();
            fileReader.onload = async function (e) {
              fileData = e.target.result;
              await store.saveFileAndSendMessage(store.state.currentChat, fileData, type)
            }
            fileReader.readAsDataURL(blob);
          }, function (e) { console.log(e) });
        }
      }
    },
    mobileTakePhoto() {
      let _that = this
      let store = _that.$store
      let peerId = store.state.currentChat.subjectId
      let message = {}
      message.messageId = UUID.string(null, null)
      message.messageType = P2pChatMessageType.CHAT_LINKMAN
      let params = null //{ targetHeight: 256, targetWidth: 256 }
      cameraComponent.getPicture(Camera.PictureSourceType.CAMERA, params).then(async function (imageUri) {
        let fileData = "data:image/jpeg;base64," + imageUri
        await store.saveFileAndSendMessage(store.state.currentChat, fileData, ChatContentType.IMAGE)
      })
    },
    async preSend() {
      let _that = this
      let store = _that.$store
      let editor = _that.$refs.editor
      let editorContent = store.state.currentChat.tempText
      if (!editorContent || _that.sending) {
        store.state.currentChat.tempText = ''
        setTimeout(function () {
          _that.sending = false
        }, 100)
        return;
      }
      _that.sending = true
      editorContent = editorContent.replace(/^\s*|\s*$/g, "");
      if (!editorContent) {
        store.state.currentChat.tempText = ''
        return;
      }
      let message = {
        content: editorContent,
        contentType: ChatContentType.TEXT,
        messageType: P2pChatMessageType.CHAT_LINKMAN
      }
      store.state.currentChat.tempText = ''
      _that.sending = false
      editor.focus();
      store.sendChatMessage(store.state.currentChat, message)
      _that.$nextTick(() => {
        let container = document.getElementById('talk')
        if (container) {
          setTimeout(function () {
            container.scrollTop = container.scrollHeight
          }, 100)
        }
      })
      
    },
    async recallMessage(message, index) {
      let _that = this
      let store = _that.$store
      let currentChat = store.state.currentChat
      message.status = ChatMessageStatus.RECALL
      let curr_message = await chatComponent.get(ChatDataType.MESSAGE, message._id)
      curr_message.status = message.status
      await chatComponent.update(ChatDataType.MESSAGE, curr_message, null)
      let _message = {
        messageType: P2pChatMessageType.RECALL,
        preSubjectType: message.subjectType,
        preSubjectId: message.subjectId,
        preMessageId: message.messageId,
      }
      //撤回的是最新的消息
      if (currentChat.messages[currentChat.messages.length - 1]._id === message._id) {
        currentChat.content = `[${_that.$i18n.t("This message has been recalled")}]`
        let db_chat = await chatComponent.get(ChatDataType.CHAT, currentChat._id)
        db_chat.content = currentChat.content
        await chatComponent.update(ChatDataType.CHAT, db_chat)
      }
      await store.sendChatMessage(currentChat, _message)
    },
    async deleteMessage(message, index) {
      let _that = this
      let store = _that.$store
      //store.commit('increment',10+Math.random())
      let chat = store.state.chatMap[message.subjectId]
      let messages = chat.messages
      message = await chatComponent.get(ChatDataType.MESSAGE, message._id)
      await chatComponent.remove(ChatDataType.MESSAGE, message, messages)
      let message_last = messages[messages.length - 1]
      if (message_last && message_last.contentType === ChatContentType.TIME) {
        message_last = await chatComponent.get(ChatDataType.MESSAGE, message_last._id)
        await chatComponent.remove(ChatDataType.MESSAGE, message_last, messages)
      }
    },
    forwardMessage(message) {
      this.$store.forwardMessage = message
      for (let chat of this.$store.state.chats) {
        chat.selected = false
      }
      this.$store.selectChatEntry = 'messageForward'
      this.subKind = 'selectChat'
    },
    async forwardToChat(chat) {
      let _that = this
      let store = _that.$store
      let forwardMessage = store.forwardMessage
      if (!Array.isArray(forwardMessage)) {
        let message = {}
        message.messageId = UUID.string(null, null)
        message.messageType = P2pChatMessageType.CHAT_LINKMAN
        let mergeMessages = await _that.insertMergeMessage(message.messageId)
        let firstMergeMessage = mergeMessages[0]
        message.contentType = ChatContentType.CHAT
        message.content = store.getChatContent(firstMergeMessage.contentType, firstMergeMessage.content)
        message.title = firstMergeMessage.mergeName
        message.mergeMessages = mergeMessages
        for (let mergeMessage of mergeMessages) {
          mergeMessage.mergeMessageId = message.messageId
          mergeMessage.topMessageId = message.messageId
          if (mergeMessage.contentType === ChatContentType.CHAT) {
            await _that.recursiveMergeMessages(chat, mergeMessage)
          }
          if ((message.contentType === ChatContentType.VIDEO || message.contentType === ChatContentType.FILE || message.contentType === ChatContentType.IMAGE)) {
            let fileData = await store.getMessageFile(mergeMessage)
            await store.saveFileInMessage(chat, message, fileData, message.contentType, null, mergeMessage.fileoriginalMessageId)
          }
        }
        await store.sendChatMessage(chat, message)
      } else {

        for (let singleMessage of forwardMessage) {
          let message = {}
          message.messageId = UUID.string(null, null)
          message.messageType = P2pChatMessageType.CHAT_LINKMAN
          message.contentType = singleMessage.contentType
          message.content = singleMessage.content
          message.title = singleMessage.title

          await store.sendChatMessage(chat, message)
        }

      }
      if (store.selectChatEntry === 'messageForward') {
        store.changeMessageSubKind('default')
      }
    },
    async recursiveMergeMessages(chat, message) {//mergeMessage
      let _that = this
      let store = _that.$store
      let mergeMessages
      if (message.mergeMessages && message.mergeMessages.length > 0) {
        mergeMessages = message.mergeMessages
      } else {
        let mergeMessages = await chatComponent.loadMergeMessage(
          {
            mergeMessageId: message.messageId
          }, null, null)
        message.mergeMessages = mergeMessages
      }
      for (let mergeMessage of message.mergeMessages) {
        let fileData
        if (message.contentType === ChatContentType.VIDEO || message.contentType === ChatContentType.FILE || message.contentType === ChatContentType.IMAGE) {
          fileData = await store.getMessageFile(mergeMessage)
        }
        mergeMessage.mergeMessageId = message.messageId
        mergeMessage.topMessageId = message.topMessageId
        if (mergeMessage.contentType === message.contentType === ChatContentType.CHAT) {
          await _that.recursiveMergeMessages(message)
        } else if (message.contentType === ChatContentType.VIDEO || message.contentType === ChatContentType.FILE || message.contentType === ChatContentType.IMAGE) {
          await store.saveFileInMessage(chat, message, fileData, message.contentType, null, mergeMessage.fileoriginalMessageId)
        }
      }
    },
    openMessageMultiSelect() {
      let _that = this
      _that.messageMultiSelectedVal = []
      _that.messageMultiSelectMode = true
    },
    async multiForwardMessage(type) {
      let _that = this
      let store = _that.$store
      let messageMultiSelectedVal = _that.messageMultiSelectedVal
      if (messageMultiSelectedVal.length === 0) return
      if (type === 'single') {//逐条转发
        _that.forwardMessage(messageMultiSelectedVal)
      } else {//合并转发
        _that.forwardMessage({})
      }
      _that.messageMultiSelectMode = false
    },
    cancelMessageMultiSelect() {
      let _that = this
      _that.messageMultiSelectMode = false
      _that.messageMultiSelectedVal = []
    },
    async insertMergeMessage(messageId) {
      let _that = this
      let store = _that.$store
      let chat = store.state.currentChat
      let forwardMessage = _that.messageMultiSelectedVal
      let mergeMessages = []
      let mergeMessageId = messageId
      for (let message of forwardMessage) {
        let mergeMessage = {
          mergeMessageId: mergeMessageId,
          ownerPeerId: myself.myselfPeerClient.peerId,
          mergeName: myself.myselfPeerClient.name,
          messageId: message.messageId,
          subjectType: message.messageType,
          subjectId: message.subjectId,
          content: message.content,
          title: message.title,
          thumbnail: message.thumbnail,
          avatar: _that.MessageAvatar(message),
          senderPeerId: message.senderPeerId,
          name: _that.MessageName(message),
          contentType: message.contentType,
          messageType: message.messageType,
          messageCreateTime: message.createTime,
          createTime: new Date().getTime(),
          chatName: _that.ChatTitle(chat),
          blockId: message.attachBlockId,
          mergeMessages: message.mergeMessages
        }
        mergeMessages.push(mergeMessage)
        //attach
      }
      await chatComponent.insert(ChatDataType.MERGEMESSAGE, mergeMessages, null)
      return mergeMessages
    },
    async receiveMergeMessage(message) {
      let _that = this
      let store = _that.$store
      let _mergeMessages = message.mergeMessages
      for (let _mergeMessage of _mergeMessages) {
        delete _mergeMessage.id
        delete _mergeMessage.rev
        _mergeMessage.ownerPeerId = myself.myselfPeerClient.peerId
      }
      await chatComponent.insert(ChatDataType.MERGEMESSAGE, _mergeMessages, null)
    },
    async multiCollectionMessage() {
      let _that = this
      let store = _that.$store
      let chat = store.state.currentChat
      let messageMultiSelectedVal = _that.messageMultiSelectedVal
      if (messageMultiSelectedVal.length === 0) return
      let messageId = UUID.string(null, null)
      let mergeMessages = await _that.insertMergeMessage(messageId)
      let firstMergeMessage = mergeMessages[0]
      let message = {
        subjectId: chat.subjectId,
        senderPeerId: chat.subjectId,
        messageType: P2pChatMessageType.CHAT_LINKMAN,
        contentType: ChatContentType.CHAT,
        content: JSON.stringify(mergeMessages),
        title: firstMergeMessage.mergeName
      }
      await _that.collectMessage(message)
    },
    async collectMessage(message, index) {
      let _that = this
      let store = _that.$store
      if (message.contentType === ChatContentType.CARD) {
        _that.messageMultiSelectedVal = [message]
        await _that.multiCollectionMessage()
        return
      }
      try {
        let chat = store.state.chatMap[message.subjectId]
        let inserted = {
          blockId: UUID.string(null, null),
          state: EntityState.New,
          ownerPeerId: myself.myselfPeerClient.peerId,
          srcChannelType: chat.subjectType,
          srcChannelId: chat.subjectId,
          srcChannelName: store.getChatName(chat.subjectType, chat.subjectId),
          srcEntityType: SrcEntityType.LINKMAN,
          srcEntityId: message.senderPeerId,
          srcEntityName: _that.getSrcEntityName(message.senderPeerId),
          attachs: [],
          contentTitle: message.title ? message.title : '',
          contentBody: '',
          firstFileInfo: '',
          firstAudioDuration: '',
          contentIVAmount: 0,
          contentAAmount: 0,
          attachIVAmount: 0,
          attachAAmount: 0,
          attachOAmount: 0,
          attachAmount: 0
        }
        let content = null
        if (message.contentType === ChatContentType.TEXT || message.contentType === ChatContentType.CHAT || message.contentType === ChatContentType.NOTE) {
          inserted.collectionType = CollectionType.TEXT
          if (message.contentType === ChatContentType.TEXT) {
            inserted.collectionType = CollectionType.TEXT
          } else if (message.contentType === ChatContentType.NOTE) {
            inserted.collectionType = CollectionType.NOTE
          }
          else if (message.contentType === ChatContentType.CHAT) {
            if(_that.messageMultiSelectedVal.length === 1 && _that.messageMultiSelectedVal[0].contentType ===  ChatContentType.CARD){
              inserted.collectionType = CollectionType.CARD
            }else{
              inserted.collectionType = CollectionType.CHAT
            }
            
          }
          content = message.content
        } else {
          if (message.contentType === ChatContentType.IMAGE) {
            inserted.collectionType = CollectionType.IMAGE
          } else if (message.contentType === ChatContentType.VIDEO) {
            inserted.collectionType = CollectionType.VIDEO
          } else if (message.contentType === ChatContentType.AUDIO) {
            inserted.collectionType = CollectionType.AUDIO
          }  
          else if (message.contentType === ChatContentType.VOICE) {
            inserted.collectionType = CollectionType.VOICE
          } else if (message.contentType === ChatContentType.FILE) {
            inserted.attachOAmount = 1
            inserted.firstFileInfo = `(${message.fileSize}) ${message.content}`
            inserted.collectionType = CollectionType.FILE
          }
          if (message.contentType === ChatContentType.VOICE) {
            inserted.attachAAmount = 1
            inserted.content = message.thumbnail
          } else {
            let attaches = await chatBlockComponent.loadLocalAttach(message.attachBlockId)
            if (attaches && attaches.length > 0) {
              let file = attaches[0].content
              if (file) {
                content = file
              }
            }
          }
        }
        if (message.contentType !== ChatContentType.VOICE) {
          console.log('collectMessage-content:' + content)
          let files = []
          if (content) {
            files.push(content)
          }
          inserted.content = message.contentType !== ChatContentType.FILE ? await collectionUtil.getInsertHtml(files) : content
        }
        await collectionUtil.save('collection', inserted)
        // 云端cloud保存
        if (store.collectionWorkerEnabler) {
          /*let dbLogs = await collectionUtil.saveBlock(inserted, false, BlockType.Collection)
          let options = {}
          options.privateKey = myself.privateKey
          openpgp.clonePackets(options)
          let worker = _that.initCollectionUploadWorker()
          worker.postMessage(['one', dbLogs, myself.myselfPeerClient, options.privateKey])*/
        } else {
          let dbLogs = await collectionUtil.saveBlock(inserted, true, BlockType.Collection)
          // 刷新syncFailed标志
          let newDbLogMap = CollaUtil.clone(store.state.dbLogMap)
          if (dbLogs && dbLogs.length > 0) {
            for (let dbLog of dbLogs) {
              let dl = newDbLogMap[dbLog.blockId]
              if (!dl) {
                newDbLogMap[dbLog.blockId] = true
                console.log('add dbLog, blockId:' + dbLog.blockId)
              }
            }
          }
          store.state.dbLogMap = newDbLogMap
        }
        _that.$q.notify({
          message: _that.$i18n.t("Save Collection successfully"),
          timeout: 3000,
          type: "info",
          color: "info",
        })
      } catch (error) {
        console.error(error)
        _that.$q.notify({
          message: _that.$i18n.t("Save failed"),
          timeout: 3000,
          type: "warning",
          color: "warning"
        })
      }
    },
    getSrcEntityName(senderPeerId) {
      let _that = this
      let store = _that.$store
      if (senderPeerId === myself.myselfPeerClient.peerId) {
        return myself.myselfPeerClient.name
      } else if (store.state.linkmanMap[senderPeerId]) {
        return store.state.linkmanMap[senderPeerId].givenName ? store.state.linkmanMap[senderPeerId].givenName : store.state.linkmanMap[senderPeerId].name
      }
    },
    copyMessage(message, index) {
      let _that = this
      var aux = document.createElement("input");
      aux.setAttribute("value", message.content.replace(/<[^>]*>|/g, ""));
      document.body.appendChild(aux);
      aux.select();
      document.execCommand("copy");
      document.body.removeChild(aux);
      _that.$q.notify({
        message: _that.$i18n.t("Copy successfully"),
        timeout: 3000,
        type: "info",
        color: "info",
      })
    },
    quoteMessage(message, index) {
      let _that = this
      let store = _that.$store
      let messageText = `「 ${store.state.linkmanMap[message.senderPeerId].name}:${message.content} 」 - - - - - - - - - - - - - -\n`
      _that.$forceUpdate()
      store.state.currentChat.tempText = messageText

      _that.$refs.editor.focus()
    },
    //已不在接收已读回执
    async handleReadCallback(mes) {
      let _that = this
      let store = _that.$store
      if (store.state.chatMap[mes.senderPeerId]) {
        let messages = store.state.chatMap[mes.senderPeerId].messages
        if (messages && messages.length > 0) {
          for (let i = messages.length; i--; i > -1) {
            let currentMes = messages[i]
            if (currentMes.messageId === mes.messageId) {
              currentMes.readTime = mes.readTime
              console.log(JSON.stringify(currentMes))
              await chatComponent.update(ChatDataType.MESSAGE, currentMes, messages)
              console.log(JSON.stringify(currentMes))
              //count down
              currentMes.countDown = currentMes.destroyTime / 1000
              let countDownInterval = setInterval(async function () {
                if (!currentMes.countDown) {
                  clearInterval(countDownInterval)
                  console.log(JSON.stringify(currentMes))
                  await chatComponent.remove(ChatDataType.MESSAGE, currentMes, messages)
                  return;
                }
                currentMes.countDown--;
                console.log(currentMes.countDown)
              }, 1000)
            }
          }
        }
      }
    },
    // group chat ///////////////////////////////////////////////////////////////////////////////////
    showModifyGroupChat() {
      let _that = this
      let store = _that.$store
      let currentChat = store.state.currentChat
      if (currentChat) {
        let groupChat = store.state.groupChatMap[currentChat.subjectId]
        if (groupChat) {
          _that.groupChatData = {
            name: groupChat.name,
            description: groupChat.description,
            givenName: groupChat.givenName,
            tag: groupChat.tag,
            myAlias: groupChat.myAlias
          }
          _that.subKind = "modifyGroupChat"
        }
      }
    },
    async modifyGroupChat() {
      let _that = this
      let store = _that.$store
      let myselfPeerClient = myself.myselfPeerClient
      let groupChat = store.state.groupChatMap[store.state.currentChat.subjectId]

      // 修改群组信息
      let nameChanged = false
      if (groupChat.name !== _that.groupChatData.name) {
        nameChanged = true
      }
      let descriptionChanged = false
      if (groupChat.description !== _that.groupChatData.description) {
        descriptionChanged = true
      }
      let myAliasChanged = false
      if (groupChat.myAlias !== _that.groupChatData.myAlias) {
        myAliasChanged = true
      }
      groupChat.name = _that.groupChatData.name
      groupChat.pyName = pinyinUtil.getPinyin(_that.groupChatData.name)
      groupChat.description = _that.groupChatData.description
      groupChat.pyDescription = pinyinUtil.getPinyin(_that.groupChatData.description)
      groupChat.givenName = _that.groupChatData.givenName
      groupChat.pyGivenName = pinyinUtil.getPinyin(_that.groupChatData.givenName)
      groupChat.tag = _that.groupChatData.tag
      groupChat.pyTag = pinyinUtil.getPinyin(_that.groupChatData.tag)
      groupChat.myAlias = _that.groupChatData.myAlias
      store.state.groupChatMap[groupChat.groupId] = groupChat
      let groupChatRecord = await contactComponent.get(ContactDataType.GROUP, groupChat._id)
      if (groupChatRecord) {
        groupChatRecord.name = groupChat.name
        groupChatRecord.pyName = groupChat.pyName
        groupChatRecord.description = groupChat.description
        groupChatRecord.pyDescription = groupChat.pyDescription
        groupChatRecord.givenName = groupChat.givenName
        groupChatRecord.pyGivenName = groupChat.pyGivenName
        groupChatRecord.tag = groupChat.tag
        groupChatRecord.pyTag = groupChat.pyTag
        groupChatRecord.myAlias = groupChat.myAlias
        groupChatRecord.recallTimeLimit = groupChat.recallTimeLimit
        groupChatRecord.recallAlert = groupChat.recallAlert
        await contactComponent.update(ContactDataType.GROUP, groupChatRecord)
      }

      // 修改我在本群的昵称
      let myselfGroupMember
      let memberAliasChanged = false
      let groupMembers = groupChat.groupMembers
      for (let groupMember of groupMembers) {
        if (groupMember.memberPeerId === myselfPeerClient.peerId) {
          if (groupMember.memberAlias !== groupChat.myAlias) {
            memberAliasChanged = true
            groupMember.memberAlias = groupChat.myAlias
          }
          myselfGroupMember = groupMember
        }
      }
      if (memberAliasChanged) {
        let groupMemberRecord = await contactComponent.get(ContactDataType.GROUP_MEMBER, myselfGroupMember._id)
        if (groupMemberRecord) {
          groupMemberRecord.memberAlias = groupChat.myAlias
          await contactComponent.update(ContactDataType.GROUP_MEMBER, groupMemberRecord)
        }
      }
      groupChat.groupMembers = groupMembers
      store.state.groupChatMap[groupChat.groupId] = groupChat

      // 新增Sent请求
      if (nameChanged || descriptionChanged || myAliasChanged) {
        await _that.sendGroupInfo()
      }

      if (nameChanged || descriptionChanged) {
        let chat = await store.getChat(groupChat.groupId)
        let chatMessage = {
          messageType: P2pChatMessageType.CHAT_SYS,
          contentType: ChatContentType.EVENT,
          content: _that.$i18n.t("You") + _that.$i18n.t(" have modified ") + (nameChanged ? (descriptionChanged ? _that.$i18n.t("Group Name to be : ") + groupChat.name + _that.$i18n.t(",") + _that.$i18n.t(" modified ") + _that.$i18n.t("Group Description to be : ") + groupChat.description : _that.$i18n.t("Group Name to be : ") + groupChat.name) : _that.$i18n.t("Group Description to be : ") + groupChat.description)
        }
        await store.addCHATSYSMessage(chat, chatMessage)
      }

      _that.subKind = "default"
    },
    async sendGroupInfo() {
      let _that = this
      let store = _that.$store
      let currentTime = new Date()
      let myselfPeerClient = myself.myselfPeerClient
      let groupChat = store.state.groupChatMap[store.state.currentChat.subjectId]
      let linkmanRequest = {}
      linkmanRequest.requestType = RequestType.MODIFY_GROUPCHAT
      linkmanRequest.ownerPeerId = myselfPeerClient.peerId
      linkmanRequest.senderPeerId = myselfPeerClient.peerId
      //linkmanRequest.data = JSON.stringify(groupMembers) // 数据库为JSON格式
      linkmanRequest.groupId = groupChat.groupId
      //linkmanRequest.groupCreateDate = groupChat.createDate
      linkmanRequest.groupName = groupChat.name
      linkmanRequest.groupDescription = groupChat.description
      linkmanRequest.myAlias = groupChat.myAlias
      linkmanRequest.recallTimeLimit = groupChat.recallTimeLimit
      linkmanRequest.recallAlert = groupChat.recallAlert
      linkmanRequest.createDate = currentTime
      linkmanRequest.status = RequestStatus.SENT
      console.log(linkmanRequest)
      await contactComponent.insert(ContactDataType.LINKMAN_REQUEST, linkmanRequest, null)

      // 保存/发送Sent请求
      let message = {
        subjectType: SubjectType.LINKMAN_REQUEST,
        messageType: P2pChatMessageType.MODIFY_GROUPCHAT,
        content: linkmanRequest
      }
      let groupChatLinkmans = []
      for (let groupMember of groupChat.groupMembers) {
        let linkman = store.state.linkmanMap[groupMember.memberPeerId]
        if (linkman && linkman.peerId !== myselfPeerClient.peerId) { // 自己和非联系人除外
          groupChatLinkmans.push(store.state.linkmanMap[groupMember.memberPeerId])
        }
      }
      for (let groupChatLinkman of groupChatLinkmans) {
        await store.saveAndSendMessage(message, groupChatLinkman)
      }
    },
    confirmRemoveChat() {
      let _that = this
      _that.$q.bottomSheet({
        message: _that.$i18n.t('Remove this chat (together with chat records)?'),
        actions: [
          {},
          {
            label: _that.$i18n.t('Confirm'),
            classes: 'text-red',
            icon: 'check_circle',
            color: 'primary',
            id: 'confirm'
          },
          {},
          {
            label: _that.$i18n.t('Cancel'),
            icon: 'cancel',
            color: 'primary',
            id: 'cancel'
          }
        ]
      }).onOk(async action => {
        // console.log('Action chosen:', action.id)
        if (action.id === 'confirm') {
          await _that.removeChat()
        }
      }).onCancel(() => {
        // console.log('Dismissed')
      }).onDismiss(() => {
        // console.log('I am triggered on both OK and Cancel')
      })
    },
    async removeChat() {
      let _that = this
      let store = _that.$store
      let myselfPeerClient = myself.myselfPeerClient
      let currentChatPeerId = store.state.currentChat.subjectId

      // 删除聊天记录
      let messages = await chatComponent.loadMessage({
        ownerPeerId: myselfPeerClient.peerId,
        subjectId: currentChatPeerId
      })
      if (messages && messages.length > 0) {
        await chatComponent.remove(ChatDataType.MESSAGE, messages)
      }
      let chat = store.state.chatMap[currentChatPeerId]
      chat = await chatComponent.get(ChatDataType.CHAT, chat._id)
      if (chat) {
        await chatComponent.remove(ChatDataType.CHAT, chat, store.state.chats)
      }
      delete store.state.chatMap[currentChatPeerId]
      store.state.currentChat = null
      if (store.state.ifMobileStyle) {
        store.toggleDrawer(false)
      }
      _that.subKind = "default"
    },
    confirmRemoveGroupChat() {
      let _that = this
      let store = _that.$store
      let myselfPeerClient = myself.myselfPeerClient
      let groupChat = store.state.groupChatMap[store.state.currentChat.subjectId]
      let groupMembers = groupChat.groupMembers
      let remainingLinkmanCount = 0
      for (let groupMember of groupMembers) {
        let linkman = store.state.linkmanMap[groupMember.memberPeerId]
        if (linkman) {
          remainingLinkmanCount++
        }
      }
      if (groupChat.groupOwnerPeerId === myselfPeerClient.peerId && remainingLinkmanCount > 1) {
        _that.$q.notify({
          message: _that.$i18n.t("Please handover your ownership first!"),
          timeout: 3000,
          type: "info",
          color: "info",
        })
        return
      }
      _that.$q.bottomSheet({
        message: _that.$i18n.t('Remove this group chat (together with chat records)?'),
        actions: [
          {},
          {
            label: _that.$i18n.t('Confirm'),
            classes: 'text-red',
            icon: 'check_circle',
            color: 'primary',
            id: 'confirm'
          },
          {},
          {
            label: _that.$i18n.t('Cancel'),
            icon: 'cancel',
            color: 'primary',
            id: 'cancel'
          }
        ]
      }).onOk(async action => {
        // console.log('Action chosen:', action.id)
        if (action.id === 'confirm') {
          await _that.removeGroupChat()
        }
      }).onCancel(() => {
        // console.log('Dismissed')
      }).onDismiss(() => {
        // console.log('I am triggered on both OK and Cancel')
      })
    },
    async removeGroupChat() {
      let _that = this
      let store = _that.$store
      let myselfPeerClient = myself.myselfPeerClient
      let currentGroupChatGroupId = store.state.groupChatMap[store.state.currentChat.subjectId].groupId
      let groupMembers = store.state.groupChatMap[store.state.currentChat.subjectId].groupMembers
      let currentTime = new Date()

      // 删除聊天记录
      let messages = await chatComponent.loadMessage({
        ownerPeerId: myselfPeerClient.peerId,
        subjectId: currentGroupChatGroupId
      })
      if (messages && messages.length > 0) {
        await chatComponent.remove(ChatDataType.MESSAGE, messages)
      }
      let chat = store.state.chatMap[currentGroupChatGroupId]
      chat = await chatComponent.get(ChatDataType.CHAT, chat._id)
      if (chat) {
        await chatComponent.remove(ChatDataType.CHAT, chat, store.state.chats)
      }
      delete store.state.chatMap[currentGroupChatGroupId]

      // 先保存要通知的群组成员
      let groupChatLinkmans = []
      for (let groupMember of groupMembers) {
        let linkman = store.state.linkmanMap[groupMember.memberPeerId]
        if (linkman && linkman.peerId !== myselfPeerClient.peerId) { // 自己和非联系人除外
          groupChatLinkmans.push(store.state.linkmanMap[groupMember.memberPeerId])
          let _index = 0
          for (let gc of linkman.groupChats) {
            if (gc.groupId === currentGroupChatGroupId) {
              linkman.groupChats.splice(_index, 1)
              break
            }
            _index++
          }
        }
      }

      // 删除群组成员
      let removeGroupMembers = await contactComponent.loadGroupMember({
        ownerPeerId: myselfPeerClient.peerId,
        groupId: currentGroupChatGroupId
      })
      if (removeGroupMembers && removeGroupMembers.length > 0) {
        await contactComponent.remove(ContactDataType.GROUP_MEMBER, removeGroupMembers)
      }

      // 删除群组
      let groupChatRecord = await contactComponent.get(ContactDataType.GROUP, store.state.groupChatMap[store.state.currentChat.subjectId]._id)
      await contactComponent.remove(ContactDataType.GROUP, groupChatRecord, store.state.groupChats)
      delete store.state.groupChatMap[currentGroupChatGroupId]
      store.state.currentChat = null
      _that.subKind = "default"
      if (store.state.ifMobileStyle) {
        store.toggleDrawer(false)
      }

      if (groupChatLinkmans.length > 0) {
        // 新增Sent请求
        let groupMembersWithFlag = []
        let groupMember = {}
        groupMember.groupId = currentGroupChatGroupId
        groupMember.memberPeerId = myselfPeerClient.peerId
        groupMember.dirtyFlag = 'DELETED' // 脏标志
        groupMembersWithFlag.push(groupMember)
        let linkmanRequest = {}
        linkmanRequest.requestType = RequestType.REMOVE_GROUPCHAT_MEMBER
        linkmanRequest.ownerPeerId = myselfPeerClient.peerId
        linkmanRequest.senderPeerId = myselfPeerClient.peerId
        linkmanRequest.data = JSON.stringify(groupMembersWithFlag) // 数据库为JSON格式
        linkmanRequest.groupId = currentGroupChatGroupId
        linkmanRequest.createDate = currentTime
        linkmanRequest.status = RequestStatus.SENT
        console.log(linkmanRequest)
        await contactComponent.insert(ContactDataType.LINKMAN_REQUEST, linkmanRequest, null)
        linkmanRequest.data = groupMembersWithFlag // 内存为对象格式

        // 保存/发送Sent请求
        let message = {
          subjectType: SubjectType.LINKMAN_REQUEST,
          messageType: P2pChatMessageType.REMOVE_GROUPCHAT_MEMBER,
          content: linkmanRequest
        }
        for (let groupChatLinkman of groupChatLinkmans) {
          await store.saveAndSendMessage(message, groupChatLinkman)
        }
      }
    },
    showAddGroupChatMember() {
      let _that = this
      let store = _that.$store
      let groupChat = store.state.groupChatMap[store.state.currentChat.subjectId]
      let groupChatMembers = groupChat.groupMembers
      store.state.includedLinkmans = []
      let linkmans = store.state.linkmans
      for (let linkman of linkmans) {
        let existing = false
        for (let groupChatMember of groupChatMembers) {
          if (linkman.peerId === groupChatMember.memberPeerId) {
            existing = true
            break
          }
        }
        if (existing) {
          linkman.existing = true
          linkman.selected = true
          this.$store.state.includedLinkmans.push(linkman)
        } else {
          linkman.existing = false
          linkman.selected = false
        }
      }
      store.selectContactsEntry = _that.subKind // GROUP_CHATDetails - addGroupChatMember
      _that.subKind = 'selectContacts'
    },
    showAddGroupChatAndMember() {
      let _that = this
      let store = _that.$store
      let peerId = store.state.currentChat.subjectId
      store.state.includedLinkmans = []
      let linkmans = store.state.linkmans
      for (let linkman of linkmans) {
        let existing = false
        if (linkman.peerId === peerId) {
          existing = true
        }
        if (existing) {
          linkman.existing = true
          linkman.selected = true
          this.$store.state.includedLinkmans.push(linkman)
        } else {
          linkman.existing = false
          linkman.selected = false
        }
      }
      store.selectContactsEntry = _that.subKind // CHATDetails - addGroupChatAndMember
      _that.subKind = 'selectContacts'
    },
    showSelectGroupChatMember() {
      let linkmans = this.$store.state.linkmans // 实际选择的不是GroupChatMember，而是对应的linkman
      if (linkmans && linkmans.length > 0) {
        for (let linkman of linkmans) {
          linkman.selected = false
          linkman.existing = false
        }
      }
      this.selectedGroupChatMembers = []
      this.selectedGroupChatMemberPeerId = null
      this.selectGroupChatMemberFlag = 'removeGroupChatMember'
      this.subKind = 'selectGroupChatMember'
    },
    showOwnershipHandover() {
      let _that = this
      let store = _that.$store
      let groupChat = store.state.groupChatMap[store.state.currentChat.subjectId]
      if (groupChat.groupOwnerPeerId !== myself.myselfPeerClient.peerId) {
        return
      }

      let linkmans = store.state.linkmans // 实际选择的不是GroupChatMember，而是对应的linkman
      if (linkmans && linkmans.length > 0) {
        for (let linkman of linkmans) {
          linkman.selected = false
          linkman.existing = false
        }
      }
      _that.selectedGroupChatMembers = []
      _that.selectedGroupChatMemberPeerId = null
      _that.selectGroupChatMemberFlag = 'ownershipHandover'
      _that.subKind = 'selectGroupChatMember'
    },
    selectGroupChatMember(groupChatMember, ifCheckbox) {
      if (this.selectGroupChatMemberFlag === 'removeGroupChatMember' || this.selectGroupChatMemberFlag === 'selectedGroupCallMember') {
        if (!ifCheckbox) {
          groupChatMember.selected = !groupChatMember.selected
        }
        if (groupChatMember.selected) {
          this.selectedGroupChatMembers.push(groupChatMember)
        } else {
          let index = 0
          for (let selectedGroupChatMember of this.selectedGroupChatMembers) {
            if (selectedGroupChatMember.peerId === groupChatMember.peerId) { // 实际选择的不是GroupChatMember，而是对应的linkman，所以属性为peerId、不是memberPeerId
              this.selectedGroupChatMembers.splice(index, 1)
              return
            }
            index++
          }
        }
      } else if (this.selectGroupChatMemberFlag === 'ownershipHandover' || this.selectGroupChatMemberFlag === 'searchMessage') {
        this.selectedGroupChatMemberPeerId = groupChatMember.peerId
      }
    },
    selectGroupChatMemberBack() {
      if (this.selectGroupChatMemberFlag === 'selectedGroupCallMember') {
        this.subKind = 'default'
      } else if (this.selectGroupChatMemberFlag === 'searchMessage') {
        this.subKind = 'searchChatHistory'
      } else if (this.selectGroupChatMemberFlag === 'ownershipHandover' || this.selectGroupChatMemberFlag === 'removeGroupChatMember') {
        this.subKind = 'GROUP_CHATDetails'
      }
    },
    unselectGroupChatMember(index) {
      this.selectedGroupChatMembers[index].selected = false
      this.selectedGroupChatMembers.splice(index, 1)
    },
    async doneSelectGroupChatMember() {
      let _that = this
      let store = _that.$store
      if (this.selectGroupChatMemberFlag === 'removeGroupChatMember') {
        await this.removeGroupChatMember()
      } else if (this.selectGroupChatMemberFlag === 'ownershipHandover') {
        await this.ownershipHandover()
      } else if (this.selectGroupChatMemberFlag === 'selectedGroupCallMember') {
        _that.selectedGroupCallMember(_that.selectedGroupChatMembers)
        _that.subKind = 'default'
      } else if (this.selectGroupChatMemberFlag === 'searchMessage') {
        let searchSenderLinkman = store.state.linkmanMap[_that.selectedGroupChatMemberPeerId]
        this.searchSenderPeerId = searchSenderLinkman.peerId
        this.searchSenderName = searchSenderLinkman.givenName ? searchSenderLinkman.givenName : (searchSenderLinkman.name ? searchSenderLinkman.name : '')
        if (store.messageEntry !== 'search' && !_that.searchText) {
          await _that.refreshChatHistory()
        }
        this.subKind = 'searchChatHistory'
      }
    },
    async removeGroupChatMember() {
      let _that = this
      let store = _that.$store
      let myselfPeerClient = myself.myselfPeerClient
      let groupChat = store.state.groupChatMap[store.state.currentChat.subjectId]
      let groupMembers = groupChat.groupMembers
      let currentTime = new Date()
      // 先保存要通知的群组成员
      let groupChatLinkmans = []
      for (let groupMember of groupMembers) {
        let linkman = store.state.linkmanMap[groupMember.memberPeerId]
        if (linkman && linkman.peerId !== myselfPeerClient.peerId) { // 自己和非联系人除外
          groupChatLinkmans.push(store.state.linkmanMap[groupMember.memberPeerId])
        }
      }

      // 删除群组成员
      let groupMembersWithFlag = []
      let removedGroupMemberNames
      for (let selectedGroupChatMember of _that.selectedGroupChatMembers) {
        let gms = await contactComponent.loadGroupMember({
          ownerPeerId: myselfPeerClient.peerId,
          groupId: groupChat.groupId,
          memberPeerId: selectedGroupChatMember.peerId
        })
        await contactComponent.remove(ContactDataType.GROUP_MEMBER, gms, groupMembers)

        let groupMember = {}
        groupMember.groupId = groupChat.groupId
        groupMember.memberPeerId = selectedGroupChatMember.peerId
        groupMember.dirtyFlag = 'DELETED' // 脏标志
        groupMembersWithFlag.push(groupMember)
        removedGroupMemberNames = (removedGroupMemberNames ? removedGroupMemberNames + _that.$i18n.t(", ") : '') + (selectedGroupChatMember.givenName ? selectedGroupChatMember.givenName : selectedGroupChatMember.name)
        let linkman = store.state.linkmanMap[groupMember.memberPeerId]
        if (linkman) {
          let _index = 0
          for (let gc of linkman.groupChats) {
            if (gc.groupId === groupChat.groupId) {
              linkman.groupChats.splice(_index, 1)
              break
            }
            _index++
          }
        }
      }
      // 更新groupChat activeStatus
      if (groupChat.activeStatus === ActiveStatus.UP) {
        let hasActiveGroupMember = false
        for (let groupChatMember of groupMembers) {
          let linkman = store.state.linkmanMap[groupChatMember.memberPeerId]
          if (linkman && linkman.activeStatus === ActiveStatus.UP) {
            hasActiveGroupMember = true
            break
          }
        }
        if (!hasActiveGroupMember) {
          groupChat.activeStatus = ActiveStatus.DOWN
        }
      }

      groupChat.groupMembers = groupMembers
      store.state.groupChatMap[groupChat.groupId] = groupChat

      // 新增Sent请求
      let linkmanRequest = {}
      linkmanRequest.requestType = RequestType.REMOVE_GROUPCHAT_MEMBER
      linkmanRequest.ownerPeerId = myselfPeerClient.peerId
      linkmanRequest.senderPeerId = myselfPeerClient.peerId
      linkmanRequest.data = JSON.stringify(groupMembersWithFlag) // 数据库为JSON格式
      linkmanRequest.groupId = groupChat.groupId
      linkmanRequest.createDate = currentTime
      linkmanRequest.status = RequestStatus.SENT
      await contactComponent.insert(ContactDataType.LINKMAN_REQUEST, linkmanRequest)

      linkmanRequest.data = groupMembersWithFlag // 内存为对象格式

      // 保存/发送Sent请求
      let message = {
        subjectType: SubjectType.LINKMAN_REQUEST,
        messageType: P2pChatMessageType.REMOVE_GROUPCHAT_MEMBER,
        content: linkmanRequest
      }
      for (let groupChatLinkman of groupChatLinkmans) {
        await store.saveAndSendMessage(message, groupChatLinkman)
      }

      let chat = await store.getChat(groupChat.groupId)
      let chatMessage = {
        messageType: P2pChatMessageType.CHAT_SYS,
        contentType: ChatContentType.EVENT,
        content: _that.$i18n.t("You") + _that.$i18n.t(" have removed ") + removedGroupMemberNames + _that.$i18n.t(" from group chat")
      }
      await store.addCHATSYSMessage(chat, chatMessage)

      _that.subKind = 'GROUP_CHATDetails'
    },
    async ownershipHandover() {
      let _that = this
      let store = _that.$store
      let myselfPeerClient = myself.myselfPeerClient
      let groupChat = store.state.groupChatMap[store.state.currentChat.subjectId]
      let groupMembers = groupChat.groupMembers
      let selectedGroupChatMemberPeerId = _that.selectedGroupChatMemberPeerId
      let currentTime = new Date()

      // 修改群组成员群主身份
      let groupChatLinkmans = []
      let oldOwner, newOwner
      for (let groupMember of groupMembers) {
        let linkman = store.state.linkmanMap[groupMember.memberPeerId]
        if (linkman && linkman.peerId !== myselfPeerClient.peerId) { // 自己和非联系人除外
          groupChatLinkmans.push(store.state.linkmanMap[groupMember.memberPeerId])
        }
        if (groupMember.memberPeerId === myselfPeerClient.peerId) {
          groupMember.memberType = MemberType.MEMBER
          oldOwner = groupMember
        } else if (groupMember.memberPeerId === selectedGroupChatMemberPeerId) {
          groupMember.memberType = MemberType.OWNER
          newOwner = groupMember
        }
      }
      let groupMemberRecord = await contactComponent.get(ContactDataType.GROUP_MEMBER, oldOwner._id)
      if (groupMemberRecord) {
        groupMemberRecord.memberType = MemberType.MEMBER
        await contactComponent.update(ContactDataType.GROUP_MEMBER, groupMemberRecord)
      }
      groupMemberRecord = await contactComponent.get(ContactDataType.GROUP_MEMBER, newOwner._id)
      if (groupMemberRecord) {
        groupMemberRecord.memberType = MemberType.OWNER
        await contactComponent.update(ContactDataType.GROUP_MEMBER, groupMemberRecord)
      }

      groupChat.groupOwnerPeerId = selectedGroupChatMemberPeerId
      groupChat.groupMembers = groupMembers
      store.state.groupChatMap[groupChat.groupId] = groupChat

      // 新增Sent请求
      let groupMembersWithFlag = []
      let groupMember = {}
      groupMember.groupId = oldOwner.groupId
      groupMember.memberPeerId = oldOwner.memberPeerId
      groupMember.dirtyFlag = 'OLDOWNER' // 脏标志
      groupMembersWithFlag.push(groupMember)
      groupMember = {}
      groupMember.groupId = newOwner.groupId
      groupMember.memberPeerId = newOwner.memberPeerId
      groupMember.dirtyFlag = 'NEWOWNER' // 脏标志
      groupMembersWithFlag.push(groupMember)
      let linkmanRequest = {}
      linkmanRequest.requestType = RequestType.MODIFY_GROUPCHAT_OWNER
      linkmanRequest.ownerPeerId = myselfPeerClient.peerId
      linkmanRequest.senderPeerId = myselfPeerClient.peerId
      linkmanRequest.data = JSON.stringify(groupMembersWithFlag) // 数据库为JSON格式
      linkmanRequest.groupId = groupChat.groupId
      linkmanRequest.createDate = currentTime
      linkmanRequest.status = RequestStatus.SENT
      console.log(linkmanRequest)
      await contactComponent.insert(ContactDataType.LINKMAN_REQUEST, linkmanRequest)

      linkmanRequest.data = groupMembersWithFlag // 内存为对象格式

      // 保存/发送Sent请求
      let message = {
        subjectType: SubjectType.LINKMAN_REQUEST,
        messageType: P2pChatMessageType.MODIFY_GROUPCHAT_OWNER,
        content: linkmanRequest
      }
      for (let groupChatLinkman of groupChatLinkmans) {
        await store.saveAndSendMessage(message, groupChatLinkman)
      }

      let newOwnerName = store.state.linkmanMap[selectedGroupChatMemberPeerId].givenName ? store.state.linkmanMap[selectedGroupChatMemberPeerId].givenName : store.state.linkmanMap[selectedGroupChatMemberPeerId].name
      let chat = await store.getChat(groupChat.groupId)
      let chatMessage = {
        messageType: P2pChatMessageType.CHAT_SYS,
        contentType: ChatContentType.EVENT,
        content: newOwnerName + _that.$i18n.t(" has become the new Group Owner")
      }
      await store.addCHATSYSMessage(chat, chatMessage)

      _that.subKind = 'GROUP_CHATDetails'
    },
    confirmCleanChatHistory() {
      let _that = this
      let store = _that.$store
      _that.$q.bottomSheet({
        message: _that.$i18n.t('Clean chat history?'),
        actions: [
          {},
          {
            label: _that.$i18n.t('Confirm'),
            icon: 'check_circle',
            color: 'primary',
            id: 'confirm'
          },
          {},
          {
            label: _that.$i18n.t('Cancel'),
            icon: 'cancel',
            color: 'primary',
            id: 'cancel'
          }
        ]
      }).onOk(async action => {
        // console.log('Action chosen:', action.id)
        if (action.id === 'confirm') {
          let currentChat = store.state.currentChat
          currentChat.messages = []
          currentChat.content = ''
          let messages = await chatComponent.loadMessage({
            selector: {
              ownerPeerId: currentChat.ownerPeerId,
              subjectId: currentChat.subjectId,
            }
          })
          if (messages && messages.length > 0) {
            await chatComponent.remove(ChatDataType.MESSAGE, messages, null)
          }
          if (currentChat.subjectType === SubjectType.GROUP_CHAT) {
            let receives = await chatComponent.loadReceive({
              selector: {
                ownerPeerId: currentChat.ownerPeerId,
                subjectId: currentChat.subjectId,
              }
            }, null, null, null)
            if (receives && receives.length > 0) {
              await chatComponent.remove(ChatDataType.RECEIVE, receives, null)
            }
          }
        }
      }).onCancel(() => {
        // console.log('Dismissed')
      }).onDismiss(() => {
        // console.log('I am triggered on both OK and Cancel')
      })
    },
    async refreshChatHistory() {
      let _that = this
      _that.chatMessageResultList.splice(0)
      await _that.getChatHistory()
    },
    async getChatHistory(done) {
      let _that = this
      let store = _that.$store
      let selector = {
        ownerPeerId: myself.myselfPeerClient.peerId,
        subjectId: store.state.currentChat.subjectId,
        messageType: P2pChatMessageType.CHAT_LINKMAN
      }
      if (_that.searchDate) {
        let createDateStart = new Date(new Date(_that.searchDate).toLocaleDateString()).getTime()
        let createDateEnd = new Date(new Date(_that.searchDate).toLocaleDateString()).getTime() + 24 * 60 * 60 * 1000
        selector.createDateStart = { $gte: createDateStart }
        selector.createDateEnd = { $lt: createDateEnd }
      }
      if (_that.searchSenderPeerId) {
        selector.senderPeerId = _that.searchSenderPeerId
      }
      if (_that.nonsysChatContentTypeIndex !== 0) {
        selector.contentType = _that.nonsysChatContentTypes[_that.nonsysChatContentTypeIndex].value
      }
      selector.createDate = { $lt: _that.chatMessageResultList.length > 0 ? _that.chatMessageResultList[0].createDate : null }
      let messages = await chatComponent.loadMessage(
        selector,
        [{ createDate: 'desc' }], null, 10
      )
      CollaUtil.sortByKey(messages, 'createDate', 'asc');
      console.log(messages)
      if (messages && messages.length > 0) {
        _that.chatMessageResultList = messages.concat(_that.chatMessageResultList)
      }
      if (typeof done == 'function') {
        done()
      }
    },
    async changeChatContentType(item, index) {
      let _that = this
      let store = _that.$store
      console.log('index:' + index + ',item.value:' + item.value)
      if (store.messageEntry !== 'search' && !_that.searchText) {
        await _that.refreshChatHistory()
      } else {
        _that.searchText = (_that.searchText || '').replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, '')
        if (_that.searchText) {
          await _that.search()
        }
      }
    },
    async showSearchChatHistory() {
      let _that = this
      let store = _that.$store
      _that.subKind = 'searchChatHistory'
      _that.searchPrefix = null
      _that.searchText = null
      _that.searchDate = null
      _that.searchSenderPeerId = null
      _that.searchSenderName = null
      _that.messageResultList = []
      _that.chatMessageResultList = []
      _that.nonsysChatContentTypeIndex = 0
      _that.searchableChatContentTypeIndex = 0
      _that.$nextTick(() => {
        let searchTextInputs = document.getElementsByClassName('q-field__native')
        if (searchTextInputs || searchTextInputs[1] || searchTextInputs[1].style.display !== 'none') {
          searchTextInputs[1].focus()
        }
        _that.search()
      })
    },
    changeNotAlertSwitch: async function (value) {
      let _that = this
      let store = _that.$store
      let subjectType = store.state.currentChat.subjectType
      let subjectId = store.state.currentChat.subjectId
      if (subjectType === SubjectType.CHAT) {
        let linkman = store.state.linkmanMap[subjectId]
        let linkmanRecord = await contactComponent.get(ContactDataType.LINKMAN, linkman._id)
        if (linkmanRecord) {
          linkmanRecord.notAlert = value
          await contactComponent.update(ContactDataType.LINKMAN, linkmanRecord)
        }
      } else if (subjectType === SubjectType.GROUP_CHAT) {
        let groupChat = store.state.groupChatMap[subjectId]
        let groupChatRecord = await contactComponent.get(ContactDataType.GROUP, groupChat._id)
        if (groupChatRecord) {
          groupChatRecord.notAlert = value
          await contactComponent.update(ContactDataType.GROUP, groupChatRecord)
        }
      }
    },
    changeTopSwitch: async function (value) {
      let _that = this
      let store = _that.$store
      let subjectType = store.state.currentChat.subjectType
      let subjectId = store.state.currentChat.subjectId
      if (subjectType === SubjectType.CHAT) {
        let linkman = store.state.linkmanMap[subjectId]
        let linkmanRecord = await contactComponent.get(ContactDataType.LINKMAN, linkman._id)
        if (linkmanRecord) {
          linkmanRecord.top = value
          await contactComponent.update(ContactDataType.LINKMAN, linkmanRecord)
        }
      } else if (subjectType === SubjectType.GROUP_CHAT) {
        let groupChat = store.state.groupChatMap[subjectId]
        let groupChatRecord = await contactComponent.get(ContactDataType.GROUP, groupChat._id)
        if (groupChatRecord) {
          groupChatRecord.top = value
          await contactComponent.update(ContactDataType.GROUP, groupChatRecord)
        }
      }
    },
    changeRecallTimeLimit: async function (value) {
      let _that = this
      let store = _that.$store
      let subjectType = store.state.currentChat.subjectType
      let subjectId = store.state.currentChat.subjectId
      if (subjectType === SubjectType.CHAT) {
        let linkman = store.state.linkmanMap[subjectId]
        let linkmanRecord = await contactComponent.get(ContactDataType.LINKMAN, linkman._id)
        if (linkmanRecord) {
          linkman.myselfRecallTimeLimit = value
          linkmanRecord.myselfRecallTimeLimit = value
          await contactComponent.update(ContactDataType.LINKMAN, linkmanRecord)
          await store.sendLinkmanInfo(subjectId, `modify`)
        }
      } else if (subjectType === SubjectType.GROUP_CHAT) {
        let groupChat = store.state.groupChatMap[subjectId]
        let groupChatRecord = await contactComponent.get(ContactDataType.GROUP, groupChat._id)
        if (groupChatRecord) {
          groupChat.recallTimeLimit = value
          groupChatRecord.recallTimeLimit = value
          await contactComponent.update(ContactDataType.GROUP, groupChatRecord)
          _that.sendGroupInfo()
        }

        let _type = _that.$i18n.t("Recall Time Limit")
        let _content = `${store.state.myselfPeerClient.name}${(value ? _that.$i18n.t("Add") : _that.$i18n.t("Cancel"))}${_type}`
        if (_content) {
          let chat = await store.getChat(groupChat.groupId)
          let chatMessage = {
            messageType: P2pChatMessageType.CHAT_SYS,
            contentType: ChatContentType.EVENT,
            content: _content
          }
          await store.addCHATSYSMessage(chat, chatMessage)
        }
      }
      _that.$forceUpdate()
    },
    changeRecallAlert: async function (value) {
      let _that = this
      let store = _that.$store
      let subjectType = store.state.currentChat.subjectType
      let subjectId = store.state.currentChat.subjectId
      if (subjectType === SubjectType.CHAT) {
        let linkman = store.state.linkmanMap[subjectId]
        let linkmanRecord = await contactComponent.get(ContactDataType.LINKMAN, linkman._id)
        if (linkmanRecord) {
          linkman.myselfRecallAlert = value
          linkmanRecord.myselfRecallAlert = value
          await contactComponent.update(ContactDataType.LINKMAN, linkmanRecord)
          await store.sendLinkmanInfo(subjectId, `modify`)
        }
      } else if (subjectType === SubjectType.GROUP_CHAT) {
        let groupChat = store.state.groupChatMap[subjectId]
        let groupChatRecord = await contactComponent.get(ContactDataType.GROUP, groupChat._id)
        if (groupChatRecord) {
          groupChat.recallAlert = value
          groupChatRecord.recallAlert = value
          await contactComponent.update(ContactDataType.GROUP, groupChatRecord)
          _that.sendGroupInfo()

          let _type = _that.$i18n.t("Recall Alert")
          let _content = `${store.state.myselfPeerClient.name}${(value ? _that.$i18n.t("Add") : _that.$i18n.t("Cancel"))}${_type}`
          if (_content) {
            let chat = await store.getChat(groupChat.groupId)
            let chatMessage = {
              messageType: P2pChatMessageType.CHAT_SYS,
              contentType: ChatContentType.EVENT,
              content: _content
            }
            await store.addCHATSYSMessage(chat, chatMessage)
          }
        }
      }
    },
    async showContacts(peerId) {
      let _that = this
      let store = _that.$store
      if (peerId) {
        let myselfPeerClient = myself.myselfPeerClient
        let linkman = store.state.linkmanMap[peerId]
        if (linkman) {
          store.state.currentLinkman = linkman
          store.contactsDetailsEntry = _that.subKind // CHATDetails, GROUP_CHATDetails,default
          _that.subKind = 'contactsDetails'
          /*if (store.state.ifMobileStyle) {
            statusBarComponent.style(true, '#ffffff')
          }*/
        } else {
          linkman = await peerClientService.getCachedPeerClient(peerId)
          if (linkman && linkman.visibilitySetting && linkman.visibilitySetting.substring(2, 3) === 'N') {
            store.state.findLinkmanResult = 1
            store.state.findLinkmanTip = _that.$i18n.t('The contact is invisible')
            store.findLinkman = null
            store.state.findLinkmanData = {
              peerId: _that.$i18n.t('Invisible Peer Id'), // set Peer Id
              message: null,
              givenName: null,
              tag: null
            }
            store.state.findContactsSubKind = 'default'
          } else if (linkman && !(linkman.visibilitySetting && linkman.visibilitySetting.substring(0, 1) === 'N')) {
            store.state.findLinkmanResult = 4
            store.state.findLinkmanTip = ''
            store.findLinkman = linkman
            store.state.findContactsSubKind = 'result'
          } else {
            store.state.findLinkmanResult = 1
            store.state.findLinkmanTip = _that.$i18n.t('The contact does not exist')
            store.findLinkman = null
            store.state.findLinkmanData = {
              peerId: peerId,
              message: null,
              givenName: null,
              tag: null
            }
            store.state.findContactsSubKind = 'default'
          }
          store.findContactsEntry = 'GROUP_CHATDetails'
          _that.subKind = 'findContacts'
        }
      }
    },
    selectLinkmanCard() {
      let _that = this
      let store = _that.$store
      let linkmans = store.state.linkmans
      if (linkmans && linkmans.length > 0) {
        for (let linkman of linkmans) {
          linkman.selected = false
          linkman.existing = false
        }
      }
      store.state.includedLinkmans = []
      store.selectContactsEntry = 'linkmanCard'
      store.changeKind('selectContacts')
    },
    async selectedLinkmanCard() {
      let _that = this
      let store = _that.$store
      let linkmans = store.state.includedLinkmans
      for (let linkman of linkmans) {
        let card = {
          avatar: linkman.avatar,
          peerId: linkman.peerId,
          name: linkman.name
        }
        let message = {
          content: card,
          contentType: ChatContentType.CARD,
          messageType: P2pChatMessageType.CHAT_LINKMAN
        }
        await store.sendChatMessage(store.state.currentChat, message)
      }
    },
    async openCard(message) {
      let _that = this
      let store = _that.$store
      store.findLinkman = null
      store.state.findLinkmanData = {
        peerId: null,
        message: null,
        givenName: null,
        tag: null
      }
      store.state.findContactsSubKind = 'default'
      store.findContactsEntry = 'message'
      store.changeKind('findContacts')
      await store.findContacts('card', message.content.peerId)
    },
    backToDefault() {
      let _that = this
      _that.subKind = 'default'

    },
    more() {
      let _that = this
      if (_that.keyboardMode) {
        _that.keyboardMode = false
      } else {
        _that.keyboardMode = true
      }
    },
    cancel: function () {
      this.stopStream()
      this.imageUrl = null
      this.audioUrl = null
      this.videoUrl = null
      this.captureType = null
    },
    stopStream: function () {
      if (this.srcStream) {
        mediaStreamComponent.stop(this.srcStream)
      }
      this.captureRecorder = null
      this.captureStatus = false
      this.srcStream = null
    },
    captureAudio: async function () {
      let _that = this
      let store = _that.$store
      if (store.ios === true) {
        if (this.captureStatus === false) {
          await audioInputComponent.startRecord()
          this.captureStatus = true
        } else if (this.captureStatus === true) {
          audioInputComponent.stopRecord()
        }
      } else if (store.android === true || store.chrome === true) {
        if (this.captureStatus === false) {
          console.log('captureAudio start')
          let constraints = {
            audio: {
              echoCancellation: true,
              recorderType: mediaRecorderComponent.StereoAudioRecorder
            }
          }
          let stream = await mediaStreamComponent.openUserMedia(constraints)
          this.srcStream = stream
          let options = {
            type: 'audio',
            numberOfAudioChannels: 2,
            checkForInactiveTracks: true,
            bufferSize: 16384,
          }
          let recorder = await mediaRecorderComponent.create(stream, options)
          mediaRecorderComponent.startRecording(recorder)
          this.captureRecorder = recorder
          this.captureStatus = true
        } else if (this.captureStatus === true) {
          console.log("captureAudio end")
          let url = await mediaRecorderComponent.stopRecording(this.captureRecorder, 'blob')
          console.log("captureAudio end " + url)
          this.audioUrl = url
          this.captureStatus = false
        }
      }
    },
    preventDefault(e) {
      e.preventDefault()
    },
    audioTouchStart(e) {
      let _that = this
      e.preventDefault()
      let _voiceObj = document.getElementById('audio-touch-text')
      _that.difftime = new Date();
      //if(!_that.isDrag) return;
      //_that.isDrag = false;
      _that.eY1 = e.targetTouches[0].pageY;
      _voiceObj.innerText = _that.$i18n.t("Release to stop");
      _that.audioTouchDialog = true
      _that.$nextTick(async () => {
        if (!_that.mediaTimer) {
          _that.startMediaTimer()
        }
        await _that.captureAudio()
      })
    },
    async audioTouchEnd(e) {
      let _that = this
      let store = _that.$store
      let _voiceObj = document.getElementById('audio-touch-text')
      e.preventDefault();
      _that.eY2 = e.changedTouches[0].pageY;
      _voiceObj.innerText = _that.$i18n.t("Hold to talk")
      if (new Date() - _that.difftime < 1000) {
        // tooltip
      } else {
        if (_that.eY1 - _that.eY2 < 150) {
          // 发送成功
          await _that.captureAudio()
          if (!Platform.is.ios) {
            let blob = null
            blob = _that.audioUrl
            _that.audioBlobMessageHandle(blob)
            _that.stopStream()
          }

        } else {
          _that.cancel()
        }
      }
      //_that.isDrag = true;
      _that.audioTouchDialog = false
      clearInterval(_that.mediaTimer);
      _that.mediaTimer = null
    },
    audioTouchMove(e) {
      let _that = this
      e.preventDefault()
      let _voiceObj = document.getElementById('audio-touch-text')
      _that.eY3 = e.targetTouches[0].pageY;
      if (_that.eY1 - _that.eY3 < 150) {
        _voiceObj.innerText = _that.$i18n.t("Release to stop");
      } else {
        _voiceObj.innerText = _that.$i18n.t("Release your finger and cancel send");
      }
    },
    editorKeyup(e) {
      let _that = this
      let store = _that.$store
      if ((!e.shiftKey && e.keyCode == 13) || (store.ios && e.keyCode == 13)) {
        _that.preSend()
      } else {
        if (((e.shiftKey && e.keyCode == 50)) && store.state.currentChat.subjectType === SubjectType.GROUP_CHAT) {
          _that.focusGroupMemberDialog = true
        } else if (store.state.ifMobileStyle) {
          _that.talkHeight()
        }
      }
    },
    editorFocus(e) {
      let _that = this
      _that.keyboardMode = true
    },
    editorBlur(e) {
      let _that = this
      //_that.keyboardMode = false
    },
    editorPaste(e) {
      let _that = this
      //e.preventDefault();
      let clipboardData = e.clipboardData;
      let clipboardDataValue = clipboardData.getData('text/plain');
      if (clipboardDataValue) {
        clipboardData.setData('text/plain', clipboardDataValue);
      }
    },
    async editorDrop(e) {
      e.preventDefault();
      let _that = this
      if (e.dataTransfer && e.dataTransfer.files) {
        for (let file of e.dataTransfer.files) {
          await _that.uploadMessageFile(file)
        }
      }
    },
    mediaHold() {
      let _that = this;
      let store = _that.$store
      _that.$q.bottomSheet({
        actions: [
          {
            label: _that.$i18n.t('Save'),
            icon: 'save',
            color: 'primary',
            id: 'save'
          },
          {},
          {
            label: _that.$i18n.t('Cancel'),
            icon: 'cancel',
            color: 'primary',
            id: 'cancel'
          }
        ]
      }).onOk(async action => {
        if (action.id === 'save') {
          if (store.state.imageMessageViewDialog) {
            _that.saveLocalImage()
          } else if (store.state.videoRecordMessageViewDialog) {
            await _that.saveLocalVideo()
          } else if (store.state.audioRecordMessageViewDialog) {
            //_that.saveLocalAudio()
          }
        }
      }).onCancel(() => {
        // console.log('Dismissed')
      }).onDismiss(() => {
        // console.log('I am triggered on both OK and Cancel')
      })
    },
    saveLocalImage() {
      let _that = this
      //save
      let imageDom = document.getElementById('dialog-image')
      let canvas = mediaComponent.image2canvas(imageDom)
      console.log(canvas)
      window.canvas2ImagePlugin.saveImageDataToLibrary(
        function (msg) {
          console.log(msg)
          _that.$q.notify({
            message: _that.$i18n.t("Saved successfully"),
            timeout: 3000,
            type: "info",
            color: "info",
          })
        },
        function (err) {
          console.log(err)
          _that.$q.notify({
            message: _that.$i18n.t("Save failed"),
            timeout: 3000,
            type: "warning",
            color: "warning",
          })
        },
        canvas,
        "jpeg"
      )
    },
    async saveLocalVideo() {
      let _that = this
      let store = _that.$store
      let albums = await photoLibraryComponent.getAlbums()
      await photoLibraryComponent.saveVideo(store.state.videoRecordMessageSrc, albums[0])
      _that.$q.notify({
        message: _that.$i18n.t("Saved successfully"),
        timeout: 3000,
        type: "info",
        color: "info",
      })
    },
    openCollection() {
      let _that = this
      let store = _that.$store
      store.collectionEntry = 'message'
      store.state.selectedCollectionItems = []
      store.changeKind('collection')
    },
    async collectionPicked(items) {
      let _that = this
      let store = _that.$store
      for (let item of items) {
        await store.collectionForwardToChat(item, store.state.currentChat)
      }
    },
    isSent(message) {
      return message.senderPeerId === this.$store.state.myselfPeerClient.peerId ? true : false
    },
    getAvatar(message) {
      let state = this.$store.state
      let senderPeer = state.linkmanMap[message.senderPeerId]
      let avatar1 = state.myselfPeerClient.avatar ? state.myselfPeerClient.avatar : this.$store.defaultActiveAvatar
      let avatar2 = (senderPeer && senderPeer.avatar) ? senderPeer.avatar : this.$store.defaultActiveAvatar
      let avatar = message.senderPeerId === state.myselfPeerClient.peerId ? avatar1 : avatar2

      return avatar
    },
    getName(message) {
      let state = this.$store.state
      let senderPeer = state.linkmanMap[message.senderPeerId]
      let gName = senderPeer ? senderPeer.givenName : null
      let name = senderPeer ? senderPeer.name : null
      let name1 = gName ? gName : name
      let name2 = message.senderPeerId === state.myselfPeerClient.peerId ? state.myselfPeerClient.name : name1
      name = (message.subjectType === SubjectType.CHAT) ? '' : name2

      return name
    },
    isResend(message) {
      let state = this.$store.state
      let result = state.currentChat.subjectType === SubjectType.CHAT && state.linkmanMap[state.currentChat.subjectId].activeStatus !== ActiveStatus.UP && message.senderPeerId === state.myselfPeerClient.peerId && !message.receiveTime

      return result
    },
    resultBack() {
      let _that = this
      let store = _that.$store
      store.toggleDrawer(false)
      store.messageEntry = null
    },
    searchBack() {
      let _that = this
      let store = _that.$store
      if (store.messageEntry === 'search') {
        store.toggleDrawer(false)
        store.messageEntry = null
        store.chatSearchBack()
      } else {
        _that.subKind = (store.state.currentChat.subjectType === SubjectType.CHAT ? 'CHATDetails' : 'GROUP_CHATDetails')
      }
    },
    async searchDateInput(value) {
      let _that = this
      let store = _that.$store
      if (store.messageEntry !== 'search' && !_that.searchText) {
        await _that.refreshChatHistory()
      }
      _that.$refs.qDateProxy.hide()
    },
    async cleanSearchDate() {
      let _that = this
      let store = _that.$store
      _that.searchDate = null
      if (store.messageEntry !== 'search' && !_that.searchText) {
        await _that.refreshChatHistory()
      }
    },
    async cleanSearchSender() {
      let _that = this
      let store = _that.$store
      _that.searchSenderPeerId = null
      _that.searchSenderName = null
      if (store.messageEntry !== 'search' && !_that.searchText) {
        await _that.refreshChatHistory()
      }
    },
    searchInput(value) {
      let _that = this
      _that.searching = false
    },
    async searchKeyup(e) {
      let _that = this
      _that.searchText = (_that.searchText || '').replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, '')
      if (e.keyCode === 13 && _that.searchText) {
        await _that.search()
        let searchTextInputs = document.getElementsByClassName('q-field__native')
        if (searchTextInputs || searchTextInputs[1] || searchTextInputs[1].style.display !== 'none') {
          searchTextInputs[1].blur()
        }
      }
    },
    async search() {
      let _that = this
      let store = _that.$store
      let currentChat = store.state.currentChat
      if (currentChat) {
        console.log('currentChat.subjectId:' + currentChat.subjectId)
        _that.searching = true
        _that.messageResultList.splice(0)
        let searchableChatContentType = _that.searchableChatContentTypes[_that.searchableChatContentTypeIndex].value
        /*let filter
        // 由于pouchdb-quick-search filter cache bug，使用穷举法
        if (searchableChatContentType === ChatContentType.ALL) {
          filter = function (doc) {
            return doc.ownerPeerId === myself.myselfPeerClient.peerId && doc.subjectId === currentChat.subjectId &&
                    (doc.contentType === ChatContentType.NOTE || doc.contentType === ChatContentType.CHAT ||
                     doc.contentType === ChatContentType.TEXT || doc.contentType === ChatContentType.FILE ||
                     doc.contentType === ChatContentType.CARD)
          }
        } else if (searchableChatContentType === ChatContentType.NOTE) {
          filter = function (doc) {
            return doc.ownerPeerId === myself.myselfPeerClient.peerId && doc.subjectId === currentChat.subjectId &&
                     doc.contentType === ChatContentType.NOTE
          }
        } else if (searchableChatContentType === ChatContentType.CHAT) {
          filter = function (doc) {
            return doc.ownerPeerId === myself.myselfPeerClient.peerId && doc.subjectId === currentChat.subjectId &&
                     doc.contentType === ChatContentType.CHAT
          }
        } else if (searchableChatContentType === ChatContentType.TEXT) {
          filter = function (doc) {
            return doc.ownerPeerId === myself.myselfPeerClient.peerId && doc.subjectId === currentChat.subjectId &&
                     doc.contentType === ChatContentType.TEXT
          }
        } else if (searchableChatContentType === ChatContentType.FILE) {
          filter = function (doc) {
            return doc.ownerPeerId === myself.myselfPeerClient.peerId && doc.subjectId === currentChat.subjectId &&
                     doc.contentType === ChatContentType.FILE
          }
        } else if (searchableChatContentType === ChatContentType.CARD) {
          filter = function (doc) {
            return doc.ownerPeerId === myself.myselfPeerClient.peerId && doc.subjectId === currentChat.subjectId &&
                     doc.contentType === ChatContentType.CARD
          }
        }*/
        let messageResults = await chatComponent.searchPhase(ChatDataType.MESSAGE, _that.searchText/*, filter*/)
        console.info(messageResults)
        if (messageResults && messageResults.rows && messageResults.rows.length > 0) {
          for (let messageResult of messageResults.rows) {
            let message = messageResult.doc
            let createDateStart
            let createDateEnd
            if (_that.searchDate) {
              createDateStart = new Date(new Date(_that.searchDate).toLocaleDateString()).getTime()
              createDateEnd = new Date(new Date(_that.searchDate).toLocaleDateString()).getTime() + 24 * 60 * 60 * 1000
            }
            if (message.ownerPeerId === myself.myselfPeerClient.peerId && message.subjectId === currentChat.subjectId
              && ((searchableChatContentType === ChatContentType.ALL && (message.contentType === ChatContentType.NOTE || message.contentType === ChatContentType.CHAT ||
                message.contentType === ChatContentType.TEXT || message.contentType === ChatContentType.FILE || message.contentType === ChatContentType.CARD))
                || (searchableChatContentType !== ChatContentType.ALL && message.contentType === searchableChatContentType))
              && (!_that.searchSenderPeerId || message.senderPeerId === _that.searchSenderPeerId)
              && (!_that.searchDate || (message.createDate >= createDateStart && message.createDate < createDateEnd))) {
              message.linkman = store.state.linkmanMap[message.senderPeerId]
              if (messageResult.highlighting.title) {
                message.highlighting = messageResult.highlighting.title
              } else if (messageResult.highlighting.content) {
                message.highlighting = messageResult.highlighting.content
              }
              _that.messageResultList.push(message)
            }
          }
        }
      }
    },
    selectSearchSender() {
      let linkmans = this.$store.state.linkmans // 实际选择的不是GroupChatMember，而是对应的linkman
      if (linkmans && linkmans.length > 0) {
        for (let linkman of linkmans) {
          linkman.selected = false
          linkman.existing = false
        }
      }
      this.selectedGroupChatMembers = []
      this.selectedGroupChatMemberPeerId = null
      this.selectGroupChatMemberFlag = 'searchMessage'
      this.subKind = 'selectGroupChatMember'
    },
    async messageResultSelected(message, index) {
      let _that = this
      let store = _that.$store
      let messages = await chatComponent.loadMessage(
        {
          ownerPeerId: myself.myselfPeerClient.peerId,
          subjectId: store.state.currentChat.subjectId,
          messageType: P2pChatMessageType.CHAT_LINKMAN,
          receiveTime: { $gte: message.receiveTime }
        }, [{ receiveTime: 'asc' }], null, null
      )
      if (messages && messages.length > 0) {
        store.state.currentChat.messages = messages
        this.subKind = 'default'
        _that.$nextTick(() => {
          let container = document.getElementById('#talk')
          if (container) {
            container.scrollTop = 0
          }
        })
      }
    },
    async enterGroupFile() {
      let _that = this
      let store = _that.$store
      _that.subKind = 'groupFile'
      _that.$q.loading.show()
      await _that.getGroupFileList()
      _that.$q.loading.hide()
    },
    async getGroupFileList() {
      let _that = this
      let store = _that.$store
      let currentChat = store.state.currentChat
      // 查询cloud全量DataBlock索引信息
      let conditionBean = {}
      conditionBean['businessNumber'] = currentChat.subjectId
      conditionBean['getAllBlockIndex'] = true
      conditionBean['blockType'] = BlockType.GroupFile
      _that.groupFileList = []
      if (store.state.networkStatus === 'CONNECTED') {
        _that.groupFileList = await queryValueAction.queryValue(null, conditionBean)
      }
      let _messages = await chatComponent.loadMessage({
        ownerPeerId: myself.myselfPeerClient.peerId,
        messageType: P2pChatMessageType.GROUP_FILE,
        subjectId: currentChat.subjectId
      })
      if (_messages && _messages.length > 0) {
        if (store.state.networkStatus === 'CONNECTED') {
          //只做比较删除，下载到本地后才会新增
          let cloudGroupFileMap = {}
          for (let cloudGroupFile of _that.groupFileList) {
            cloudGroupFileMap[cloudGroupFile.blockId] = cloudGroupFile.blockId
          }
          for (let _groupFileMessage of _messages) {
            if (!cloudGroupFileMap[_groupFileMessage.attachBlockId]) {
              await chatComponent.remove(ChatDataType.MESSAGE, _groupFileMessage)
              let localGroupAttachs = await chatBlockComponent.loadLocalAttach(_groupFileMessage.attachBlockId)
              for (let localGroupAttach of localGroupAttachs) {
                localGroupAttach.state = EntityState.Deleted
              }
              await chatBlockComponent.saveLocalAttach({ attachs: localGroupAttachs })
            }
          }
        } else {
          for (let _groupFileMessage of _messages) {
            _that.groupFileList.push({
              blockId: _groupFileMessage.attachBlockId,
              createTimestamp: _groupFileMessage.createDate,
              name: _groupFileMessage.content,
              businessNumber: _groupFileMessage.subjectId
            })
          }
        }
      }
      console.log('groupFileList:' + JSON.stringify(_that.groupFileList))
    },
    async uploadGroupFile(file) {
      let _that = this
      let store = _that.$store
      _that.$q.loading.show()
      let peerId = store.state.currentChat.subjectId
      let fileType
      if (file.name) {
        let index = file.name.lastIndexOf(".")
        fileType = file.name.substr(index + 1)
      }
      let fileData = await BlobUtil.fileObjectToBase64(file)
      let type, name, fileSize
      if (mediaComponent.isAssetTypeAnImage(fileType)) {
        /*if (file.size > 2097152) { // 2M
          _that.$q.notify({
            message: _that.$i18n.t("Restricted to images, size less than 2M"),
            timeout: 3000,
            type: "warning",
            color: "warning",
          })
          _that.$refs.groupFileUpload.reset()
          return
        }*/
        type = ChatContentType.IMAGE
      } else if (mediaComponent.isAssetTypeAVideo(fileType)) {
        type = ChatContentType.VIDEO
      } else if (mediaComponent.isAssetTypeAnAudio(fileType)) {
        type = ChatContentType.AUDIO
      } else {
        type = ChatContentType.FILE
      }
      name = file.name
      fileSize = file.size
      let chat = store.state.currentChat
      let message = {}
      message.ownerPeerId = myself.myselfPeerClient.peerId
      message.messageId = UUID.string(null, null)
      message.messageType = P2pChatMessageType.GROUP_FILE
      message.subjectId = peerId
      message.fileSize = StringUtil.getSize(fileData)
      message.contentType = type
      // 云端保存
      await store.saveFileInMessage(chat, message, fileData, type, name, message.messageId)
      // 群主新增群文件后保存本地不发送
      await chatComponent.insert(ChatDataType.MESSAGE, message)
      await _that.getGroupFileList()
      _that.$q.loading.hide()
    },
    async uploadGroupFilePC(file) {
      let _that = this
      let store = _that.$store
      if (file) {
        await _that.uploadGroupFile(file)
      }
      _that.$refs.groupFileUpload.reset()
    },
    uploadGroupFileMobile() {
      let _that = this
      let store = _that.$store
      _that.$nextTick(async () => {
        let groupFileUpload = document.getElementById('groupFileUpload')
        if (groupFileUpload && groupFileUpload.files) {
          let file = groupFileUpload.files[0]
          if (file) {
            await _that.uploadGroupFile(file)
          }
          let form = document.getElementById('groupFileUploadForm')
          if (form) {
            form.reset()
          }
        }
      })
    },
    confirmRemoveGroupFile(groupFile) {
      let _that = this
      _that.$q.bottomSheet({
        message: _that.$i18n.t('Confirm the deletion?'),
        actions: [
          {},
          {
            label: _that.$i18n.t('Confirm'),
            icon: 'check_circle',
            color: 'primary',
            id: 'confirm'
          },
          {},
          {
            label: _that.$i18n.t('Cancel'),
            icon: 'cancel',
            color: 'primary',
            id: 'cancel'
          }
        ]
      }).onOk(async action => {
        // console.log('Action chosen:', action.id)
        if (action.id === 'confirm') {
          await _that.removeGroupFile(groupFile)
        }
      }).onCancel(() => {
        // console.log('Dismissed')
      }).onDismiss(() => {
        // console.log('I am triggered on both OK and Cancel')
      })
    },
    async removeGroupFile(groupFile) {
      let _that = this
      _that.$q.loading.show()
      await collectionUtil.deleteBlock(groupFile, true, BlockType.GroupFile)
      await _that.getGroupFileList()
      _that.$q.loading.hide()
    },
    async groupFileSelected(groupFile, _index) {
      let _that = this
      let store = _that.$store
      let message
      let _messages = await chatComponent.loadMessage(
        {
          ownerPeerId: myself.myselfPeerClient.peerId,
          attachBlockId: groupFile.blockId
        })
      if (_messages && _messages.length > 0) {
        message = _messages[0]
      }
      if (!message) {
        message = {
          attachBlockId: groupFile.blockId,
          content: groupFile.name,
          createDate: groupFile.createTimestamp,
          subjectId: groupFile.businessNumber
        }
      }
      _that.getMessageFileAndOpen(message)
    },
    groupChatMemberName(groupChatMember) {
      let _that = this
      let store = _that.$store
      let groupChatMemberName = ''
      let memberPeerId = groupChatMember.memberPeerId
      let linkman = store.state.linkmanMap[memberPeerId]
      if (linkman) {
        if (linkman.givenName) {
          groupChatMemberName = linkman.givenName.length > 3 ? linkman.givenName.substr(0, 3) + '...' : linkman.givenName
        } else if (groupChatMember.memberAlias) {
          groupChatMemberName = groupChatMember.memberAlias.length > 3 ? groupChatMember.memberAlias.substr(0, 3) + '...' : groupChatMember.memberAlias
        } else if (linkman.name) {
          groupChatMemberName = linkman.name.length > 3 ? linkman.name.substr(0, 3) + '...' : linkman.name
        }
      } else {
        if (groupChatMember.memberAlias) {
          groupChatMemberName = groupChatMember.memberAlias.length > 3 ? groupChatMember.memberAlias.substr(0, 3) + '...' : groupChatMember.memberAlias
        } else {
          let peerClient = peerClientService.getPeerClientFromCache(memberPeerId)
          if (peerClient && peerClient.name) {
            groupChatMemberName = peerClient.name.length > 3 ? peerClient.name.substr(0, 3) + '...' : peerClient.name
          }
        }
      }
      return groupChatMemberName
    },
    groupChatOwnerName() {
      let _that = this
      let store = _that.$store
      let groupChatOwnerName = ''
      let currentChat = store.state.currentChat
      if (currentChat) {
        let group = store.state.groupChatMap[currentChat.subjectId]
        if (group) {
          if (group.groupOwnerPeerId === store.state.myselfPeerClient.peerId) {
            groupChatOwnerName = store.state.myselfPeerClient.name
          } else {
            let groupChatMembers = group.groupMembers
            if (groupChatMembers && groupChatMembers.length > 0) {
              for (let groupChatMember of groupChatMembers) {
                if (groupChatMember.memberPeerId === group.groupOwnerPeerId) {
                  if (groupChatMember.memberAlias) {
                    groupChatOwnerName = groupChatMember.memberAlias
                  }
                  break
                }
              }
            }
            if (!groupChatOwnerName) {
              let linkman = store.state.linkmanMap[group.groupOwnerPeerId]
              if (linkman) {
                groupChatOwnerName = linkman.givenName ? linkman.givenName : linkman.name
              } else {
                let peerClient = peerClientService.getPeerClientFromCache(group.groupOwnerPeerId)
                if (peerClient && peerClient.name) {
                  groupChatOwnerName = peerClient.name
                }
              }
            }
          }
        }
      }
      return groupChatOwnerName
    },
    groupChatMemeberAvatar(groupChatMember) {
      let _that = this
      let store = _that.$store
      let groupChatMemeberAvatar = store.defaultActiveAvatar
      let memberPeerId = groupChatMember.memberPeerId
      let linkman = store.state.linkmanMap[memberPeerId]
      if (linkman) {
        if (linkman.avatar) {
          groupChatMemeberAvatar = linkman.avatar
        }
      } else {
        let peerClient = peerClientService.getPeerClientFromCache(memberPeerId)
        if (peerClient && peerClient.avatar) {
          groupChatMemeberAvatar = peerClient.avatar
        }
      }
      return groupChatMemeberAvatar
    }
  },
  async mounted() {
    let _that = this
    let store = _that.$store
    store.handleReadCallback = _that.handleReadCallback
    store.groupMediaSelect = _that.groupMediaSelect
    store.selectedLinkmanCard = _that.selectedLinkmanCard
    store.receiveMergeMessage = _that.receiveMergeMessage
    store.getMessageFile = _that.getMessageFile
    store.getMessageFileAndOpen = _that.getMessageFileAndOpen
    store.collectionPicked = _that.collectionPicked
    store.forwardToChat = _that.forwardToChat
    if (audioInputComponent.audioinput) {
      audioInputComponent.audioinput.stopCallback = function (blob) {
        _that.audioUrl = blob
        _that.captureStatus = false
        _that.audioBlobMessageHandle(blob)
        _that.stopStream()
        _that.audioTouchDialog = false
        clearInterval(_that.mediaTimer);
        _that.mediaTimer = null
      }
    }
    setTimeout(function () {
      if (store.state.chats && store.state.chats.length > 0) {
        _that.$nextTick(() => {
          let container = document.getElementById('#talk')
          if (container) {
            container.scrollTop = container.scrollHeight
          }
        })
      }
    }, 200)
  },
  created() {
    let _that = this
    let store = _that.$store
    store.changeMessageSubKind = function (subKind) {
      _that.subKind = subKind
    }
    Vue.prototype.initSearch = function (searchPrefix, searchText, messageResultList) {
      _that.searchPrefix = searchPrefix
      _that.searchText = searchText
      _that.searchDate = null
      _that.searchSenderPeerId = null
      _that.searchSenderName = null
      _that.messageResultList = messageResultList
      _that.searchableChatContentTypeIndex = 0
      _that.searching = true
    }
    store.saveChatMediaFile = _that.saveChatMediaFile
    //audioCaptureComponent.initialize();
  },
  watch: {
    subKind(val) {
      let _that = this
      let store = _that.$store
      if (store.state.ifMobileStyle) {
        if (store.getDrawer()) {
          /*if (val === 'captureMedia') {
            statusBarComponent.style(false, '#000000')
          } else {
            statusBarComponent.style(true, '#eee')
          }*/
          if (_that.$q.dark.isActive) {
            if (val === 'default') {
              statusBarComponent.style(false, '#2d2d2d')
            } else {
              statusBarComponent.style(false, '#1d1d1d')
            }
          } else {
            if (val === 'default') {
              statusBarComponent.style(true, '#f5f5f5') // grey-2
            } else {
              statusBarComponent.style(true, '#ffffff')
            }
          }
        }
      }
    }
  }
}
