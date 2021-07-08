'use strict';
const { get } = require('axios')

class Handler {
  constructor({ rekoSvc, translatorSvs }) {
    this.rekoSvc = rekoSvc
    this.translatorSvs = translatorSvs
  }

  async formatTextResults(texts, workingItems) {
    const finalText = []

    for(const indexText in texts) {
      const nameInPortuguese = texts[indexText]
      const confidence = workingItems[indexText].Confidence

      finalText.push(
        ` ${confidence.toFixed(2)}% de ser do tipo ${nameInPortuguese}`
      )
    }

    return finalText.join('\n')
  }

  async translateText(text) {
    const params = {
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'pt',
      Text: text
    }

    const { TranslatedText } = await this.translatorSvs
                            .translateText(params)
                            .promise()

    return TranslatedText.split(' e ')
  }

  async detectImageLabels(buffer) {
    const result = await this.rekoSvc.detectLabels({
      Image: {
        Bytes: buffer
      }
    }).promise()

   const workingItems = result.Labels
    .filter(({ Confidence }) => Confidence > 80)

   const names = workingItems
    .map(({ Name }) => Name)
    .join(' and ')

    return { names, workingItems }
  }

  async getImageBuffer(imageUrl) {
    const response = await get(imageUrl, {
      responseType: 'arraybuffer'
    })
    const buffer = Buffer.from(response.data, 'base64')

    return buffer
  }

  async main(event) {
    try {
      
      const { imageUrl } = event.queryStringParameters

      // const imgBuffer = await readFile('./images/cat.jpeg')
      console.log('** Download image')

      const buffer = await this.getImageBuffer(imageUrl)

      console.log('** Detect image')

      const { names, workingItems } = await this.detectImageLabels(buffer)

      console.log('** Translate text')

      const texts = await this.translateText(names)

      console.log('** Handling final object')

      const finalText = await this.formatTextResults(texts, workingItems)

      console.log('** Finish')

      return {
        statusCode: 200,
        body: 'A imagem tem \n'.concat(finalText)
      }
    } catch (error) {
      console.log(error)
      return {
        statusCode: 500,
        body: 'Internal server error'.concat('\n').concat(error)
      }
    }
  }
}

//factory
const aws = require('aws-sdk')
const rekoSvc = new aws.Rekognition()
const translatorSvs = new aws.Translate()
const handler = new Handler({
  rekoSvc,
  translatorSvs
})

module.exports.main = handler.main.bind(handler);
