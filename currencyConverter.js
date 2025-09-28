const xml2js = require('xml2js')
const fs = require('fs')
const path = require('path')

module.exports = {

    settings: {
      url: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
    },

    baseCurrency: "EUR",

    currenciesMap: {},

    currenciesMetadata: [],

    executeCallback: null,

    readJson: function () {
      const data = fs.readFileSync(path.resolve(__dirname, 'Currencies.json'), 'utf8')
      return JSON.parse(data)
    },

    removeNamespaces: function (xml) {
      const fixedXML = xml.replace(/(<\/?)(\w+:)/g, '$1')
      return (fixedXML.replace(/xmlns(:\w+)?="[^"]*"/g, '')).trim()
    },

    parseXML: function (xml) {
      const cleanXML = this.removeNamespaces(xml)
      const parser = new xml2js.Parser()

      parser.parseString(cleanXML, (err, result) => {
        const currencies = result.Envelope.Cube[0].Cube[0].Cube
        this.createCurrenciesMap(currencies)
      })
    },

    createCurrenciesMap: function (currencies) {
      this.currenciesMap = {} // Reset map
      currencies.forEach((item) => {
         const currency = item.$.currency
         const rate = item.$.rate
         this.currenciesMap[currency] = Number(rate)
      })
      this.currenciesMap['EUR'] = 1
      this.executeCallback()
    },

    getExchangeRates: async function () {
      try {
        console.log('Fetching exchange rates...')
        const response = await fetch(this.settings.url)
        if (response.ok) {
          const data = await response.text()
          this.parseXML(data)
        }
      } catch (error) {
        console.error('Error:', error)
      }
    },

    roundValues: function (value, places) {
        const multiplier = Math.pow(10, places)
        return (Math.round(value * multiplier) / multiplier)
    },

    fetchRates: function (settings) {
      const fromRate = this.currenciesMap[settings.fromCurrency]
      const toRate = this.currenciesMap[settings.toCurrency]

      const rates = {}
      rates.fromCurrency = { currency: settings.fromCurrency, rate: fromRate }
      rates.toCurrency = { currency: settings.toCurrency, rate: toRate }
      rates.exchangeRate = (1 / fromRate) * toRate
      return rates
    },

    getAllCurrencies: function (callback) {
      this.getExchangeRates()
      this.executeCallback = function () {
          // Return as array of {currency, rate} for compatibility
          const currenciesArray = Object.entries(this.currenciesMap).map(([currency, rate]) => ({ currency, rate }))
          callback(currenciesArray)
        }
    },

    getBaseCurrency: function (callback) {
      this.executeCallback = function () {
          callback({ currency: 'EUR' })
        }()
    },

    convert: function (settings, callback) {
      this.getExchangeRates()
      this.executeCallback = function () {
          const exchangedValue = {}

          const rates = this.fetchRates(settings)
          const accuracy = settings.accuracy ?? 4
          exchangedValue.currency = rates.toCurrency.currency
          exchangedValue.exchangeRate = this.roundValues(rates.exchangeRate, accuracy)
          exchangedValue.amount = this.roundValues(settings.amount * rates.exchangeRate, accuracy)

          callback(exchangedValue)
        }
    },

    getExchangeRate: function (settings, callback) {
      this.getExchangeRates()
      this.executeCallback = function () {
          const exchangedValue = {}

          const rates = this.fetchRates(settings)
          const accuracy = settings.accuracy ?? 4
          exchangedValue.toCurrency = rates.toCurrency.currency
          exchangedValue.fromCurrency = rates.fromCurrency.currency
          exchangedValue.exchangeRate = this.roundValues(rates.exchangeRate, accuracy)

          callback(exchangedValue)
        }
    },

    getCurrenciesMetadata: function (callback) {
      this.currenciesMetadata = this.readJson()
      callback(this.currenciesMetadata)
    },

    getCurrencyMetadata: function (settings, callback) {
      this.currenciesMetadata = this.readJson()

      const getCurrency = (currency) => {
        return this.currenciesMetadata.find((item) => {
           return item.Code === currency
        })
      }

      callback(getCurrency(settings.currency))
    }

}
