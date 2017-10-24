const cronJob = require('cron').CronJob;
const alimama = require('../src/spider/alimma');

const syncDaily = alimama.syncDaily;
const refreshToken = alimama.refresh;

alimama.login().then(() => {

  new cronJob('*/10 * * * * *', function () {
    console.log('.');
  }, null, true, 'Asia/Chongqing');
  
  new cronJob('*/30 * * * * *', function () {
    console.log('refresh token');
    refreshToken();
  }, null, true, 'Asia/Chongqing');
  
  new cronJob('00 */3 * * * * ', function () {
    console.log('开始同步今日精选数据');
    syncDaily();
  }, null, true, 'Asia/Chongqing');

});