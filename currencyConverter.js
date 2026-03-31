const xml2js = require('xml2js')
const fs = require('fs')
const path = require('path')

module.exports = {

  settings: {
    url: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'
  },

  baseCurrency: 'EUR',

  currenciesMap: {},

  readJson: function () {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, 'Currencies.json'), 'utf8'))
  },

  removeNamespaces: function (xml) {
    return xml.replace(/(<\/?)(\w+:)/g, '$1').replace(/xmlns(:\w+)?="[^"]*"/g, '').trim()
  },

  parseXML: async function (xml) {
    const result = await xml2js.parseStringPromise(this.removeNamespaces(xml))
    const currencies = result.Envelope.Cube[0].Cube[0].Cube
    this.createCurrenciesMap(currencies)
  },

  createCurrenciesMap: function (currencies) {
    this.currenciesMap = {
      ...Object.fromEntries(currencies.map(({ $ }) => [$.currency, Number($.rate)])),
      EUR: 1
    }
  },

  getExchangeRates: async function () {
    console.log('Fetching exchange rates...')
    const response = await fetch(this.settings.url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    await this.parseXML(await response.text())
  },

  roundValues: function (value, places) {
    const multiplier = 10 ** places
    return Math.round(value * multiplier) / multiplier
  },

  fetchRates: function ({ fromCurrency, toCurrency }) {
    const fromRate = this.currenciesMap[fromCurrency]
    const toRate = this.currenciesMap[toCurrency]
    if (!fromRate) throw new Error(`Unknown currency: ${fromCurrency}`)
    if (!toRate) throw new Error(`Unknown currency: ${toCurrency}`)
    return {
      fromCurrency: { currency: fromCurrency, rate: fromRate },
      toCurrency: { currency: toCurrency, rate: toRate },
      exchangeRate: toRate / fromRate
    }
  },

  getAllCurrencies: async function () {
    await this.getExchangeRates()
    return Object.entries(this.currenciesMap).map(([currency, rate]) => ({ currency, rate }))
  },

  getBaseCurrency: function () {
    return { currency: this.baseCurrency }
  },

  convert: async function (settings) {
    await this.getExchangeRates()
    const rates = this.fetchRates(settings)
    const accuracy = settings.accuracy ?? 4
    return {
      currency: rates.toCurrency.currency,
      exchangeRate: this.roundValues(rates.exchangeRate, accuracy),
      amount: this.roundValues(settings.amount * rates.exchangeRate, accuracy)
    }
  },

  getExchangeRate: async function (settings) {
    await this.getExchangeRates()
    const rates = this.fetchRates(settings)
    const accuracy = settings.accuracy ?? 4
    return {
      fromCurrency: rates.fromCurrency.currency,
      toCurrency: rates.toCurrency.currency,
      exchangeRate: this.roundValues(rates.exchangeRate, accuracy)
    }
  },

  getCurrenciesMetadata: function () {
    return this.readJson()
  },

  getCurrencyMetadata: function ({ currency }) {
    return this.readJson().find(item => item.Code === currency)
  }

}
