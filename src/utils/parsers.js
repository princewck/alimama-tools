const keyMap = require('../constants/parseMap');

/**
* 导入每日更新的精选优质商品
* @param {arr} xlsArr 表格数据
* @param {number} cid 分类名
* @param {number} brand_id 品牌
* @param {string} description 
*/
function parseXLS(xlsArr, cid, brand_id, description) {
  var headArr = xlsArr.shift();
  var mapperHelper = mapper(headArr);
  return xlsArr.map(function (product, index) {
      var p = mapperHelper(product);
      p.coupon_price = getCouponPrice(p.coupon_text);
      p.real_price = p.price - Number(p.coupon_price);
      p.real_price = p.real_price > 0 ? p.real_price : p.price;
      p.status = true;
      p.description = description;
      p.creation_date = new Date();
      return p;
  }).filter(function (p, index) {
      //过滤空白行和销量过低的商品,这里表头不满足p.monthly_sold，所以也被隐含的去除了。
      return p.product_id && p.product_name;
  });
}

function mapper(arr) {
  var productMapper = {};
  arr.forEach((item, index) => {
      if (keyMap.hasOwnProperty(item)) {
          productMapper[keyMap[item]] = index;
      }
  });
  return function (pArr) {
      var product = {};
      for(key in productMapper) {
        // todo 暂时这么硬编码，没有做成可配置
          if (key === 'platform') {
              product[key] = pArr[productMapper[key]] === '天猫' ? 'tmall' : 'taobao';
          } else {
              product[key] = pArr[productMapper[key]];                
          }
      }
      return product;
  }
}

function getCouponPrice(couponExpression) {
  var p = /\d{1,}/g;
  var arr = couponExpression.match(p);
  arr = arr || [0];
  var couponPrice = Math.min.apply(Math, arr);
  return couponPrice || null;
}

module.exports = {
  parseProductsXLS: parseXLS,
};

