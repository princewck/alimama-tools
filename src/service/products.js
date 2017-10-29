const xlsx = require('node-xlsx');
const moment = require('moment');
const mysql = require('../utils/mysql');
const parser = require('../utils/parsers').parseProductsXLS;
const _ = require('lodash');

const getAll = mysql.getAll;

function uploadXls(file) {
  console.log('开始解析xls文件内容');
  console.time('解析xls文件耗时');
  const workSheetsFromFile = xlsx.parse(file);
  const sheetItems = workSheetsFromFile[0].data;
  var productList = parser(sheetItems, null, null);
  console.timeEnd('解析xls文件耗时');
  var uploadCategoryMap = {};
  var categoryGroupMap = {};
  var newUploadCategories = [];
  if (!(productList instanceof Array)) {
    throw new Error('文件内容不合法');
  }
  if (!productList.length) {
    throw new Error('列表合法数据条数为空');
  }
  console.log('总共', productList.length, '条数据');


  // 根据上传分类获取数据库对应的分类名
  let pikCid = (product) => {
    let uploadCname = product.uploadCategory;
    let group = null;
    if (uploadCategoryMap.hasOwnProperty(uploadCname)) {
      let upc = uploadCategoryMap[uploadCname];
      group = upc && upc['group_id'] ? categoryGroupMap[upc['group_id']] : null;
    } else {
      if (~newUploadCategories.indexOf(uploadCname)) {
        newUploadCategories.push(uploadCname);
      }
    }
    if (group) {
      group.categories = group.categories || [];
      let keywords = group.categories.reduce((kwds, item) => {
        if (item.keywords) {
          kwds.push.apply(kwds, item.keywords.split(',').map(k => {
            return {
              keyword: k,
              category: item
            };
          }));
        }
        return kwds;
      }, []);
      
      let productName = product.product_name;
      let matchName = productName + '@' + uploadCname;
      let keywordsCountMap = {};
      keywords.forEach(item => {
        var match = matchName.match(new RegExp(String(item.keyword), 'ig')) || [];
        //fixit 这样子keywords不能重复
        if (keywordsCountMap[item.keyword]) {
          keywordsCountMap[item.keyword]['categoryIds'].push(item.category.id);
          keywordsCountMap[item.keyword]['count'] += match.length;
        } else {
          keywordsCountMap[item.keyword] = { categoryIds: [item.category.id], count: match.length };
        }
      });
      let cidMap = {};
      Object.keys(keywordsCountMap).forEach(key => {
        let item = keywordsCountMap[key];
        var categoryIds = item['categoryIds'];
        var count = item['count'];
        categoryIds.forEach(cid => {
          if (cidMap[cid]) {
            cidMap[cid] += count;
          } else {
            cidMap[cid] = count;
          }
        });
      });
      var countArraySorted = Object.keys(cidMap).sort(function (a, b) {
        return Number(cidMap[b]) - Number(cidMap[a]);
      });
      var categoryId;
      if (countArraySorted.length) {
        categoryId = countArraySorted[0];
      } else {
        categoryId = group.default_category;
      }
      product.cid = categoryId || null;
      if (!product.cid) {
        // console.log('can\'t find a proper cid');
      } else {
        // console.log('cid', product.cid);
      }
      return categoryId;
    } else {
      // console.log('找不到对应的group, 上传分类名称为：' + uploadCname);
      return null;
    }
  };

  getUploadCategory()
    .then(categories => {
      // upload category group map
      return uploadCategoryMap = categories
        .reduce((map, item) => {
          return map[item.name] = item, map;
        }, {});
    }, (err) => {
      console.log('err: get upload category', err);
    })
    .then(() => {
      //category groups
      return getCategoryGroup();
    })
    .then(categoryGroups => {
      //categpry group map
      return categoryGroupMap = categoryGroups.reduce((map, item) => {
        return map[item.id] = item, map;
      }, {});
    }, (err) => {
      console.log('err: get category groups', err);
    })
    .then(() => {
      let _valueFields = [];
      let _keyFields = keyAry.map(item => (item.name)).join(',');
      let _duplicateUpdateFields = keyAry.map(item => {
        return ` ${item.name} = VALUES(${item.name}) `
      }).join(' , ');
      productList.forEach((product, index) => {
        // if (brand_id) {
        //   product.brand_id = brand_id;
        // }
        if (!product.cid) {
          (function (product) {
            product.cid = pikCid(product);
          })(product);
        };
        // 不能判断类别的商品剔除
        if (!product.cid) return;
        _valueFieldRow = keyAry
          .map(item => {
            return function (item, product) {
              return preHandler(item, product);
            }(item, product);
          });
        _valueFields.push('(' + _valueFieldRow + ')');
      });
      let sql = `INSERT INTO product (${_keyFields}) VALUES ${_valueFields.join(',')} ON DUPLICATE KEY UPDATE ${_duplicateUpdateFields}`;

      let uploadCategoriesSql = newUploadCategories.length ? `INSERT INTO upload_category (name) VALUES ${
        newUploadCategories
          .filter(c => c)
          .map(c => {
            return '(' + c + ')';
          })
          .join(',')
        }` : null;
      return { sql, uploadCategoriesSql, count: _valueFields.length };
    })
    .then(({ sql, uploadCategoriesSql, count }) => {
      //插入数据，和新增的upload categories
      console.time('execute_sqls');
      return Promise.all([
        uploadCategoriesSql ? exexQuery(uploadCategoriesSql) : Promise.resolve(), 
        count > 0 ? exexQuery(sql) : Promise.reject('过滤后找不到合法记录')
      ]);
    })
    .then(([newUploadCategories, syncProducts]) => {
      console.log('xls文件导入成功\n');
      if (newUploadCategories) {
        console.log('有新的上传分类，请去后台配置分类关联\n', newUploadCategories);
      }
      if (syncProducts) {
        console.log('商品数据同步成功！\n', syncProducts);
      }
    })
    .catch(err => {
      console.error(err, 'xls文件导入失败');
    });
}


