// 测试文件导入
const fs = require('fs');
const path = require('path');
const ProductService = require('../src/service/products');

const uploadXLS = ProductService.uploadXls;
const file = fs.readFileSync(path.resolve(__dirname, './testFile.xls'));
uploadXLS(file);
