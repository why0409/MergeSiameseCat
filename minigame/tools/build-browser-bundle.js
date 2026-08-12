/**
 * 把 CommonJS 模块打成浏览器可运行的单文件（本地预览用，非微信必需）
 * 用法: node tools/build-browser-bundle.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outFile = path.join(root, 'tools', 'browser-bundle.js');

const files = [
  'js/config.js',
  'js/storage.js',
  'js/assets.js',
  'js/physics.js',
  'js/game.js',
  'js/renderer.js',
  'js/main.js',
];

function wrap(moduleName, code) {
  // 将 module.exports / require 映射到简易 registry
  return `
// ---- ${moduleName} ----
__modules[${JSON.stringify(moduleName)}] = function(module, exports, require) {
${code}
};
`;
}

let bundle = `/* auto-generated browser bundle — do not edit */
(function(){
var __modules = {};
var __cache = {};
function __normalize(from, req) {
  if (req.indexOf('.') !== 0) return req;
  var parts = from.split('/');
  parts.pop();
  req.split('/').forEach(function(p) {
    if (p === '..') parts.pop();
    else if (p !== '.') parts.push(p);
  });
  return parts.join('/');
}
function require(from, req) {
  var name = __normalize(from, req);
  if (!/\\.js$/.test(name)) name += '.js';
  // strip leading ./
  name = name.replace(/^\\.\\//, '');
  if (__cache[name]) return __cache[name].exports;
  var factory = __modules[name];
  if (!factory) {
    // try without js/ prefix variants
    var alt = name.replace(/^js\\//, '');
    factory = __modules[name] || __modules['js/' + alt] || __modules[alt];
    if (factory) name = __modules[name] ? name : (__modules['js/' + alt] ? 'js/' + alt : alt);
  }
  if (!factory) throw new Error('Cannot find module ' + req + ' (as ' + name + ') from ' + from);
  var module = { exports: {} };
  __cache[name] = module;
  factory(module, module.exports, function(r) { return require(name, r); });
  return module.exports;
}
`;

for (const f of files) {
  const abs = path.join(root, f);
  let code = fs.readFileSync(abs, 'utf8');
  // main 里不要二次 boot 问题 — 原样
  bundle += wrap(f, code);
}

bundle += `
// boot
require('', 'js/main.js');
})();
`;

fs.writeFileSync(outFile, bundle);
console.log('wrote', outFile, (bundle.length / 1024).toFixed(1) + 'KB');
