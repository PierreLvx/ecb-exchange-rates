const currencyConverter = require('../currencyConverter.js')

console.log(JSON.stringify(currencyConverter.getCurrencyMetadata({ currency: 'EUR' })))

currencyConverter.getAllCurrencies().then((data) => {
  const USDEUR = 1 / data.find(({ currency }) => currency === 'USD').rate
  console.log(`USDEUR = ${USDEUR}`)
})
