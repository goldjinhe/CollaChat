import { EntityState } from 'libcolla'
import { CollaUtil, TypeUtil, BlobUtil, UUID } from 'libcolla'
import { myself, consensusAction, putValueAction, DataBlockService, dataBlockService, BlockType, MsgType, PayloadType } from 'libcolla'
import { pounchDb } from 'libcolla'

import pinyinUtil from '@/libs/base/colla-pinyin'
import { mediaComponent, audioMediaComponent } from '@/libs/base/colla-media'
import { fileComponent } from '@/libs/base/colla-cordova'
import { collectionComponent, CollectionType} from '@/libs/biz/colla-collection'
import { P2pChatMessageType } from '@/libs/biz/colla-chat'

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
      let pliContent = content.replace(/<(?!\/p|\/li).*?>/g, '').replace(/^\s*/g, '')
      while (pliContent.indexOf('</p>') === 0 || pliContent.indexOf('</li>') === 0) {
        if (pliContent.indexOf('</p>') === 0) {
          pliContent = pliContent.substring(4).replace(/^\s*/g, '')
        } else if (pliContent.indexOf('</li>') === 0) {
          pliContent = pliContent.substring(5).replace(/^\s*/g, '')
        }
      }
      if (plainContent) {
        let firstChar = plainContent.substring(0, 1)
        let firstCharPos = pliContent.indexOf(firstChar)
        const tagArr = ['</p>', '</li>']
        let tagPosArr = [pliContent.length - firstCharPos]
        for (let i = 0; i < tagArr.length; i++) {
          tagPosArr[i + 1] = pliContent.substring(firstCharPos).indexOf(tagArr[i])
        }
        tagPosArr.sort(function (a, b) {
          return a - b
        })
        let minTagPos
        for (let i = 0; i < tagPosArr.length; i++) {
          if (tagPosArr[i] > -1) {
            minTagPos = tagPosArr[i]
            break
          }
        }
        minTagPos = minTagPos + firstCharPos
        contentTitle = pliContent.substring(firstCharPos, minTagPos).replace(/<[^<>]+>/g, '').replace(/\s*$/g, '')
        contentBody = pliContent.substring(minTagPos).replace(/<[^>]+>/g, '').replace(/^\s*|\s*$/g, '')
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
            if (!current['firstAudioDuration'] && currentFirstAudioDuration == 0) {
              if (window.device && (window.device.platform === 'Android' || window.device.platform === 'iOS')) {
                let dirEntry = await fileComponent.getRootDirEntry('tmp')
                let dirPath = dirEntry.toInternalURL()
                let fileName = (current['_id'] ? current['_id'] : new Date().getTime()) + 'firstAudio' + '.' + src.substring(11, src.indexOf(';', 11))
                let localURL = dirPath + fileName
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
    if(current['collectionType'] !== CollectionType.CHAT && current['collectionType'] !== CollectionType.CARD){
      current['contentTitle'] = contentTitle.replace(/\&nbsp\;/g, '')
    }
    current['contentBody'] = contentBody.replace(/\&nbsp\;/g, '')
    current['firstFileInfo'] = currentFirstFileInfo
    if (!current['firstAudioDuration']) {
      current['firstAudioDuration'] = CollaUtil.formatSeconds(currentFirstAudioDuration)
      current['contentAAmount'] = contentAAmount
    }
    console.log('***********************firstAudioDuration:' + current['firstAudioDuration'] + '***********************')
    current['contentIVAmount'] = contentIVAmount
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
  async save(type, entity, parent) {
    if (!type || type === 'attach' || type === 'collection') {
      // 考虑到新增场景，需先保存collection，再保存attach
      console.log('collection before preview length:' + JSON.stringify(entity).length)
      let start = new Date().getTime()
      if(entity['collectionType'] !== CollectionType.FILE && entity['collectionType'] !== CollectionType.VOICE){
        await this.setCollectionPreview(entity) 
      }
      let end = new Date().getTime()
      console.log('collection preview time:' + (end - start))
      console.log('collection after preview length:' + JSON.stringify(entity).length)
      entity.versionFlag = 'local'
      if (myself.myselfPeerClient.localDataCryptoSwitch !== true) {
        entity.plainContent = entity.content.replace(/<[^>]+>/g, '').replace(/^\s*/g, '').replace(/\&nbsp\;/g, '')
        entity.pyPlainContent = pinyinUtil.getPinyin(entity.plainContent)
      }
      console.log('collection after pyPlainContent length:' + JSON.stringify(entity).length)
      await collectionComponent.saveCollection(entity, null) // 新增时手工从头部插入，故不传parent参数，否则底层API会从尾部插入
      if (!type || type === 'attach') {
        await collectionComponent.saveAttach(entity) // 需要确保所有的附件都已经加载到attachs中
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
          insertHtml += '<p><br></p>' + '<img src="' + content + '" style="max-width:50%;width:100%;"/>' + '<p><br></p>'
        } else if (type === 'video') {
          let thumbnail = await mediaComponent.createVideoThumbnailByBase64(content)
          insertHtml += '<p><br></p>' + '<video src="' + content + '" poster="' + thumbnail + '" style="max-width:50%;width:100%;" controls webkit-playsinline playsinline x5-playsinline x-webkit-airplay="allow"/>' + '<p><br></p>'
        } else if (type === 'audio') {
          insertHtml += '<p><br></p>' + '<audio src="' + content + '" style="max-width:100%;width:100%;" controls/>' + '<p><br></p>'
        } else {
          insertHtml += '<p><br></p>' + '<p>' + content + '</p>' + '<p><br></p>'
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
   * @param {*} blockType: ChatAttach-临时block，按单事务处理，不保存blockLog日志；Collection-上传云端如果返回错误需要保留blockLog在以后继续处理，否则删除；P2pChat-离线消息
   * @param {*} _peers: 可访问节点
   */
  async saveBlock(bizObj, ifUpload, blockType, _peers, expireDate) {
    let peers
    if (!_peers) {
      peers = []
    } else {
      peers = _peers
    }
    if (blockType !== BlockType.GroupFile && blockType !== BlockType.Channel && blockType !== BlockType.ChannelArticle) {
      peers.push(myself.myselfPeerClient)
    }
    let blockId = bizObj.blockId
    let businessNumber = bizObj._id
    if (blockType !== BlockType.Collection) {
      businessNumber = bizObj.businessNumber
    }
    let parentBusinessNumber
    if (blockType === BlockType.ChannelArticle) {
      parentBusinessNumber = bizObj.channelId
    }
    if (!expireDate) {
      expireDate = new Date().getTime() + 3600*24*365*100 // 100 years
    }
    let payload = { payload: CollaUtil.clone(bizObj), metadata: bizObj.metadata ? bizObj.metadata : bizObj.tag, expireDate: expireDate }
    if (blockType === BlockType.GroupFile) {
      payload.name = bizObj.name
    } else if (blockType === BlockType.Channel) {
      payload.thumbnail = bizObj.avatar
      payload.name = bizObj.name
      payload.description = bizObj.name
    } else if (blockType === BlockType.ChannelArticle) {
      payload.thumbnail = bizObj.cover
      payload.name = bizObj.title
      payload.description = bizObj.abstract
    }
    let dataBlock = DataBlockService.create(blockId, parentBusinessNumber, businessNumber, blockType, bizObj.updateDate, payload, peers)
    console.log('collection dataBlock length:' + JSON.stringify(dataBlock).length)
    let start = new Date().getTime()
    await dataBlockService.encrypt(dataBlock)
    let end = new Date().getTime()
    console.log('collection dataBlock encrypt time:' + (end - start))
    let dataBlocks = await DataBlockService.slice(dataBlock)
    let end2 = new Date().getTime()
    console.log('collection dataBlock slice time:' + (end2 - end))
    let dbLogs = []
    for (let dataBlock of dataBlocks) {
      let dbLog = { ownerPeerId: myself.myselfPeer.peerId, blockId: dataBlock.blockId, createTimestamp: dataBlock.createTimestamp, dataBlock: dataBlock, sliceNumber: dataBlock.sliceNumber, state: EntityState.New }
      dbLogs.push(dbLog)
    }
    if (blockType === BlockType.Collection) {
      // 存储待上传云端的分片粒度的blockLog记录
      await blockLogComponent.save(dbLogs, null, null)
    }
    let end3 = new Date().getTime()
    console.log('collection blockLog save time:' + (end3 - end2))
    if (ifUpload === true) {
      dbLogs = await this.upload(dbLogs, blockType, 'saveBlock')
    }
    let end4 = new Date().getTime()
    console.log('collection upload time:' + (end4 - end3))
    return dbLogs
  }
  /**
   * 从云端删除文档数据块
   *
   * @param {*} bizObj
   * @param {*} ifUpload: true-在本方法中上传云端；反之：通过web worker等其它方法上传云端
   * @param {*} blockType: ChatAttach-临时block，按单事务处理，不保存blockLog日志；Collection-上传云端如果返回错误需要保留blockLog在以后继续处理，否则删除；P2pChat-离线消息
   */
  async deleteBlock(bizObj, ifUpload, blockType) {
    let blockId = bizObj.blockId
    let businessNumber = bizObj._id
    if (blockType !== BlockType.Collection) {
      businessNumber = bizObj.businessNumber
    }
    let parentBusinessNumber
    if (blockType === BlockType.ChannelArticle) {
      parentBusinessNumber = bizObj.channelId
    }
    let peers = []
    peers.push(myself.myselfPeerClient)
    let createTimestamp = new Date().getTime()
    // 这是一种特别的块，负载为空，服务器端发现负载为空而blockId有值，则理解为删除块
    let dataBlock = DataBlockService.create(blockId, parentBusinessNumber, businessNumber, blockType, createTimestamp, null, peers)
    await dataBlockService.encrypt(dataBlock)
    let dataBlocks = await DataBlockService.slice(dataBlock)
    dataBlock = dataBlocks[0]
    let dbLog = { ownerPeerId: myself.myselfPeer.peerId, blockId: dataBlock.blockId, createTimestamp: dataBlock.createTimestamp, dataBlock: dataBlock, sliceNumber: dataBlock.sliceNumber, state: EntityState.New }
    let dbLogs = []
    dbLogs.push(dbLog)
    if (blockType === BlockType.Collection) {
      // 存储待上传云端的分片粒度的blockLog记录
      await blockLogComponent.save(dbLogs, null, null)
    }
    if (ifUpload === true) {
      dbLogs = await this.upload(dbLogs, blockType, 'deleteBlock')
    }
    return dbLogs
  }
  /**
   * 上传云端方法，也可以参考这里的实现通过web worker等其它方法自行处理
   *
   * @param {*} dbLogs: 分片粒度的blockLog记录
   * @param {*} blockType: ChatAttach-临时block，按单事务处理，不保存blockLog日志；Collection-上传云端如果返回错误需要保留blockLog在以后继续处理，否则删除；P2pChat-离线消息
   * @param {*} opType: saveBlock or deleteBlock
   */
  async upload(dbLogs, blockType, opType) {
    console.log("upload time:" + new Date())
    if (dbLogs && dbLogs.length > 0) {
      let ps = []
      for (let dbLog of dbLogs) {
        let promise
        if (opType === 'saveBlock') {
          promise = consensusAction.consensus(null, null, dbLog.dataBlock)
        } else if (opType === 'deleteBlock') {
          promise = putValueAction.putValue(null, PayloadType.DataBlock, dbLog.dataBlock)
        }
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
        let start = new Date().getTime()
        if (responses && responses.length > 0) {
          for (let i = 0; i < responses.length; ++i) {
            let response = responses[i]
            console.log("response:" + JSON.stringify(response))
            if (response &&
              (response.MessageType === MsgType[MsgType.CONSENSUS_REPLY] || response.MessageType === MsgType[MsgType.PUTVALUE]) &&
              response.Payload === MsgType[MsgType.OK]) {
              if (blockType === BlockType.Collection) { // 如果上传不成功，需要保留blockLog在以后继续处理，否则删除
                dbLogs[i].state = EntityState.Deleted
                console.log('delete dbLog, blockId:' + dbLogs[i].blockId + ';sliceNumber:' + dbLogs[i].sliceNumber)
              }
            } else {
              ifFailed = true
            }
          }
          if (blockType === BlockType.Collection) {
            await blockLogComponent.save(dbLogs, null, dbLogs)
          } else {
            if (ifFailed) {
              return null
            }
          }
        }
        let end = new Date().getTime()
        console.log('collection upload blockLog save time:' + (end - start))
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
  async _saveMedia(url, ios, android, fn) {
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
        if ((ios === true || android === true) && (u.localURL || u.uri)) {
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
          if (ios === true && localURL) {
            if (localURL.toUpperCase().indexOf('.HEIC') > -1) {
              u.quality = 99
              u = await mediaPickerComponent.compressImage(u)
              localURL = u.uri
              console.log('localURL2:' + localURL)
              type = 'image/jpeg'
            } else if (localURL.toUpperCase().indexOf('.JPG') > -1) {
              type = 'image/jpeg'
            } if (localURL.toUpperCase().indexOf('.PNG') > -1) {
              type = 'image/png'
            } else if (localURL.toUpperCase().indexOf('.MP4') > -1) {
              type = 'video/mp4'
            } else if (localURL.toUpperCase().indexOf('.MOV') > -1) {
              let fileEntry = await fileComponent.getFileEntry(localURL)
              blob = await fileComponent.readFile(fileEntry, { format: 'blob', type: type })
              let base64 = await BlobUtil.fileObjectToBase64(blob)
              base64 = mediaComponent.fixVideoUrl(base64)
              if (base64) {
                let dirEntry = await fileComponent.getRootDirEntry('tmp')
                let dirPath = dirEntry.toInternalURL()
                let fileName = 'thumbnail' + UUID.string(null, null) + '.' + base64.substring(11, base64.indexOf(';', 11))
                fileEntry = await fileComponent.createNewFileEntry(fileName, dirPath)
                blob = BlobUtil.base64ToBlob(base64)
                await fileComponent.writeFile(fileEntry, blob, false)
                localURL = dirEntry.toInternalURL() + fileName
                console.log('localURL2:' + localURL)
                type = 'video/mp4'
              }
            }
          }
          let fileEntry = await fileComponent.getFileEntry(localURL)
          blob = await fileComponent.readFile(fileEntry, { format: 'blob', type: type })
        } else {
          blob = u
        }
        files.push(blob)
      }
    }
    await fn(files)
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
