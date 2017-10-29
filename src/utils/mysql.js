const mysql = require('mysql');
const configuration = require('../../config/config');
const pool = mysql.createPool(configuration.mysqlPoolConfig);

function getAll(tableName) {
  return new Promise((resolve, reject) => {
    const sql = `select * from ${tableName} where 1`;
    console.log('sql:' + sql);
    exeSql(sql, (err) => {
      throw new Error('error occured when fetch ' + tableName + ' records!')
    }, (results, fields) => {
      resolve(results);
    });
  });
}

function get(tableName, keys, conditions) {
  return new Promise((resolve, reject) => {
    const sql = `select ${`keys`.join(',')} from ${tableName}`;
    conditions.length ? sql += ` where ${conditions}` : sql += 'where 1';
    console.log('sql:' + sql);
    exeSql(sql, () => {
      throw new Error(`error occur when get ${keys} from ${tableName}`);
    }, (results) => {
      resolve(results);
    });
  });
}


function exeSql(sql, onError, onSuccess) {
  pool.getConnection((error, connection) => {
    connection.query(sql, (err, results, fields) => {
      connection.release();
      if (err) {
        onError && onError();
      } else {
        onSuccess && onSuccess(results, fields);
      }
    });
  });
}

module.exports = {
  pool,
  getAll,
  exeSql,
  get,
  getAll
};