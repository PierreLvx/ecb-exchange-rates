const currencyConverter = require('../currencyConverter.js')

const settings = {}
settings.currency = "EUR"

currencyConverter.getCurrencyMetadata(settings, (data) => {
  console.log(JSON.stringify(data))
})

currencyConverter.getAllCurrencies((data) => {
  const USDEUR = 1 / data.find(({ currency }) => currency === 'USD').rate
  console.log(`USDEUR = ${USDEUR}`)
})
