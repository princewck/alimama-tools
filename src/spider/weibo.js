const nconf = require('nconf');
const puppeteer = require('puppeteer');
const delay = require('../utils/delay');
const path = require('path');

nconf.argv()
.env()
.file({file: path.resolve(__dirname, '../../config/weibo.conf.json')});

async function login (page) {
  const username = nconf.get('username');
  const password = nconf.get('password');
  await page.setUserAgent('Mozilla/5.0(Macintosh;U;IntelMacOSX10_6_8;en-us)AppleWebKit/534.50(KHTML,likeGecko)Version/5.1Safari/534.50');
  await page.goto('https://weibo.com', {waitUtil: 'networkidle'});
  await page.waitForSelector('#loginname', {timeout: 2000});
  await page.click('#loginname');
  await page.focus('#loginname');
  console.log('username', username);
  await page.type('#loginname', username, {delay: 100});
  await delay(400);
  await page.click('input[type=password].W_input');
  await page.focus('input[type=password].W_input');
  console.log('password', password);
  await page.type('input[type=password].W_input', password, {delay: 100});
  const submitBtn = await page.$('a[node-type="submitBtn"]');
  await submitBtn.click();
  return page.waitForSelector('#skin_cover_s', 20000);
}

async function publish(page, text, pictures) {
  if (!(pictures instanceof Array)) {
    pictures = [];
  }
  if (!text && !pictures.length) {
    return Promise.reject('发送内容不能为空！');
  }
  await page.goto('https://weibo.com', {waitUtil: 'networkidle'});
  await page.waitForSelector('#skin_cover_s', 3000);
  await page.click('a[title="图片"]');
  try {
    await page.waitForSelector('.W_layer .content', {visible: true, timeout: 500});
    await page.click('.W_layer .content .W_layer_close a', {delay: 1000});
    console.log('删除上次选择的图片');
  } catch (e) {
    console.log('没有图片历史选择记录');
  }
  await delay(400);
  if (pictures.length) {
    const fileInput = await page.$('input[multiple]');
    await fileInput.uploadFile(...pictures);   
    await delay(10000);
    console.log('press Escape');
    await page.keyboard.press('Escape', {delay: 150});
  } else {
    console.log('没有图片， 跳过图片上传');
  }
  await delay(pictures.length * 500);
  await page.click('textarea[title="微博输入框"]');
  await page.focus('textarea[title="微博输入框"]');
  const input  = await page.$('textarea[title="微博输入框"]');
  await input.click();
  for (let i=0; i < 4; i++) {
    await page.keyboard.press('Backspace');
  }
  await page.evaluate(text => {
    let field = document.querySelector('textarea[title="微博输入框"]');
    field && (field.value = text);
  }, text);
  await page.type('textarea[title="微博输入框"]', '.');
  await delay(2000);
  await page.waitForSelector('textarea[title="微博输入框"]', {waitUtil: 'networkidle'});
  const btn = await page.$('a[title="发布微博按钮"]');
  await btn.click();
  await page.waitForSelector('.send_succpic', {visible: true, timeout: 30000});
  await page.keyboard.press('Escape', {delay: 150});
}

function checkLogin(page) {
  return page.goto('https://weibo.com/', {waitUtil: 'networkidle'})
    .then(() => {
      return page.$('.W_input[title="微博输入框"]');
    })
    .then(res => {
      return Boolean(res);
    });
}

module.exports = {
  login,
  publish,
  checkLogin
};