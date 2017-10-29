module.exports = {
    ossAccount: {
        accessKeyId: 'LTAxxxxxxxxx',
        accessKeySecret: 'lM7MZyLbwGkDxxxxxxxx'
    },
    mysqlConfig: "mysql://root:@localhost/table_name?pool=true",
    mysqlPoolConfig: {
        host: 'localhost',
        user: 'root',
        password: 'xxxxx',
        database: 'tbame',
        port: 3306,
        acquireTimeout: 100000
    },
    sessionMysqlStorageConfig: {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        database: 'kmall_session'
    },
    alimamaConfig: {
        'username': 'xxxx',
        'password': 'xxxxxx',
        'appkey': '23xxxxx',
        'appsecret': '54xxxxxxxxxxxxxxx20ad1582f58',
        'REST_URL': 'http://gw.api.taobao.com/router/rest'
    }
}
