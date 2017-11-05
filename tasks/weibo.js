const cronJob = require('cron').CronJob;
const alimama = require('../src/spider/alimma');
const Product = require('../src/service/products');
const delay = require('../src/utils/delay');
const _ = require('lodash');
const download = require('../src/utils/download');
const path = require('path');
const fs = require('fs');
const weiboHelper = require('../src/spider/weibo');



async function weibo() {
  await alimama.loginTmall();
  const list = await Product.list(null, null, 'promoted is false and coupon_price > 5 and product_detail_page is not null and status = 1', [
    ['monthly_sold', 'desc'],
    ['coupon_price', 'desc'],
    ['creation_date', 'desc']
  ], [0, 1000]);
  console.log('发送队列共', list.length, '条数据');
  let retry = 9;
  let n = 0;
  while (true && retry) {
    n++;
    let page;
    try {
      console.log(`第${n}次循环任务开始`);
      const product = list.shift();
      const url = product.product_detail_page;
      console.log('url:', url);
      page = await alimama.getPage('p_detail');
      await page.setViewport({
        width: 1366,
        height: 50000
      });      
      await page.goto(url, { waitUntil: 'networkidle' });
      console.log('页面打开成功！');/////
      await delay(1000);
      await page.evaluate(async () => {
        function getScrollHeight() {
          return document.querySelector('#description').scrollHeight;
        }
        function delay(t) {
          return new Promise(resolve => {
            setTimeout(resolve, t);
          });
        }
        let scrollAmount = 0;
        while ((scrollAmount + 200) < getScrollHeight()) {
          let scrollHeight = getScrollHeight();
          let next = scrollAmount + window.innerHeight > scrollHeight ? scrollHeight : scrollAmount + window.innerHeight;
          window.scrollBy(0, window.innerHeight);
          scrollAmount = next;
          await delay(600);
        }
      });
      const images = await page.$$eval('#description img', (images) => {
        return Array.prototype.map.call(images, (img) => img.src);
      });
      console.log('获取图片成功！');/////
      while (images.length > 6) {
        images.shift();
        if (images.length > 6) {
          images.pop();
        }
      }
      console.log(images);
      console.log('准备清空图片目录');
      await deleteall(path.resolve(__dirname, './images_wb'));
      console.log('图片清空完成，6秒后开始下载新图片');
      await delay(6000);
      console.log('开始下载图片');
      let imgs = await Promise.all(_.compact(images).map(
        (image, index) => download(image, path.resolve(__dirname, `./images_wb/${index}_${new Date().valueOf()}.jpg`))
          .catch((err) => {
            console.log(`./images_wb/${index}.jpg下载失败！:`, err);
            return null;
          })
      ));
      console.log('下载图片完成！');
      imgs = _.compact(imgs);
      console.log(imgs);
      const sp = await alimama.getPage('coupon_shot');
      await sp.setViewport({
        width: 768,
        height: 1366
      });
      await sp.goto(product.coupon_link, { waitUntil: 'networkidle' });
      try {
        console.log('开始获取优惠券截图。。。');
        await sp.waitForSelector('.coupons-container-no', { visible: true, timeout: 1000 });
        console.log('红包已失效，mark expired: id', product.id);
        await Product.markExpired(product.id);
        console.log('跳过。。。');
      } catch (e) {
        try {
          console.log('红包有效，准备截图');
          let screenshotPic = path.resolve(__dirname, `./images_wb/ss_${new Date().valueOf()}.png`);
          await sp.screenshot({ path: screenshotPic });
          console.log('获取优惠券截图完成！');
          console.log('开始发布商品到微博：', product.product_name);
          const wbpage = await alimama.newPage('weibo_sender');
          await wbpage.setViewport({
            width: 1366,
            height: 768,
            deviceScaleFactor: 1
          });
          const isLogin = await weiboHelper.checkLogin(wbpage);
          console.log('isLogin:', isLogin);
          if (!isLogin) await weiboHelper.login(wbpage);
          await weiboHelper.publish(wbpage, `${product.product_name} ${product.coupon_link}`, [
            screenshotPic,
          ].concat(imgs), wbpage);
          console.log('发布成功！请检查微博发送记录');
          await wbpage.close();
          await Product.markPromoted(product.id);
          await delay(1000 * 60 * 15);
        } catch (e) {
          if (wbpage) await wbpage.close();
        }
      }
      console.log('循环任务结束');
    } catch (e) {
      await delay(1500);
      console.log('err:', e);
      retry--;
    }
  }
}

function deleteall(p) {
  const files = fs.readdirSync(p);
  return Promise.all(files.map(f => {
    return new Promise((resolve, reject) => {
      console.log('rm:', f);
      fs.unlink(path.resolve(p, f), (err) => {
        if (err) reject(err);
        resolve();
      });
    });
  }));
}

weibo();