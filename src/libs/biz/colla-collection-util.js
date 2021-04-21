import { EntityState } from 'libcolla'
import { CollaUtil, TypeUtil, BlobUtil } from 'libcolla'
import { myself, consensusAction, DataBlockService, dataBlockService, BlockType, MsgType } from 'libcolla'
import { pounchDb } from 'libcolla'

import pinyinUtil from '@/libs/base/colla-pinyin'
import { mediaComponent, audioMediaComponent } from '@/libs/base/colla-media'
import { fileComponent } from '@/libs/base/colla-cordova'
import { collectionComponent, CollectionType} from '@/libs/biz/colla-collection'

/**
 * message和collection复用功能
 */
 export class CollectionUtil {
  constructor() {
	}
  async buildAttachs(collectionId, files, thumbnails) {
    let attachs = []
    let i = 0
    for (let file of files) {
      let thumbnail = thumbnails ? thumbnails[i] : null
      let attach = await this.buildAttach(collectionId, file, thumbnail)
      attachs.push(attach)
      i++
    }
    return attachs
  }
  async buildAttach(collectionId, file, thumbnail) {
    let attach = { state: EntityState.New }
    attach['collectionId'] = collectionId
    let type = null
    if (TypeUtil.isString(file)) {
      let prefix = file.substr(0, 5)
      if (prefix === 'blob:' || prefix === 'http:') {
        file = await BlobUtil.urlToBlob(file)
        type = file.type
      } else {
        type = file.match(/:(.*?);/)[1]
      }
    } else {
      type = file.type
    }
    attach['mimeType'] = type
    attach['name'] = file.name
    if (TypeUtil.isString(file)) {
      attach['content'] = file
    } else if (file.type.substr(0, 4) === 'text') {
      let text = await BlobUtil.blobToBase64(file, { type: 'text' })
      attach['content'] = text
    } else {
      let base64 = await BlobUtil.blobToBase64(file)
      attach['content'] = base64
      attach['size'] = file.size
    }
    attach['createDate'] = new Date()
    if (thumbnail) {
      attach['thumbnail'] = thumbnail
    }

    return attach
  }
  // 设置预览封面信息
  async setCollectionPreview(current) {
    let currentThumbType = null
    let currentThumbnail = null
    let contentTitle = ''
    let contentBody = ''
    let currentFirstFileInfo = ''
    let currentFirstAudioDuration = 0
    let contentIVAmount = 0
    let contentAAmount = 0
    let contentOAmount = 0
    let content = current['content']
    if (content) {
      let plainContent = content.replace(/<[^>]+>/g, '').replace(/^\s*/g, '')
      if (plainContent) {
        let firstChar = plainContent.substring(0, 1)
        let firstCharPos = content.indexOf(firstChar)
        while (firstCharPos > -1 && firstCharPos < content.length - 1 && content.substring(firstCharPos - 1, firstCharPos) === '<') {
          firstCharPos = content.substring(firstCharPos + 1).indexOf(firstChar)
        }
        const tagArr = ['</p>', '</li>']
        let tagPosArr = [2]
        for (let i = 0; i < tagArr.length; i++) {
          tagPosArr[i] = content.substring(firstCharPos).indexOf(tagArr[i])
        }
        tagPosArr.sort(function (a, b) {
          return a - b
        })
        let minTagPos = -1
        for (let i = 0; i < tagPosArr.length; i++) {
          if (tagPosArr[i] > -1) {
            minTagPos = tagPosArr[i]
            break
          }
        }
        if (minTagPos > -1) {
          minTagPos = minTagPos + firstCharPos
          contentTitle = content.substring(firstCharPos, minTagPos).replace(/<[^<>]+>/g, '').replace(/\s*$/g, '')
          contentBody = content.substring(minTagPos).replace(/<[^>]+>/g, '').replace(/^\s*|\s*$/g, '')
        }
      }

      // 查找mediaTag
      //let reg = new RegExp("(<img.*src=\"\.*?\>)")
      //let mediaTag = content.match(reg)
      // 查找mediaSrc
      let re = /src="([^"]*)"/g
      let arr
      while (arr = re.exec(content)) {
        let src = arr[1]
        if (src) {
          let type = null
          let thumbnail = null
          if (src.substring(0, 10) === 'data:image') { // src可能是链接、不是base64
            type = 'image'
            if (!currentThumbnail) {
              thumbnail = src
              let blob = BlobUtil.base64ToBlob(src)
              let size = blob.size
              if (size > 20480) {
                let compressedBlob = await mediaComponent.compress(blob)
                thumbnail = await BlobUtil.blobToBase64(compressedBlob)
              }
            }
          } else if (src.substring(0, 10) === 'data:video') {
            type = 'video'
            if (!currentThumbnail) {
              thumbnail = await mediaComponent.createVideoThumbnailByBase64(src)
            }
          } else if (src.substring(0, 10) === 'data:audio') {
            type = 'audio'
            if (currentFirstAudioDuration == 0) {
              if (window.device && (window.device.platform === 'Android' || window.device.platform === 'iOS')) {
                let dirEntry = await fileComponent.getRootDirEntry('tmp')
                let dirPath = dirEntry.toInternalURL()
                let fileName = current['_id'] + 'firstAudio' + '.' + src.substring(11, src.indexOf(';', 11))
                let localURL = dirEntry.toInternalURL() + fileName
                let fileEntry = await fileComponent.createNewFileEntry(fileName, dirPath)
                let blob = BlobUtil.base64ToBlob(src)
                await fileComponent.writeFile(fileEntry, blob, false).then(async function () {
                  let audioMedia = audioMediaComponent.create(localURL)
                  audioMediaComponent.play(audioMedia)
                  let counter = 0
                  while (currentFirstAudioDuration === 0 && counter < 5) {
                    let dur = await audioMediaComponent.getDurationAsync(audioMedia)
                    console.log(new Date().getTime() + '-getDuration-' + counter + '-' + dur)
                    if (dur > 0) {
                      currentFirstAudioDuration = dur
                    }
                    counter++
                  }
                  audioMediaComponent.stop(audioMedia)
                  audioMediaComponent.release(audioMedia)
                })
              } else {
                currentFirstAudioDuration = 0
              }
            }
          }
          if (type) {
            if (type === 'image' || type === 'video') {
              if (type === 'image' && thumbnail === '') {
                contentOAmount++
              } else {
                if (!currentThumbType) {
                  currentThumbType = type
                } else if ((currentThumbType === 'image' && type === 'video') || (currentThumbType === 'video' && type === 'image')) {
                  currentThumbType = 'image&video'
                }
                if (!currentThumbnail && thumbnail) {
                  currentThumbnail = thumbnail
                }
                contentIVAmount++
              }
            } else if (type === 'audio') {
              contentAAmount++
            }
          }
        }
      }
    }
    if (currentThumbType !== 'image&video') {
      let attachs = current['attachs']
      if (attachs && attachs.length > 0) {
        for (let i = attachs.length - 1; i >= 0; i--) {
          let attach = attachs[i]
          if (attach) {
            let mimeType = attach['mimeType']
            let thumbnail = attach['thumbnail']
            if (mimeType) {
              let type = mimeType.substring(0, mimeType.indexOf('/'))
              if (type === 'image' || type === 'video') {
                if (!currentThumbType) {
                  currentThumbType = type
                } else if ((currentThumbType === 'image' && type === 'video') || (currentThumbType === 'video' && type === 'image')) {
                  currentThumbType = 'image&video'
                } else if (currentThumbType === 'image&video') {
                  break
                }
                if (!currentThumbnail && thumbnail) {
                  currentThumbnail = thumbnail
                }
              }
            }
          }
        }
      }
    }
    current['thumbType'] = currentThumbType
    current['thumbnail'] = currentThumbnail
    if(current['collectionType'] !== CollectionType.CHAT){
      current['contentTitle'] = contentTitle.replace(/\&nbsp\;/g, '')
    }
    current['contentBody'] = contentBody.replace(/\&nbsp\;/g, '')
    current['firstFileInfo'] = currentFirstFileInfo
    current['firstAudioDuration'] = CollaUtil.formatSeconds(currentFirstAudioDuration)
    console.log('***********************firstAudioDuration:' + current['firstAudioDuration'] + '***********************')
    current['contentIVAmount'] = contentIVAmount
    current['contentAAmount'] = contentAAmount
    // 临时用以兼容旧数据，否则导致预览封面不显示图片视频、音频、其它文件数量-start
    if (!current['attachIVAmount']) {
      current['attachIVAmount'] = 0
    }
    if (!current['attachAAmount']) {
      current['attachAAmount'] = 0
    }
    if (!current['attachOAmount']) {
      current['attachOAmount'] = 0
    }
    // 临时用以兼容旧数据，否则导致预览封面不显示图片视频、音频、其它文件数量-end
    // 检查富文本中文件占位图数量与文件附件数量是否一致
    if (contentOAmount !== current['attachOAmount']) {
      console.error('inconsistent file amount, contentOAmount:' + contentOAmount + ', attachOAmount:' + current['attachOAmount'])
    }
    // 检查附件数量是否一致
    if (current['attachAmount'] !== current['attachIVAmount'] + current['attachAAmount'] + current['attachOAmount']) {
      console.error('inconsistent attach amount, attachAmount:' + current['attachAmount'] + ', attachIVAmount:' + current['attachIVAmount'] + ', attachAAmount:' + current['attachAAmount'] + ', attachOAmount:' + current['attachOAmount'])
    }
  }
  // 保存
  async save(type, entities, parent) {
    if (!type || type === 'attach' || type === 'collection') {
      // 考虑到新增场景，需先保存collection，再保存attach
      await this.setCollectionPreview(entities)
      entities.versionFlag = 'local'
      if (myself.myselfPeerClient && myself.myselfPeerClient.localDataCryptoSwitch !== true) {
        entities.plainContent = entities.content.replace(/<[^>]+>/g, '').replace(/^\s*/g, '').replace(/\&nbsp\;/g, '')
        entities.pyPlainContent = pinyinUtil.getPinyin(entities.plainContent)
      }
      await collectionComponent.saveCollection(entities, null) // 新增时手工从头部插入，故不传parent参数，否则底层API会从尾部插入
      if (!type || type === 'attach') {
        await collectionComponent.saveAttach(entities) // 需要确保所有的附件都已经加载到attachs中
      }
      if (parent) {
        parent.sort(function (a, b) {
          return (b.updateDate ? Date.parse(b.updateDate) : 0) - (a.updateDate ? Date.parse(a.updateDate) : 0)
        })
      }
    }
  }
  async getInsertHtml(files) {
    let insertHtml = ''
    for (let file of files) {
      let mimeType = null
      let type = null
      let name = null
      let content = null
      let size = null
      if (TypeUtil.isString(file)) {
        let prefix = file.substr(0, 5)
        if (prefix === 'blob:' || prefix === 'http:') {
          file = await BlobUtil.urlToBlob(file)
          mimeType = file.type
        } else {
          mimeType = (file.match(/:(.*?);/) ? file.match(/:(.*?);/)[1] : '')
        }
      } else {
        mimeType = file.type
      }
      if (mimeType) {
        type = mimeType.substring(0, mimeType.indexOf('/'))
      }
      name = file.name
      if (TypeUtil.isString(file)) {
        content = file
      } else if (file.type && file.type.substr(0, 4) === 'text') {
        let text = await BlobUtil.blobToBase64(file, { type: 'text' })
        content = text
      } else {
        let base64 = await BlobUtil.blobToBase64(file)
        content = base64
        size = file.size
      }
      if (content) {
        if (type === 'image') {
          insertHtml += '<img src="' + content + '" style="max-width:50%;width:100%;"/>' + '<p><br></p>'
        } else if (type === 'video') {
          let thumbnail = await mediaComponent.createVideoThumbnailByBase64(content)
          insertHtml += '<video src="' + content + '" poster="' + thumbnail + '" style="max-width:50%;width:100%;" controls webkit-playsinline playsinline x5-playsinline x-webkit-airplay="allow"/>' + '<p><br></p>'
        } else if (type === 'audio') {
          insertHtml += '<audio src="' + content + '" style="max-width:100%;width:100%;" controls/>' + '<p><br></p>'
        } else {
          insertHtml += '<p>' + content + '</p>' + '<p><br></p>'
        }
      }
    }
    console.log('insertHtml:' + insertHtml)
    return insertHtml
  }
  /**
   * 当前文档上传到云端保存
   *
   * @param {*} bizObj
   * @param {*} ifUpload: true-在本方法中上传云端；反之：通过web worker等其它方法上传云端
   * @param {*} blockType: ChatAttach-临时block，按单事务处理，不保存blockLog日志；Collection-上传云端如果返回错误需要保留blockLog在以后继续处理，否则删除
   * @param {*} _peers: 可访问节点
   */
  async saveBlock(bizObj, ifUpload, blockType, _peers, expireDate) {
    let peers
    if (!_peers) {
      peers = []
    } else {
      peers = _peers
    }
    peers.push(myself.myselfPeerClient)
    let blockId = bizObj.blockId
    if (!expireDate) {
      expireDate = 0
    }
    let payload = { payload: CollaUtil.clone(bizObj), metadata: bizObj.tag, expireDate: expireDate }
    let dataBlock = DataBlockService.create(blockId, bizObj._id, blockType, bizObj.updateDate, payload, peers)
    await dataBlockService.encrypt(dataBlock)
    let dataBlocks = await DataBlockService.slice(dataBlock)
    let dbLogs = []
    for (let dataBlock of dataBlocks) {
      let dbLog = { ownerPeerId: myself.myselfPeer.peerId, blockId: dataBlock.blockId, createTimestamp: dataBlock.createTimestamp, dataBlock: dataBlock, sliceNumber: dataBlock.sliceNumber, state: EntityState.New }
      dbLogs.push(dbLog)
    }
    if (blockType !== BlockType.ChatAttach) {
      // 存储待上传云端的分片粒度的blockLog记录
      await blockLogComponent.save(dbLogs, null, null)
    }
    if (ifUpload === true) {
      dbLogs = await this.upload(dbLogs, blockType)
    }
    return dbLogs
  }
  /**
   * 从云端删除文档数据块
   *
   * @param {*} bizObj
   * @param {*} ifUpload: true-在本方法中上传云端；反之：通过web worker等其它方法上传云端
   * @param {*} blockType: ChatAttach-临时block，按单事务处理，不保存blockLog日志；Collection-上传云端如果返回错误需要保留blockLog在以后继续处理，否则删除
   */
  async deleteBlock(bizObj, ifUpload, blockType) {
    let blockId = bizObj.blockId
    let peers = []
    peers.push(myself.myselfPeerClient)
    let now = new Date().getTime()
    // 这是一种特别的块，负载为空，服务器端发现负载为空而blockId有值，则理解为删除块
    let dataBlock = DataBlockService.create(blockId, bizObj._id, blockType, now, null, peers)
    await dataBlockService.encrypt(dataBlock)
    let dbLog = { ownerPeerId: myself.myselfPeer.peerId, blockId: dataBlock.blockId, createTimestamp: dataBlock.createTimestamp, dataBlock: dataBlock, sliceNumber: dataBlock.sliceNumber, state: EntityState.New }
    let dbLogs = []
    dbLogs.push(dbLog)
    if (blockType !== BlockType.ChatAttach) {
      // 存储待上传云端的分片粒度的blockLog记录
      await blockLogComponent.save(dbLogs, null, null)
    }
    if (ifUpload === true) {
      dbLogs = await this.upload(dbLogs, blockType)
    }
    return dbLogs
  }
  /**
   * 上传云端方法，也可以参考这里的实现通过web worker等其它方法自行处理
   *
   * @param {*} dbLogs: 分片粒度的blockLog记录
   * @param {*} blockType: ChatAttach-临时block，按单事务处理，不保存blockLog日志；Collection-上传云端如果返回错误需要保留blockLog在以后继续处理，否则删除
   */
  async upload(dbLogs, blockType) {
    if (dbLogs && dbLogs.length > 0) {
      let ps = []
      for (let dbLog of dbLogs) {
        let promise = consensusAction.consensus(null, null, dbLog.dataBlock)
        ps.push(promise)
      }
      let ifFailed = false
      let responses = null
      try {
        responses = await Promise.all(ps)
      } catch (err) {
        console.error(err)
        ifFailed = true
      } finally {
        if (responses && responses.length > 0) {
          for (let i = 0; i < responses.length; ++i) {
            let response = responses[i]
            console.log("response:" + JSON.stringify(response))
            if (response &&
              response.MessageType === MsgType[MsgType.CONSENSUS_REPLY] &&
              response.Payload === MsgType[MsgType.OK]) {
              if (blockType !== BlockType.ChatAttach) { // 如果上传不成功，需要保留blockLog在以后继续处理，否则删除
                dbLogs[i].state = EntityState.Deleted
                console.log('delete dbLog, blockId:' + dbLogs[i].blockId + ';sliceNumber:' + dbLogs[i].sliceNumber)
              }
            } else {
              ifFailed = true
            }
          }
          if (blockType !== BlockType.ChatAttach) {
            await blockLogComponent.save(dbLogs, null, dbLogs)
          } else {
            if (ifFailed) {
              return null
            }
          }
        }
      }
    }
    return dbLogs
  }
  /**
	 * 云端下载方法，也可以参考这里的实现通过web worker等其它方法自行处理
	 *
	 * @param {*} downloadList: 分片粒度的block记录
	 */
	async download(downloadList) {
		let responses = null
		if (downloadList && downloadList.length > 0) {
			let ps = []
			for (let download of downloadList) {
				let blockId = download['blockId']
        let primaryPeerId = download['primaryPeerId']
        // use null instead of primaryPeerId to avoid single point of failure
				let promise = dataBlockService.findTxPayload(null, blockId)
				ps.push(promise)
			}
			try {
				responses = await Promise.all(ps)
			} catch (err) {
				console.error(err)
			} finally {
			}
		}
		return responses
	}
}
export let collectionUtil = new CollectionUtil()

export class BlockLogComponent {
	constructor() {
		pounchDb.create('blockLog', ['businessNumber'])
	}
	async get(id) {
		return await pounchDb.get('blockLog', id)
	}
	async load(condition, sort, fields, from, limit) {
		let data
		if (limit) {
			let page = await pounchDb.findPage('blockLog', condition, sort, fields, from, limit)
			data = page.result
		} else {
			data = await pounchDb.find('blockLog', condition, sort, fields)
		}

		return data
	}
	async save(entities, ignore, parent) {
		if (!entities) {
			return
		}
		if (!TypeUtil.isArray(entities)) {
			return await pounchDb.run('blockLog', entities, ignore, parent)
		} else {
			return await pounchDb.execute('blockLog', entities, ignore, parent)
		}
	}
}
export let blockLogComponent = new BlockLogComponent()