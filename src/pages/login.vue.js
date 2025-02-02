import { colors, Dialog } from 'quasar'
import { required } from 'vuelidate/lib/validators'
import jsQR from 'jsqr'
import jimp from 'jimp'

import { MobileNumberUtil } from 'libcolla'
import { webrtcPeerPool } from 'libcolla'
import { signalProtocol } from 'libcolla'
import { config, myselfPeerService, peerProfileService, ClientDevice, EntityStatus, myself } from 'libcolla'
import { logService } from 'libcolla'
import { pounchDb } from 'libcolla'
import { openpgp } from 'libcolla'

import * as CollaConstant from '@/libs/base/colla-constant'
import pinyinUtil from '@/libs/base/colla-pinyin'
import { cameraComponent, systemAudioComponent } from '@/libs/base/colla-media'
import { deviceComponent, statusBarComponent, simComponent, inAppBrowserComponent } from '@/libs/base/colla-cordova'
import { ContactDataType, LinkmanStatus, ActiveStatus, contactComponent } from '@/libs/biz/colla-contact'
import GetConfigWorker from '@/worker/getConfig.worker.js'

import defaultActiveAvatar from '@/assets/colla-o1.png'
//import defaultDisabledAvatar from '@/assets/colla-o-disabled.png'
//import defaultChannelAvatar from '@/assets/colla-o2.png'
//import defaultChannelArticleCover from '@/assets/cover.png'

