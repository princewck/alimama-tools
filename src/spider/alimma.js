const puppeteer = require('puppeteer');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');
const config = require('../../config/config.js');
const delay = require('../utils/delay');
const syncXls = require('../service/products').uploadXls;

const { username: USERNAME, password: PASSWORD, addzone, siteid } = config.alimamaConfig || {};
const LOGIN_URL = 'https://login.taobao.com/member/login.jhtml?style=mini&newMini2=true&from=alimama&redirectURL=http%3A%2F%2Flogin.taobao.com%2Fmember%2Ftaobaoke%2Flogin.htm%3Fis_login%3d1&full_redirect=true&disableQuickLogin=true';
const TMALL_LOGIN_URL = 'https://login.taobao.com/member/login.jhtml?tpl_redirect_url=https%3A%2F%2Fsec.taobao.com%2Fquery.htm%3Faction%3DQueryAction%26event_submit_do_login%3Dok%26smApp%3Dmalldetailskip%26smPolicy%3Dmalldetailskip-init-anti_Spider-checklogin%26smCharset%3DGBK%26smTag%3DMTEyLjY1LjEuMTY5LCw5NjM5OTRiZmMzOTE0NTdkYTBhYjJiMTgxMWQyY2Q0ZA%253D%253D%26smReturn%3Dhttps%253A%252F%252Fdetail.tmall.com%252Fitem.htm%253Fid%253D535486069851%2526sm%253Dtrue%26smSign%3DfV6iU37RPD7cPnbks4R%252BIA%253D%253D&style=miniall&enup=true&newMini2=true&full_redirect=true&sub=true&from=tmall&allp=assets_css%3D3.0.10/login_pc.css&pms=1509871784449';

const DOWNLOAD_1111 = 'https://pub.alimama.com/operator/tollbox/excelDownload.json?excelId=TMALL_618_HOT_LIST&adzoneId=92230524&siteId=25192759';
const DOWNLOAD_DAILY = 'https://pub.alimama.com/coupon/qq/export.json?adzoneId=92230524&siteId=25192759';

let browser = null;
const pages = {
  alimama_login: null,
  alimama_is_login: null,
  weibo: null,
};

let cookies = {
  alimama: {}
}


const status = {
  alimama: { login: false }
};

function getPage(key) {
  return (!browser ? puppeteer.launch({
    headless: false,
    userDataDir: path.resolve(__dirname, './chrome'),
    args: ['--disable-web-security'],
    // dumpio: true,
  }) : Promise.resolve(browser))
    .then(bsr => {
      browser = bsr;
      if (!pages[key]) {
        return bsr.newPage()
      }
      return Promise.resolve(pages[key]);
    })
    .then((page) => {
      return pages[key] = page;
    })
    .then(page => {
      return page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36').then(() => {
        return page;
      });
    })
    .then(page => {
      return page.setExtraHTTPHeaders({
        'accept-language': 'zh-CN,zh;q=0.8,en;q=0.6'
      }).then(() => {
        return page;
      });
    })
    .then(page => {
      return page.setViewport({
        width: 1366,
        height: 768,
        deviceScaleFactor: 2,
      }).then(() => {
        pages[key] = page;
        return page;
      });
    });
}

function newPage(key) {
  return (!browser ? puppeteer.launch({
    headless: false,
    userDataDir: path.resolve(__dirname, './chrome'),
    args: ['--disable-web-security'],
    // dumpio: true,
  }) : Promise.resolve(browser))
  .then(b => {
    return b.newPage();
  });
}


function login(url, successSelector) {
  let _page;
  return getPage('alimama_login')
  .then(page => {
    _page = page;
    return page.goto(url || LOGIN_URL, {waitUntil: 'networkidle'});
  })
  .then(delay.bind(null, 1000))
  .then(() => {
    _page.waitForSelector('#J_AkeyLogin', {visible: true});
  })
  .then(() => {
    console.log('检测到一键登录可用，请点击屏幕上按钮并用手机登陆');   
    return delay(2000);
  }, () => {
    console.log('请扫码登陆！');
    return delay(2000);
  })
  .then(() => {
    return _page.waitForSelector(successSelector || '#J_menu_product', {
      visible: true
    })
    .then(() => {
      return _page.waitForNavigation({
        waitUntil: 'networkidle',
        networkIdleTimeout: 2000
      });
    })
    .then(() => {
      console.log('登陆成功！！！');
      status.alimama.login = true;
    })
    .then(delay.bind(null, 1000))
    .then(()=> {
      return _page.cookies();
    })
    .then(c => {
      cookies.alimama = c;
      fs.writeFileSync(path.resolve(__dirname, 'cookie_wck'), JSON.stringify(c));
      return c;
    })
    .then((c) => {
      // return _page.close();
    });
  });
}

function refresh() {
  let page;
  return getPage('alimama_login').then(p => {
    return page = p;
  })
  // .then(() => {
  //   return page.cookies();
  // })
  .then(() => {
    // let c = fs.readFileSync(path.resolve(__dirname, 'cookie_wck'), 'utf8');
    // console.log(c);
    // return page.setCookie(...JSON.parse(c));
  })
  .then(() => {
    return page.goto('https://pub.alimama.com', {waitUntil: 'networkidle'});
  })
  .then(() => {
    return page.waitForSelector('#J_menu_product', {visible: true, timeout: 1000});
  })
  .then(() => {
    return page.cookies();
  })
  .then((c) => {
    console.log('持久化新的cookie到文件');
    cookies.alimama = c;
    fs.writeFileSync(path.resolve(__dirname, 'cookie_wck'), JSON.stringify(c));
  })
  .catch(e => {
    console.log(e);
  });
}

function sync(url) {
  let page = null;
  return getPage('sync_daily').then(p => {
    return page = p;
  })
  .then(() => {
    return page.goto('https://pub.alimama.com', {waitUntil: 'networkidle'});
  })
  .then(() => {
    return page.waitForSelector('#J_menu_product', {visible: true, timeout: 1000});
  })
  .then(() => {
    return page.cookies();
  })
  .then((c) => {
    const cookie = c.map(cookie => (`${cookie.name}=${cookie.value}`)).join('; ');
    if (!cookie) return Promise.reject('cookie is empty');
    fetch(url, {
      method: 'GET',
      headers: {
        cookie: cookie,
        'accept': '*/*',
        'accept-encoding': 'gzip, deflate, br'
      }
    }).then(res => {
      const downloadPath = path.resolve(__dirname, './test'+ new Date().valueOf() +'.xls');
      const dest = fs.createWriteStream(downloadPath);
      console.log('检查登陆成功， 开始下载文件，预计10-60秒');
      const stream = res.body.pipe(dest);
      stream.on('finish', function () {
        console.log('文件下载成功！即将开始同步');
        syncXls(downloadPath);
      });
    }, err => {
      console.log(err);
    });
  }, (err) => {
    console.log('同步每日精品数据失败，可能还没有登陆！', err);
  });
}


module.exports = {
  getPage,
  login,
  loginTmall: login.bind(null, TMALL_LOGIN_URL, '.j_Username'),
  sync,
  syncDaily: sync.bind(null, DOWNLOAD_DAILY),
  sync1111:sync.bind(null, DOWNLOAD_1111),
  refresh,
  newPage
}