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
      page = await alimama.newPage('p_detail');
      await page.setViewport({
        width: 1920,
        height: 8000
      });
      await page.goto(url, { waitUntil: 'networkidle' });
      console.log('页面打开成功！');/////
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
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
      console.log('图片清空完成，准备下载新图片');
      let imgs = await Promise.all(_.compact(images).map(
        (image, index) => download(image, path.resolve(__dirname, `./images_wb/${index}.jpg`))
          .catch((err) => {
            console.log(`./images_wb/${index}.jpg下载失败！:`, err);
            return null;
          })
      ));
      imgs = _.compact(imgs);
      console.log(imgs);
      const sp = await alimama.newPage();
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
        await sp.close();
      } catch (e) {
        console.log('红包有效，准备截图');
        await sp.screenshot({ path: path.resolve(__dirname, './images_wb/ss.png') });
        console.log('获取优惠券截图完成！');
        console.log('开始发布商品到微博：', product.product_name);
        const wbpage = await alimama.newPage();
        await wbpage.setViewport({
          width: 1366,
          height: 768,
          deviceScaleFactor: 1
        });
        const isLogin = await weiboHelper.checkLogin(wbpage);
        console.log('isLogin:', isLogin);
        if (!isLogin) await weiboHelper.login(wbpage);
        await weiboHelper.publish(wbpage, `${product.product_name} ${product.coupon_link}`, [
          path.resolve(__dirname, './images_wb/ss.png')
        ].concat(imgs), wbpage);
        console.log('发布成功！请检查微博发送记录');
        await Product.markPromoted(product.id);
        await wbpage.close();
        if (page && page.close) {
          await page.close();
        }
        await delay(1000 * 60 * 2);
      }
      console.log('循环任务结束');
    } catch (e) {
      if (page && page.close) {
        await page.close();
      }
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