const xml2js = require('xml2js')
const fs = require('fs')
const path = require('path')

const currencyConverter = {

  settings: {
    url: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
    cacheTTL: 60 * 60 * 1000 // ECB publishes rates once per business day, so an hour is a safe default
  },

  baseCurrency: 'EUR',

  currenciesMap: {},

  lastFetchedAt: 0,

  currenciesMetadata: null,

  readJson: function () {
    if (!this.currenciesMetadata) {
      this.currenciesMetadata = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'Currencies.json'), 'utf8'))
    }
    return this.currenciesMetadata
  },

  parseXML: async function (xml) {
    const result = await xml2js.parseStringPromise(xml, { tagNameProcessors: [xml2js.processors.stripPrefix] })
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
    const isCacheFresh = Date.now() - this.lastFetchedAt < this.settings.cacheTTL
    if (isCacheFresh && Object.keys(this.currenciesMap).length) return

    console.log('Fetching exchange rates...')
    const response = await fetch(this.settings.url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    await this.parseXML(await response.text())
    this.lastFetchedAt = Date.now()
  },

  roundValues: function (value, places) {
    const multiplier = 10 ** places
    return Math.round(value * multiplier) / multiplier
  },

  fetchRates: function ({ fromCurrency, toCurrency }) {
    fromCurrency = fromCurrency.toUpperCase()
    toCurrency = toCurrency.toUpperCase()
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

  resolveRates: async function (settings) {
    await this.getExchangeRates()
    return { rates: this.fetchRates(settings), accuracy: settings.accuracy ?? 4 }
  },

  convert: async function (settings) {
    const { rates, accuracy } = await this.resolveRates(settings)
    return {
      currency: rates.toCurrency.currency,
      exchangeRate: this.roundValues(rates.exchangeRate, accuracy),
      amount: this.roundValues(settings.amount * rates.exchangeRate, accuracy)
    }
  },

  getExchangeRate: async function (settings) {
    const { rates, accuracy } = await this.resolveRates(settings)
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
    return this.readJson().find(item => item.Code === currency.toUpperCase())
  }

}

// Bind every method to currencyConverter so destructured calls, e.g.
// `const { convert } = require('ecb-exchange-rates')`, keep working.
module.exports = Object.fromEntries(
  Object.entries(currencyConverter).map(([key, value]) => [
    key,
    typeof value === 'function' ? value.bind(currencyConverter) : value
  ])
)