function getCategories() {
  return getAll('category');
}

function getGroups() {
  return getAll('category_group');
}

function getGroupCategory() {
  return getAll('category_group_categories');
}

function getUploadCategory() {
  return getAll('upload_category');
}

function getCategoryGroup() {
  return Promise.all([getAll('category_group'), getCategories(), getGroupCategory()])
    .then(([groups, categories, categoryGroupMapList]) => {
      var groupMap = groups.reduce((map, item) => {
        map[item.id] = item;
        return map;
      }, {});
      var categoryMap = categories.reduce((map, item) => {
        map[item.id] = item;
        return map;
      });
      categoryGroupMapList.forEach((item) => {
        let category = categoryMap[item.categories_id];
        let group = groupMap[item.category_group_id];
        if (!group.hasOwnProperty('categories')) {
          group.categories = [];
        }
        category && group.categories.push(category);
      });
      return groups;
    });
}

let keyAry = [
  { 'name': 'id', 'type': 'Number', map: 'product_id' },
  { 'name': 'cid', 'type': 'Number' },
  { 'name': 'brand_id', 'type': 'Number' },
  { 'name': 'status', 'type': 'Boolean' },
  { 'name': 'description', 'type': 'String' },
  { 'name': 'creation_date', 'type': 'Date' },
  { 'name': 'product_name', 'type': 'String' },
  { 'name': 'product_image', 'type': 'String' },
  { 'name': 'product_detail_page', 'type': 'String' },
  { 'name': 'shop_name', 'type': 'String' },
  { 'name': 'price', 'type': 'Number' },
  { 'name': 'monthly_sold', 'type': 'Number' },
  { 'name': 'benefit_ratio', 'type': 'Number' },
  { 'name': 'benefit_amount', 'type': 'Number' },
  { 'name': 'seller_wangid', 'type': 'String' },
  { 'name': 'short_share_url', 'type': 'String' },
  { 'name': 'share_url', 'type': 'String' },
  { 'name': 'share_command', 'type': 'String' },
  { 'name': 'coupon_total_amount', 'type': 'Number' },
  { 'name': 'coupon_left_amount', 'type': 'Number' },
  { 'name': 'coupon_text', 'type': 'String' },
  { 'name': 'coupon_start', 'type': 'Date' },
  { 'name': 'coupon_end', 'type': 'Date' },
  { 'name': 'coupon_link', 'type': 'String' },
  { 'name': 'coupon_command', 'type': 'String' },
  { 'name': 'coupon_short_url', 'type': 'String' },
  { 'name': 'coupon_price', 'type': 'Number' },
  { 'name': 'platform', 'type': 'String' },
  { 'name': 'real_price', 'type': 'Number' },
  { 'name': 'small_images', 'type': 'String' }
];

function preHandler(item, product) {
  let rt = '';
  switch (item.type) {
    case 'Number':
      rt = Number(product[item.map || item.name]) || 0;
      break;
    case 'Boolean':
      rt = Boolean(product[item.map || item.name]);
      break;
    case 'Date':
      var d = product[item.map || item.name];
      rt = moment(product[item.map || item.name] || moment.now()).format('YYYY-MM-DD HH:mm:ss');
      rt = '\'' + rt + '\'';
      break;
    case 'String':
    default:
      let str = product[item.map || item.name] ? String(product[item.map || item.name]).replace(/\'/g, '\\\'') : '';
      rt = '\'' + str + '\'';
  }
  return rt;
};

function exexQuery(sql) {
  return new Promise((resolve, reject) => {
    mysql.exeSql(sql, (error) => {
      reject(error);
    }, (results, fields) => {
      resolve(results);
    });
  });
}

function markPromoted(id) {
  sql = `update product set promoted=true, promoted_at = now() where id = ${id}`;
  console.log(sql);
  return exexQuery(sql);
}

function markExpired(id) {
  sql = `update product set status = 0 where id = ${id}`;
  console.log(sql);
  return exexQuery(sql);
}

function getProducts(brandIds, categoryIds, customCond, orderBy, limit) {
  let sql = 'select * from product where';
  let cond = 0;
  if (brandIds && brandIds.length) {
    sql += ` brand_id in (${_.compact(brandIds.map((b) => Number(b))).join(',')})`;
    cond ++;
  }
  if (categoryIds && categoryIds.length) {
    if (cond) sql += ' and';
    sql += ` cid in (${_.compact(categoryIds.map((c) => Number(b))).join(',')})`;
    cond ++;
  }
  if (customCond) {
    if (cond) sql += ' and';
    sql += ` ${customCond}`;
    cond ++;
  }
  if (!cond) sql += ' 1';
  if (orderBy && orderBy.length) {
    sql += ' order by';
    str = orderBy.map(rule => {
      return ` ${rule[0]} ${rule[1] || 'desc'}`
    }).join(',');
    sql += str;
  }
  if (limit && limit.length === 2) {
    sql += ` limit ${limit[0]},${limit[1]}`;
  }
  console.log(sql);
  return exexQuery(sql);
}

module.exports = {
  uploadXls,
  list: getProducts,
  markPromoted: markPromoted,
  markExpired: markExpired
}