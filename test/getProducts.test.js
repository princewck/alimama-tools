const Product = require('../src/service/products');

Product
  .list(null, null, 'promoted is false', ['monthly_sold', 'desc'], [0, 100])
  .then(res => {
    console.log(res);
  });