export default {
  name: 'Login',
  components: {
  },
  data() {
    return {
      subKind: 'default',
      loginData: {
        countryRegion_: null,
        code_: null,
        mobile_: null,
        password_: null
      },
      registerData: {
        countryRegion_: null,
        code_: null,
        mobile_: null,
        password_: null,
        repeatPassword_: null,
        name_: null
      },
      rules: {
        code_: [{
          required: true,
          message: '[(#{code})]',
          trigger: 'blur'
        }],
        mobile_: [{
          required: true,
          message: '[(#{mobile})]',
          trigger: 'blur'
        }],
        password_: [{
          required: true,
          message: '[(#{password})]',
          trigger: 'blur'
        },
        {
          min: 6,
          message: '[(#{password length})]',
          trigger: 'blur'
        }],
        repeatPassword_: [{
          required: true,
          message: '[(#{repeatPassword})]',
          trigger: 'blur'
        }],
        name_: [{
          required: true,
          message: '[(#{name})]',
          trigger: 'blur'
        }]
      },
      languageOptions: CollaConstant.languageOptions,
      language: null,
      countryOptions: null,
      options: null,
      connectAddressOptions: null,
      connectAddressOptionsISO: {
        'zh-hans' : [],
        'zh-tw' : [],
        'en-us' : [],
        'ja-jp' : [],
        'ko-kr' : [],
      },
      versionHistory: [],
      connectAddress: null,
      customConnectAddress: null,
      light: false,
      bgNo: 11,
      testMode: false
    }
  },
  validations: {
    form: {
      mobile_: {
        required
      },
      password_: {
        required
      }
    }
  },
  methods: {
    filterFnAutoselect(val, update, abort) {
      // call abort() at any time if you can't retrieve data somehow
      setTimeout(() => {
        update(
          () => {
            if (val === '') {
              this.options = this.countryOptions
            } else {
              const needle = val.toLowerCase()
              this.options = this.countryOptions.filter(v => v.toLowerCase().indexOf(needle) > -1)
            }
          },
          // next function is available in Quasar v1.7.4+;
          // "ref" is the Vue reference to the QSelect
          ref => {
            if (val !== '' && ref.options.length > 0 && ref.optionIndex === -1) {
              ref.moveOptionSelection(1, true) // focus the first selectable option and do not update the input-value
              ref.toggleOption(ref.options[ref.optionIndex], true) // toggle the focused option
            }
          }
        )
      }, 300)
    },
    abortFilterFn() {
      // console.log('delayed filter aborted')
    },
    async login(autoLogin) {
      let _that = this
      let store = _that.$store
      while (!store.latestVersion) {
        console.log('sleep 100')
        sleep(100)
      }
      _that.upgradeVersion('login')
      if (store.latestVersion !== store.currentVersion && store.mandatory) {
        return
      }
      if (!autoLogin) {
        let success = await _that.$refs['frmLogin'].validate()
        if (success === false) {
          console.error('validation failure')
          _that.$q.notify({
            message: _that.$i18n.t("Validation failed"),
            timeout: 3000,
            type: "warning",
            color: "warning",
          })
          return
        }
      }
      if (_that.connectAddress === 'custom') {
        store.connectAddress = _that.customConnectAddress
      } else {
        store.connectAddress = _that.connectAddress
      }
      let loginData = {
        code: _that.loginData.code_,
        credential: _that.loginData.mobile_,
        password: _that.loginData.password_
      }
      try {
        await myselfPeerService.login(loginData)
      } catch (e) {
        if (e.message === 'InvalidAccount' || e.message === 'VerifyNotPass') {
          _that.$q.notify({
            message: _that.$i18n.t("Invalid account"),
            timeout: 3000,
            type: "warning",
            color: "warning",
          })
        } else if (e.message === 'WrongPassword') {
          _that.$q.notify({
            message: _that.$i18n.t("Wrong password"),
            timeout: 3000,
            type: "warning",
            color: "warning"
          })
        } else if (e.message === 'AccountNotExists') {
          _that.$q.notify({
            message: _that.$i18n.t("Account does not exist"),
            timeout: 3000,
            type: "warning",
            color: "warning",
          })
        } else if (e.message === 'InvalidMobileNumber') {
          _that.$q.notify({
            message: _that.$i18n.t("Invalid mobile number"),
            timeout: 3000,
            type: "warning",
            color: "warning",
          })
        } else {
          alert(e)
          await logService.log(e, 'loginError', 'error')
        }
        return
      }
      if (!myself) {
        console.error('login failure')
        _that.$q.notify({
          message: _that.$i18n.t("Login failed"),
          timeout: 3000,
          type: "warning",
          color: "warning",
        })
        return
      }
      await _that.initSignalProtocol(_that.loginData.mobile_)
      myselfPeerService.setMyselfPeerClient(myself.myselfPeer, myself.peerProfile)
      store.state.myselfPeerClient = myself.myselfPeerClient
      // 登录后初始化设置
      if (myself.peerProfile) {
        myself.peerProfile.deviceToken = store.deviceToken
        if (myself.peerProfile.language) {
          _that.language = myself.peerProfile.language
        }
        if (myself.peerProfile.lightDarkMode === 'true') {
          _that.$q.dark.set(true)
        } else if (myself.peerProfile.lightDarkMode === 'false') {
          _that.$q.dark.set(false)
        } else if (myself.peerProfile.lightDarkMode === 'auto') {
          _that.$q.dark.set('auto')
        }
        if (myself.peerProfile.primaryColor) {
          colors.setBrand('primary', myself.peerProfile.primaryColor)
        }
        if (myself.peerProfile.secondaryColor) {
          colors.setBrand('secondary', myself.peerProfile.secondaryColor)
        }
        if (myself.peerProfile.logLevel) {
          logService.setLogLevel(myself.peerProfile.logLevel)
        }
      }
      // save login time
      myself.myselfPeer.updateDate = new Date().getTime()
      // save loginStatus and password if switch on for mobile device
      if (store.ifMobile() && myself.peerProfile.autoLoginSwitch === true) {
        myself.myselfPeer.loginStatus = 'Y'
        myself.myselfPeer.password = openpgp.encodeBase64(myself.password)
      }
      await myselfPeerService.update(myself.myselfPeer)
      // 跳转页面
      _that.$router.push('/blockChain/chat')
    },
    async initSignalProtocol(name){
      let _that = this
      let myselfPeer = myself.myselfPeer
      if(!myselfPeer.signalPrivateKey){
        await signalProtocol.init()
        myselfPeer.signalPrivateKey = await signalProtocol.export(_that.loginData.password_)
        myselfPeer.signalPublicKey = await signalProtocol.exportPublic(name)
        await myselfPeerService.update(myselfPeer)
      }else{
        await signalProtocol.import(myselfPeer.signalPrivateKey,_that.loginData.password_)
      }
    },
    upload: function (files) {
      let _that = this
      let store = _that.$store
      let file = files[0]
      let reader = new FileReader()
      reader.onload = function (e) {
        let base64 = e.target.result
        console.log('base64:' + base64)
        jimp.read(base64).then(async (res) => {
          const { data, width, height } = res.bitmap
          try {
            const resolve = await jsQR(data, width, height, { inversionAttempts: 'dontInvert' })
            if (resolve && resolve.data) {
              systemAudioComponent.scanAudioPlay()
              await _that.importID(resolve.data)
            }
          } catch (err) {
            console.error(err)
            _that.$q.notify({
              message: _that.$i18n.t('Failed to read the qr code'),
              timeout: 3000,
              type: "warning",
              color: "warning",
            })
          }
        })
      }
      reader.readAsDataURL(file)
      _that.$refs.upload.reset()
    },
    async importID(json) {
      let _that = this
      let store = _that.$store
      try {
        await myselfPeerService.importID(json)
        //添加自己到联系人
        let newLinkman = {}
        newLinkman.ownerPeerId = myself.myselfPeer.peerId
        newLinkman.peerId = myself.myselfPeer.peerId
        newLinkman.name = myself.myselfPeer.name
        newLinkman.pyName = pinyinUtil.getPinyin(myself.myselfPeer.name)
        //newLinkman.givenName = newLinkman.name
        //newLinkman.pyGivenName = newLinkman.pyName
        newLinkman.mobile = myself.myselfPeer.mobile
        newLinkman.avatar = myself.peerProfile.avatar
        newLinkman.publicKey = myself.myselfPeer.publicKey
        newLinkman.sourceType = ''
        newLinkman.createDate = myself.myselfPeer.createDate
        newLinkman.statusDate = myself.myselfPeer.createDate
        newLinkman.status = LinkmanStatus.EFFECTIVE
        newLinkman.activeStatus = ActiveStatus.UP
        newLinkman.locked = false
        newLinkman.notAlert = false
        newLinkman.top = false
        await contactComponent.insert(ContactDataType.LINKMAN, newLinkman, store.state.linkmans)

        let mobile = myself.myselfPeer.mobile
        if (mobile) {
          let mobileObject = MobileNumberUtil.parse(mobile)
          _that.loginData.code_ = mobileObject.getCountryCode() + ''
          _that.loginData.mobile_ = mobileObject.getNationalNumber() + ''
          _that.loginData.countryRegion_ = _that.options[CollaConstant.countryCodeISO[_that.language].indexOf(_that.loginData.code_)]
          _that.$q.notify({
            message: _that.$i18n.t("Import successfully"),
            timeout: 3000,
            type: "info",
            color: "info",
          })
        }
      } catch (e) {
        if (e.message === 'InvalidID') {
          _that.$q.notify({
            message: _that.$i18n.t("Invalid account"),
            timeout: 3000,
            type: "warning",
            color: "warning",
          })
        } else if (e.message === 'AccountExists') {
          _that.$q.notify({
            message: _that.$i18n.t("Account already exists"),
            timeout: 3000,
            type: "warning",
            color: "warning",
          })
        } else {
          alert(e)
          await logService.log(e, 'importIDError', 'error')
        }
      }
    },
    changeBackground() {
      let count = 12
      if (this.bgNo === count) {
        this.bgNo = 1
      } else {
        this.bgNo++
      }
    },
    async register() {
      let _that = this
      let store = _that.$store
      let success = await _that.$refs['frmRegister'].validate()
      if (success === false) {
        console.error('validation failure')
        _that.$q.notify({
          message: _that.$i18n.t("Validation failed"),
          timeout: 3000,
          type: "warning",
          color: "warning",
        })
        return
      }
      let registerData = {
        name: _that.registerData.name_,
        password: _that.registerData.password_,
        confirmPassword: _that.registerData.repeatPassword_,
        mobile: _that.registerData.mobile_,
        countryRegion: _that.registerData.countryRegion_,
        code: _that.registerData.code_
      }
      try {
        await myselfPeerService.register(registerData)
      } catch (e) {
        if (e.message === 'ErrorPassword') {
          _that.$q.notify({
            message: _that.$i18n.t("Inconsistent passwords"),
            timeout: 3000,
            type: "warning",
            color: "warning",
          })
        } else if (e.message === 'AccountExists') {
          _that.$q.notify({
            message: _that.$i18n.t("Account already exists"),
            timeout: 3000,
            type: "warning",
            color: "warning",
          })
        } else if (e.message === 'InvalidMobileNumber') {
          _that.$q.notify({
            message: _that.$i18n.t("Invalid mobile number"),
            timeout: 3000,
            type: "warning",
            color: "warning",
          })
        } else {
          alert(e)
          await logService.log(e, 'registerError', 'error')
        }
        return
      }
      if (!myself) {
        console.error('registration failure')
        _that.$q.notify({
          message: _that.$i18n.t("Registration failed"),
          timeout: 3000,
          type: "warning",
          color: "warning",
        })
        return
      }
      console.log(myself)
      //添加自己到联系人
      let newLinkman = {}
      newLinkman.ownerPeerId = myself.myselfPeer.peerId
      newLinkman.peerId = myself.myselfPeer.peerId
      newLinkman.name = myself.myselfPeer.name
      newLinkman.pyName = pinyinUtil.getPinyin(myself.myselfPeer.name)
      //newLinkman.givenName = newLinkman.name
      //newLinkman.pyGivenName = newLinkman.pyName
      newLinkman.mobile = myself.myselfPeer.mobile
      newLinkman.avatar = myself.myselfPeer.avatar
      newLinkman.publicKey = myself.myselfPeer.publicKey
      newLinkman.sourceType = ''
      newLinkman.createDate = myself.myselfPeer.createDate
      newLinkman.statusDate = myself.myselfPeer.createDate
      newLinkman.status = LinkmanStatus.EFFECTIVE
      newLinkman.activeStatus = ActiveStatus.UP
      newLinkman.locked = false
      newLinkman.notAlert = false
      newLinkman.top = false
      newLinkman.recallTimeLimit = true
      newLinkman.recallAlert = true
      await contactComponent.insert(ContactDataType.LINKMAN, newLinkman, store.state.linkmans)
      _that.loginData.countryRegion_ = _that.registerData.countryRegion_
      _that.loginData.code_ = _that.registerData.code_
      _that.loginData.mobile_ = _that.registerData.mobile_
      _that.loginData.password_ = _that.registerData.password_
      _that.subKind = 'default'
    },
    enterScan() {
      let _that = this
      let store = _that.$store
      if (store.ifMobile()) {
        _that.scanSwitch(true)
        //store.toggleDrawer(false) // no need to call because no change
        //statusBarComponent.style(false, '#33000000')
        //document.querySelector("body").classList.remove('bgc')
      } else {
        _that.$refs.upload.pickFiles()
      }
    },
    toggleLight() {
      try {
        if (!this.light) {
          QRScanner.enableLight((err, status) => {
            err && console.log("[Scan.enableLight.error] " + JSON.stringify(err))
            console.log("[Scan.enableLight.status] " + JSON.stringify(status))
          })
        } else {
          QRScanner.disableLight((err, status) => {
            err && console.log("[Scan.disableLight.error] " + JSON.stringify(err))
            console.log("[Scan.disableLight.status] " + JSON.stringify(status))
          })
        }
      } catch (e) {
        console.error("[Scan.toggleLight.error] " + JSON.stringify(e))
        return
      }
      this.light = !this.light
    },
    scanBack() {
      let _that = this
      let store = _that.$store
      _that.scanSwitch(false)
      /*if (store.state.ifMobileStyle) {
        //statusBarComponent.style(true, '#eee')
        if (_that.$q.dark.isActive) {
          statusBarComponent.style(true, rgba(0, 0, 0, .2))
        } else {
          statusBarComponent.style(true, rgba(255, 255, 255, .2))
        }
      }
      if (store.state.ifMobileStyle) {
        document.querySelector("body").classList.add('bgc')
      }*/
    },
    scanPhoto() {
      let _that = this
      let store = _that.$store
      let params = null //{ targetHeight: 256, targetWidth: 256 }
      cameraComponent.getPicture(Camera.PictureSourceType.SAVEDPHOTOALBUM, params).then(function (imageUri) {
        let base64 = 'data:image/jpeg;base64,' + imageUri
        console.log('base64:' + imageUri)
        jimp.read(base64).then(async (res) => {
          const { data, width, height } = res.bitmap
          try {
            const resolve = await jsQR(data, width, height, { inversionAttempts: 'dontInvert' })
            if (resolve && resolve.data) {
              systemAudioComponent.scanAudioPlay()
              _that.scanSwitch(false)
              /*if (store.state.ifMobileStyle) {
                document.querySelector("body").classList.add('bgc')
              }*/
              await _that.importID(resolve.data)
            }
          } catch (err) {
            console.error(err)
            _that.$q.notify({
              message: _that.$i18n.t('Failed to read the qr code'),
              timeout: 3000,
              type: "warning",
              color: "warning",
            })
          }
        })
      })
    },
    scanSwitch(ifScan) {
      let _that = this
      let store = _that.$store
      if (ifScan) {
        try {
          QRScanner.prepare(status => {
            console.log("[Scan.prepare.status] " + JSON.stringify(status))
            if (!status.authorized || status.denied) {
              alert("[Scan.scan.error] " + JSON.stringify(e))
              alert('Access Failed', 'Camera access is not authorized or denied, please grant access in Settings.', () => {
                QRScanner.openSettings()
              })
              return
            }
          })
          QRScanner.show(status => {
            console.log("[Scan.show.status] " + JSON.stringify(status))
          })
          QRScanner.scan(async (err, contents) => {
            if (err) {
              alert("[Scan.scan.error] " + JSON.stringify(e))
            } else {
              //alert("[Scan.scan.contents] " + contents)
              systemAudioComponent.scanAudioPlay()
              _that.scanSwitch(false)
              /*if (store.state.ifMobileStyle) {
                document.querySelector("body").classList.add('bgc')
              }*/
              await _that.importID(contents)
            }
          })
        } catch (e) {
          console.error("[Scan.scanOn.error] " + JSON.stringify(e))
        }
      } else {
        try {
          QRScanner.hide(status => {
            console.log("[Scan.hide.status] " + JSON.stringify(status))
          })
          QRScanner.destroy(function (status) {
            console.log("[Scan.destroy.status] " + JSON.stringify(status))
          })
        } catch (e) {
          console.error("[Scan.scanOff.error] " + JSON.stringify(e))
        }
      }
      store.state.ifScan = ifScan
    },
    getAddressLabel(address) {
      let _that = this
      let label = ''
      for (let connectAddressOption of _that.connectAddressOptions) {
        if (connectAddressOption.value === address) {
          label = connectAddressOption.label
          break
        }
      }
      if (!label) {
        label = _that.$i18n.t("Use Custom Node") + ' (' + address + ')'
      }
      return label
    },
    checkVersion(currentVersion, version) {
      currentVersion = currentVersion ? currentVersion.replace(/[vV]/, "") : "0.0.0"
      version = version ? version.replace(/[vV]/, "") : "0.0.0"
      if (currentVersion === version) {
        return false
      }
      let currentVerArr = currentVersion.split(".")
      let verArr = version.split(".")
      let len = Math.max(currentVerArr.length, verArr.length)
      for (let i = 0; i < len; i++) {
          let currentVer = ~~currentVerArr[i]
          let ver = ~~verArr[i]
          if (currentVer < ver) {
              return true
          }
      }
      return false
    },
    versionUpdate() {
      let _that = this
      let store = _that.$store
      if (store.ios === true) {
        let inAppBrowser = inAppBrowserComponent.open('https://apps.apple.com/cn/app/collachat/id1546363298', '_system', 'location=no')
      } else if (store.android === true) {
        let inAppBrowser = inAppBrowserComponent.open('https://curltech.io/#/CollaChatDownload', '_system', 'location=no')
      } else if (store.safari === true) {
        window.open('https://apps.apple.com/cn/app/collachat/id1546363298', '_system')
      } else {
        window.open('https://curltech.io/#/CollaChatDownload', '_system')
      }
    },
    upgradeVersion(flag) {
      let _that = this
      let store = _that.$store
      store.currentVersion = '0.2.68'
      store.mandatory = false
      if (_that.versionHistory && _that.versionHistory.length > 0) {
        let no = 1
        for (let version of _that.versionHistory) {
          if (_that.checkVersion(store.currentVersion, version)) {
            if (no === 1) {
              store.latestVersion = version.replace(/[vV]/, "")
            }
            if (version.substring(0, 1) === 'V') {
              store.mandatory = true
              break
            }
          } else {
            break
          }
          no++
        }
        if (!store.latestVersion) {
          store.latestVersion = store.currentVersion
        }
        console.log('currentVersion:' + store.currentVersion + ',latestVersion:' + store.latestVersion + ',mandatory:' + store.mandatory)
        if (store.latestVersion !== store.currentVersion) {
          if (flag === 'start' || (flag === 'login' && store.mandatory)) {
            Dialog.create({
              title: _that.$i18n.t('Alert'),
              message: store.mandatory ? _that.$i18n.t('Please upgrade to the new version!') : _that.$i18n.t('There is a new version available, upgrade now?'),
              cancel: store.mandatory ? false : {"label":_that.$i18n.t('Cancel'),"color":"primary","unelevated":true,"no-caps":true},
              ok: {"label":_that.$i18n.t('Ok'),"color":"primary","unelevated":true,"no-caps":true},
              persistent: true
            }).onOk(() => {
              _that.versionUpdate()
            }).onCancel(() => {
            })
          }
        }
      }
    },
    initGetConfigWorker(configItem) {
      let _that = this
      let store = _that.$store
      let worker = new GetConfigWorker()
      worker.onerror = function (event) {
        console.log('getConfig worker error:' + event.data)
      }
      worker.onmessageerror = function (event) {
        console.log('getConfig worker message error:' + event.data)
      }
      worker.onmessage = async function (event) {
        console.log('receive getConfig worker return message:' + event.data)
        let response = event.data
        if (configItem === 'nodeList') {
          if (response) {
            _that.connectAddressOptionsISO = response
          } else {
            _that.connectAddressOptionsISO = CollaConstant.connectAddressOptionsISO
          }
          _that.connectAddressOptions = _that.connectAddressOptionsISO[_that.language]
          console.log('connectAddressOptionsISO:' + JSON.stringify(_that.connectAddressOptionsISO))
        } else if (configItem === 'versionHistory') {
          if (response) {
            _that.versionHistory = response
          } else {
            _that.versionHistory = [store.currentVersion]
          }
          console.log('versionHistory:' + JSON.stringify(_that.versionHistory))
          _that.upgradeVersion('start')
        }
      }
      return worker
    },
    async startup() {
      let _that = this
      let store = _that.$store
      store.ifMobile = function () {
        return window.device && (window.device.platform === 'Android' || window.device.platform === 'iOS')
      }
      config.appParams.clientType = window.device ? deviceComponent.getDeviceProperty('manufacturer') + '(' + deviceComponent.getDeviceProperty('model') + ')' : 'PC'
      config.appParams.clientDevice = store.ifMobile() ? ClientDevice.MOBILE : ClientDevice.DESKTOP
      store.chrome = _that.$q.platform.is.chrome
      store.safari = _that.$q.platform.is.safari
      if (window.device) {
        document.addEventListener('deviceready', async function () {
          store.ios = _that.$q.platform.is.ios
          store.android = _that.$q.platform.is.android
          // Just for iOS devices.
          if (window.device.platform === 'iOS') {
            let cordova = window.cordova
            if (cordova && cordova.plugins && cordova.plugins.iosrtc) {
              cordova.plugins.iosrtc.registerGlobals()
              // Enable iosrtc debug (Optional)
              //cordova.plugins.iosrtc.debug.enable('*', true)
            }
          }
          if ((_that.$q.screen.width < 481 || _that.$q.screen.height < 481) && (window.device.platform === 'Android' || window.device.platform === 'iOS')) {
            deviceComponent.lockScreen('portrait')
          }
          store.state.ifMobileStyle = (_that.$q.screen.width < 481 || _that.$q.screen.height < 481) || ((window.device.platform === 'Android' || window.device.platform === 'iOS') && screen.orientation.type.substring(0, 8) === 'portrait')
          deviceComponent.registScreenChange(function () {
            store.state.ifMobileStyle = (_that.$q.screen.width < 481 || _that.$q.screen.height < 481) || ((window.device.platform === 'Android' || window.device.platform === 'iOS') && screen.orientation.type.substring(0, 8) === 'portrait')
          })
          /*if (window.device.platform === 'iOS') {
            document.body.addEventListener('touchmove', function (e) {
              e.preventDefault() // 阻止默认的处理方式（iOS有下拉滑动的效果）
            }, { passive: false }) // passive参数用于兼容iOS和Android
          }*/
          if (window.device.platform === 'Android') {
            statusBarComponent.show(false)
          } else {
            //statusBarComponent.show(true)
            statusBarComponent.show(false) // 因为有背景图，不覆盖状态栏
          }
          statusBarComponent.style(false, '#33000000')
          // 如本机是手机设备，获取本机号码
          let countryCode = ''
          let phoneNumber = ''
          let simPermission = true
          if (window.device.platform === 'Android') {
            simPermission = await simComponent.hasReadPermission()
            console.info(simPermission)
            if (!simPermission) {
              simPermission = await simComponent.requestReadPermission()
              console.info(simPermission)
            }
          }
          if (simPermission) {
            try {
              let sim = await simComponent.getSimInfo()
              console.info(sim)
              if (sim && sim.countryCode) {
                countryCode = sim.countryCode
                if (sim.phoneNumber) {
                  phoneNumber = sim.phoneNumber
                }
              }
            } catch (e) {
              await logService.log(e, 'getSimInfoError', 'error')
            }
          }
          if (countryCode) {
            console.log('countryCode:' + countryCode)
            _that.loginData.code_ = MobileNumberUtil.getCountryCodeForRegion(countryCode.toUpperCase()) + ''
            if (!_that.registerData.code_) {
              _that.registerData.code_ = _that.loginData.code_
            }
            if (phoneNumber) {
              let mobile = MobileNumberUtil.formatE164(phoneNumber, countryCode.toUpperCase())
              let nationalNumber = MobileNumberUtil.parse(mobile).getNationalNumber() + ''
              console.log('mobile1:' + nationalNumber)
              if (pcs && pcs.length > 0) {
                for (let pc of pcs) {
                  if (pc.mobile === mobile) {
                    myselfPeer = pc
                    _that.loginData.mobile_ = nationalNumber
                    break
                  }
                }
              }
              if (!_that.registerData.mobile_) {
                _that.registerData.mobile_ = nationalNumber
              }
            }
          }
          
          if (store.ios === true) {
            // havesource/cordova-plugin-push
            if (PushNotification) {
              const push = PushNotification.init({
                android: {
                },
                browser: {
                    pushServiceURL: 'http://push.api.phonegap.com/v1/push'
                },
                ios: {
                  alert: "true",
                  badge: "false",
                  sound: "true"
                },
                windows: {}
              })
              push.on('registration', (data) => {
                // data.registrationId
                console.log('push-registration', data)
                if (data) {
                  store.deviceToken = data.registrationId
                }
              })
              push.on('notification', (data) => {
                // data.message,
                // data.title,
                // data.count,
                // data.sound,
                // data.image,
                // data.additionalData
                console.log('push-notification', data)
              })
              push.on('error', (e) => {
                // e.message
                console.error('push-error', e)
              })
            }
          } else if (store.android === true) {
            let clientType = config.appParams.clientType
            let prefixArr = []
            if (clientType) {
              prefixArr = clientType.split('(')
            }
            // cordova-plugin-hms-push
            if (prefixArr[0] === 'HUAWEI') {
              if (HmsPush) {
                HmsPush.init()
                HmsPush.getToken()
                .then((result) => {
                  console.log("hms getToken result", result)
                  store.deviceToken = result
                })
                .catch((error) => {
                  console.error("hms getToken error", error)
                })
                HmsPushEvent.onTokenReceived((ret) => {
                  if (ret) {
                    console.log('hms onTokenReceived', ret.token)
                    store.deviceToken = ret.token
                  }
                })
              }
            } else if (prefixArr[0] === 'Xiaomi') {
              xiaomiPush.register(function(token) {
                console.log('Xiaomi push register token', token)
                store.deviceToken = token
              }, function(err) {
                console.error('Xiaomi push register error', err)
              }, [])
              xiaomiPush.onNewToken(function(token) {
                console.log('Xiaomi push onNewToken token', token) // 会多次接收到token
                store.deviceToken = token
              })
              document.addEventListener("messageReceived", function(result) {
                console.log('Xiaomi push messageReceived', result)
              }, false)
            } else if (prefixArr[0] === 'OPPO') {
              oppoPush.register(function(token) {
                console.log('OPPO push register token', token)
                store.deviceToken = token
              }, function(err) {
                console.error('OPPO push register error', err)
              }, [])
              oppoPush.onNewToken(function(token) {
                console.log('OPPO push onNewToken token', token) // 会多次接收到token
                store.deviceToken = token
              })
              document.addEventListener("messageReceived", function(result) {
                console.log('OPPO push messageReceived', result)
              }, false)
            } else if (prefixArr[0] === 'VIVO') {

            } else {
              // GCM
              // URORA
            }
          }
        })
      }
      if (!store.defaultActiveAvatar) {
        //store.defaultActiveAvatar = defaultActiveAvatar // ios does not support well
        console.log('defaultActiveAvatar:' + defaultActiveAvatar)
        store.defaultActiveAvatar = 'data:image/png;base64,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'
      }
      if (!store.defaultDisabledAvatar) {
        //store.defaultDisabledAvatar = defaultDisabledAvatar // ios does not support well
        store.defaultDisabledAvatar = 'data:image/png;base64,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'
      }
      if (!store.defaultChannelAvatar) {
        //store.defaultChannelAvatar = defaultChannelAvatar // ios does not support well
        store.defaultChannelAvatar = 'data:image/png;base64,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'
      }
      if (!store.defaultChannelArticleCover) {
        //store.defaultChannelArticleCover = defaultChannelArticleCover // ios does not support well
        store.defaultChannelArticleCover = 'data:image/png;base64,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'
      }
      store.connectAddressOptions = _that.connectAddressOptions
      store.getAddressLabel = _that.getAddressLabel
      store.upgradeVersion = _that.upgradeVersion
      store.versionUpdate = _that.versionUpdate
      store.latestVersion = null
      let configItem = 'nodeList'
      let worker = _that.initGetConfigWorker(configItem)
      worker.postMessage(configItem + 'ISO')
      configItem = 'versionHistory'
      worker = _that.initGetConfigWorker(configItem)
      let type = 'others'
      if (store.ios === true) {
        type = 'ios'
      } else if (store.android === true) {
        type = 'android'
      } else if (store.safari === true) {
        type = 'safari'
      }
      console.log('type:' + type)
      worker.postMessage(configItem + '-' + type)

      // 查询本地身份记录
      let myselfPeer = null
      let condition = {}
      condition['status'] = EntityStatus[EntityStatus.Effective]
      condition['updateDate'] = { $gt: null }
      let pcs = await myselfPeerService.find(condition, [{ updateDate: 'desc' }], null)
      if (!myselfPeer && pcs && pcs.length > 0) {
        myselfPeer = pcs[0]
      }
      let peerProfile = null
      if (myselfPeer) {
        let condition = {}
        condition['peerId'] = myselfPeer.peerId
        peerProfile = await peerProfileService.findOne(condition, null, null)
        if (peerProfile) {
          if (peerProfile.lightDarkMode === 'true') {
            _that.$q.dark.set(true)
          } else if (peerProfile.lightDarkMode === 'false') {
            _that.$q.dark.set(false)
          } else if (peerProfile.lightDarkMode === 'auto') {
            _that.$q.dark.set('auto')
          }
          if (peerProfile.primaryColor) {
            colors.setBrand('primary', peerProfile.primaryColor)
          }
          if (peerProfile.secondaryColor) {
            colors.setBrand('secondary', peerProfile.secondaryColor)
          }
        }
        if (myselfPeer.mobile && !_that.loginData.mobile_) {
          try {
            let mobileObject = MobileNumberUtil.parse(myselfPeer.mobile)
            _that.loginData.code_ = mobileObject.getCountryCode() + ''
            if (!_that.registerData.code_) {
              _that.registerData.code_ = _that.loginData.code_
            }
            _that.loginData.mobile_ = mobileObject.getNationalNumber() + ''
            console.log('mobile2:' + _that.loginData.mobile_)
          } catch (e) {
            console.error(e)
          }
        }
      }
      if (!_that.loginData.code_) {
        _that.loginData.code_ = '86'
        if (!_that.registerData.code_) {
          _that.registerData.code_ = _that.loginData.code_
        }
      }
      // 在区号已设置后、设置语言（根据区号和语言设置国家地区）
      if (peerProfile && peerProfile.language) {
        _that.language = peerProfile.language
      } else if (_that.$i18n.locale) {
        _that.language = _that.$i18n.locale
        console.log('system default $i18n.locale:' + _that.$i18n.locale)
      } else {
        _that.language = 'en-us'
      }
      config.appParams.language = _that.language

      // auto login for mobile device
      if (store.ifMobile()) {
        if (myselfPeer && myselfPeer.loginStatus === 'Y' && myselfPeer.password) {
          _that.loginData.password_ = openpgp.uint8ArrayToStr(openpgp.decodeBase64(myselfPeer.password))
          await _that.login(true)
        }
      }
    },
    switchTestMode() {
      let _that = this
      _that.testMode = !_that.testMode
    },
    async testQueryDB() {
      let _that = this
      let loginData = _that.loginData
      let code_ = loginData.code_
      let mobile_ = loginData.mobile_
      let mobile = null
      if (code_ && mobile_) {
        let isPhoneNumberValid = false
        try {
          isPhoneNumberValid = MobileNumberUtil.isPhoneNumberValid(mobile_, MobileNumberUtil.getRegionCodeForCountryCode(code_))
        } catch (e) {
          alert(e)
        }
        if (!isPhoneNumberValid) {
          alert('InvalidMobileNumber')
        }
        mobile = MobileNumberUtil.formatE164(mobile_, MobileNumberUtil.getRegionCodeForCountryCode(code_))
      }
      let condition = { status: EntityStatus[EntityStatus.Effective] }
      if (mobile) {
        condition.mobile = mobile
      }
      try {
        let myselfPeer = await myselfPeerService.findOne(condition, null, null)
        if (!myselfPeer) {
          alert('AccountNotExists')
        } else {
          alert(JSON.stringify(myselfPeer))
        }
      } catch (e) {
        alert(e)
      }
    },
    async testDropDB() {
      try {
        await pounchDb.drop('blc_myselfPeer')
      } catch (e) {
        alert(e)
      }
    },
    async testRecreateDB() {
      try {
        await pounchDb.create('blc_myselfPeer', ['endDate', 'peerId', 'mobile', 'status', 'updateDate'], null)
      } catch (e) {
        alert(e)
      }
    }
  },
  computed: {
    ifMobileSize() {
      return (!window.device && this.$q.screen.width < 481)
    },
    cardStyle() {
      return {
        width: `${this.ifMobileSize || this.$store.state.ifMobileStyle ? this.$q.screen.width : 414}px`
      }
    },
    loginDataCountryRegion() {
      return this.loginData.countryRegion_
    },
    registerDataCountryRegion() {
      return this.registerData.countryRegion_
    },
    layoutStyle() {
      if (this.$store.state.ifScan) {
        return ''
      } else {
        let name = (this.$q.dark.isActive ? 'wd-' : 'wl-') + this.bgNo
        return 'background:url("login-bg-' + name + '.jpg") no-repeat center; background-size: cover;'
      }
    }
  },
  mounted() {
    let _that = this
    let store = _that.$store
    if (store.state.myselfPeerClient) {
      store.commit('resetState')
      store.state.myselfPeerClient = null
      store.state.currentChat = null
      //reset webrtc
      webrtcPeerPool.clear()
      //reset signalSession
      signalProtocol.clear()
    }
  },
  async created() {
    let _that = this
    let store = _that.$store
    await _that.startup()
  },
  watch: {
    loginDataCountryRegion(val) {
      if (val) {
        this.loginData.code_ = val.substring(val.indexOf('+', 0) + 1, val.indexOf(')', 0))
      }
    },
    registerDataCountryRegion(val) {
      if (val) {
        this.registerData.code_ = val.substring(val.indexOf('+', 0) + 1, val.indexOf(')', 0))
      }
    },
    async language(val) {
      if (!this.loginData.code_ || CollaConstant.countryCodeISO[this.$i18n.locale].indexOf(this.loginData.code_) === -1) {
        if (this.loginData.countryRegion_) {
          this.loginData.code_ = CollaConstant.countryCodeISO[this.$i18n.locale][CollaConstant.countryOptionsISO[this.$i18n.locale].indexOf(this.loginData.countryRegion_)]
        }
      }
      if (!this.registerData.code_ || CollaConstant.countryCodeISO[this.$i18n.locale].indexOf(this.registerData.code_) === -1) {
        if (this.registerData.countryRegion_) {
          this.registerData.code_ = CollaConstant.countryCodeISO[this.$i18n.locale][CollaConstant.countryOptionsISO[this.$i18n.locale].indexOf(this.registerData.countryRegion_)]
        }
      }
      this.$i18n.locale = val
      this.countryOptions = CollaConstant.countryOptionsISO[val]
      this.options = this.countryOptions
      this.loginData.countryRegion_ = this.options[CollaConstant.countryCodeISO[val].indexOf(this.loginData.code_)]
      this.registerData.countryRegion_ = this.options[CollaConstant.countryCodeISO[val].indexOf(this.registerData.code_)]
      this.connectAddressOptions = this.connectAddressOptionsISO[val]
    }
  }
}
