var fs = require('fs');
var path = require('path');
var existsSync = fs.existsSync || path.existsSync;

var sourcePath = path.join(__dirname, 'source');
var sourceBlogPath = path.join(sourcePath, 'blog');

var entriesPath;

//var Showdown = require('showdown');
//var showdown = (new Showdown.converter).makeHtml;
var marked = require('marked');
marked.setOptions({ gfm: true, breaks: true });
var entryObj, entryList, entrySelected;
var selectedIndex = [1, 3];
function updateEntryList() {
entriesPath = fs.readdirSync(sourceBlogPath)
  .filter(function (filename) { return filename.match(/\d+\.md$/i); })
  .sort(function (a, b) { return parseInt(b, 10) - parseInt(a, 10); })
  // 以文件名数字降序（几乎等同时间降序）

entryObj = entriesPath.map(function (filename) {
    var obj = {};
    obj.filename = filename;
    obj.index = parseInt(filename, 10);
    var filepath = path.join(sourceBlogPath, filename);
    obj.source = fs.readFileSync(filepath, 'utf-8');
    obj.source.replace(/<!--([^:]+):(.+?)-->/g, function (all, key, value) {
      key = key.trim();
      value = value.trim();
      if (key) {
        obj[key] = value;
      }
      return '';
    }).trim();
    obj.document = marked(obj.source);
    obj.document = obj.document.replace(/<h1[^>]*>(.+?)<\/h1>/i, function (all, title) {
      obj.title = title;
      return '';
    }).trim();
    obj.title = obj.title || '';
    return obj;
  });
  entryList = entryObj.map(function (obj) {
    return {
      filename: obj.filename,
      index: obj.index,
      title: obj.title,
      date: obj.date,
      description: obj.description
    };
  });
  // 精选文章，以文件名定
  entrySelected = entryList.filter(function (obj) {
    return ~selectedIndex.indexOf(obj.index);
  });
}
updateEntryList();

var jade = require('jade');

function tplfunc(filename) {
  if (!filename.match(/\.jade$/i)) filename += '.jade';
  var filepath = path.join(__dirname, 'views', filename);
  return jade.compile(fs.readFileSync(filepath, 'utf-8'), {
    filename: filepath
  });
}
var tpls = ['document'];
var tpl = {};
tpls.map(function (tplname) {
  tpl[tplname] = tplfunc(tplname);
})

var connect = require('connect');

function index(n) {
  var i, l;
  var filename = n + '.md';
  for (i = 0, l = entryObj.length; i < l; i++) {
    if (filename == entryObj[i].filename) return i;
  }
  return -1;
}

function extend(obj) {
  if (!obj) return {};
  Array.prototype.slice.call(arguments, 1).forEach(function (eo) {
    Object.keys(eo || {}).forEach(function (k) {
      obj[k] = eo[k];
    });
  });
  return obj;
}

if (~process.argv.indexOf('gen') || ~process.argv.indexOf('generate')) {
  var blogPath = path.join(__dirname, 'blog');
  if (!existsSync(blogPath)) fs.mkdirSync(blogPath);
  entryObj.forEach(function (obj, k) {
    var html = tplfunc('document')(extend(obj, {
      prev: entryObj[k+1],
      next: entryObj[k-1],
      type: k == 0 ? 'latest' : 'normal'
    }));
    fs.writeFileSync(path.join(blogPath, obj.index + '.html'), html, 'utf8');
    if (k == 0) fs.writeFileSync(path.join(__dirname, 'index.html'), html, 'utf8');
  });
  fs.writeFileSync(path.join(__dirname, 'selected.html'), tplfunc('list')({
    list: entrySelected,
    type: 'selected'
  }), 'utf8');
  fs.writeFileSync(path.join(__dirname, 'all.html'), tplfunc('list')({
    list: entryList,
    type: 'all'
  }), 'utf8');
  fs.writeFileSync(path.join(__dirname, 'rss.xml'), tplfunc('rss')({
    items: entryObj,
    type: 'rss'
  }), 'utf8');
  process.exit(0);
}

var server = connect();
server.use(connect.query());
server.use(function (req, res, next) {
  updateEntryList();
  var match;
  if ((match = req.url.match(/\/blog\/(\d+)(\.html)?/i))) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    var k = index(match[1]);
    if (k == -1) return next();
    var locals = entryObj[k];
    res.end(tplfunc('document')(extend(locals, {
      prev: entryObj[k+1],
      next: entryObj[k-1],
      type: k == 0 ? 'latest' : 'normal'
    })));
  } else if ((match = req.url.match(/\/(all|selected)(\.html)?/i))) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    var list = match[1] == 'selected' ? entrySelected : entryList;
    res.end(tplfunc('list')({
      list: list,
      type: match[1]
    }));
  } else if ((match = req.url.match(/\/(rss)(\.xml)?/i))) {
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.end(tplfunc('rss')(extend({}, {
      items: entryObj.slice(0, 10),
      type: 'rss'
    })));
  } else if (req.url == '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(tplfunc('document')(extend(entryObj[0], {
      prev: entryObj[1],
      type: 'latest'
    })));
  } else next();
});
server.use('/static', connect.static(path.join(__dirname, 'static')))

server.listen(3333);
