const xml2js = require('xml2js')
const _ = require('underscore')
const fs = require('fs')
const path = require('path')

module.exports = {

    settings: {
      url: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
    },

    baseCurrency: "EUR",

    currenciesMap: [],

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
      const self = this
      const cleanXML = this.removeNamespaces(xml)
      const parser = new xml2js.Parser()

      parser.parseString(cleanXML, function (err, result) {
        const currencies = result.Envelope.Cube[0].Cube[0].Cube
        self.createCurrenciesMap(currencies)
      })

    },

    createCurrenciesMap: function (currencies) {
      const self = this
      _.each(currencies, function (item) {
         const currency = eval('item.$').currency
         const rate = eval('item.$').rate
         self.currenciesMap.push({ currency: currency, rate: rate })
      })
      self.currenciesMap.push({ currency: 'EUR', rate: 1 })
      self.executeCallback()
    },

    getExchangeRates: async function () {
      const self = this;
      try {
        console.log('Fetching exchange rates...')
        const response = await fetch(self.settings.url);
        if (response.ok) {
          const data = await response.text();
          self.parseXML(data);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    },

    roundValues: function (value, places) {
        const multiplier = Math.pow(10, places)
        return (Math.round(value * multiplier) / multiplier)
    },

    fetchRates: function (settings) {
      const self = this
      const getCurrency = function (currency) {
        return _.find(self.currenciesMap, function (item) {
           return item.currency === currency
        })
      }

      const rates = {}
      rates.fromCurrency = getCurrency(settings.fromCurrency)
      rates.toCurrency = getCurrency(settings.toCurrency)
      rates.exchangeRate = (1 / rates.fromCurrency.rate) * rates.toCurrency.rate
      return rates
    },

    getAllCurrencies: function (callback) {
      this.getExchangeRates()
      this.executeCallback = function () {
          callback(this.currenciesMap)
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
          exchangedValue.currency = rates.toCurrency.currency
          exchangedValue.exchangeRate = this.roundValues(rates.exchangeRate, settings.accuracy | 4)
          exchangedValue.amount = this.roundValues(settings.amount * rates.exchangeRate, settings.accuracy | 4)

          callback(exchangedValue)
        }
    },

    getExchangeRate: function (settings, callback) {
      this.getExchangeRates()
      this.executeCallback = function () {
          const exchangedValue = {}

          const rates = this.fetchRates(settings)
          exchangedValue.toCurrency = rates.toCurrency.currency
          exchangedValue.fromCurrency = rates.fromCurrency.currency
          exchangedValue.exchangeRate = this.roundValues(rates.exchangeRate, settings.accuracy | 4)

          callback(exchangedValue)
        }
    },

    getCurrenciesMetadata: function (callback) {
      this.currenciesMetadata = this.readJson()
      callback(this.currenciesMetadata)
    },

    getCurrencyMetadata: function (settings, callback) {
      this.currenciesMetadata = this.readJson()

      const self = this
      const getCurrency = function (currency) {
        return _.find(self.currenciesMetadata, function (item) {
           return item.Code === currency
        })
      }

      callback(getCurrency(settings.currency))
    }

}
