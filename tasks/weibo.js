const cronJob = require('cron').CronJob;
const alimama = require('../src/spider/alimma');
const Product = require('../src/service/products');
const delay = require('../src/utils/delay');
const _ = require('lodash');
const download = require('../src/utils/download');
const path = require('path');
const fs = require('fs');
const weiboHelper = require('../src/spider/weibo');
const moment = require('moment');



async function weibo() {
  const cidArea = `select categories_id from category_group_categories
  left join category on category.id = category_group_categories.categories_id
  where category_group_categories.category_group_id in (20, 21, 23, 26, 40) and category.name not like '其他%'`;

  await alimama.loginTmall();
  const list = await Product.list(null, null, `promoted is false and coupon_price > 5 and product_detail_page is not null and status = 1 and price between 60 and 600 and cid in (${cidArea}) and coupon_price/price > .2`, [
    ['creation_date', 'desc'],
    ['monthly_sold', 'desc'],
    ['coupon_price', 'desc'],
    ['creation_date', 'desc']
  ], [0, 2000]);
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
      const sp = await alimama.getPage('coupon_shot');
      await sp.setViewport({
        width: 768,
        height: 1366
      });
      await sp.goto(product.coupon_link, { waitUntil: 'networkidle' });
      console.log('优惠券地址：', product.coupon_link);
      try {
        console.log('开始获取优惠券截图。。。');
        let noLottery = await sp.$$('.nolottery-wrap');
        let expired = await sp.$$('.coupons-container-no');
        console.log(noLottery.length, expired.length);
        if (noLottery.length || expired.length) {
          console.log('红包已失效，mark expired: id', product.id);
          await Product.markExpired(product.id);
          console.log('跳过。。。');
        } else {
          try {
            console.log('红包有效，准备截图');
            let screenshotPic = path.resolve(__dirname, `./images_wb/ss_${new Date().valueOf()}.png`);
            await sp.screenshot({ path: screenshotPic });
            console.log('获取优惠券截图完成！');
            await delay(1000);
            await page.goto(url, { waitUntil: 'networkidle' });
            console.log('页面打开成功！');/////
            await delay(500);
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
            console.log('图片清空完成,开始下载新图片', moment().format('HH:mm:ss'));
            await delay(500);
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
            await weiboHelper.publish(wbpage, describe(product), [
              screenshotPic,
            ].concat(imgs), wbpage);
            console.log('发布成功！请检查微博发送记录', moment().format('HH:mm:ss'));
            await wbpage.close();
            await Product.markPromoted(product.id);
            await delay(1000 * 60 * 8 + Math.random() * 60000);
          } catch (e) {
            console.log(e);
            if (wbpage) await wbpage.close();
          }
        }
      } catch (e) {
        console.log(e);
        await delay(1500);
      }
      console.log('循环任务结束');
    } catch (e) {
      await delay(1500);
      console.log('err:', e);
      retry--;
    }
  }
}

function describe(product) {
var topic = [
  '优惠券分享联盟',
  '内部优惠分享'
][Math.floor(Math.random() * 2)];

return `#${topic}#${product.product_name} 
原价：¥${product.price} , 
优惠券：¥${product.coupon_price}
领券连接：${product.coupon_link}
商品详情：${product.share_url}
更多惊喜 => m.quanerdai.com： http://m.quanerdai.com`;
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