'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveAsset } = require('../desktop/protocol.cjs');

const root = path.resolve(__dirname, '../dist');

test('app URLs resolve to confined build assets', () => {
  for (const [url, asset] of [
    ['vietlingo://app', 'index.html'],
    ['vietlingo://app/', 'index.html'],
    ['vietlingo://app/index.html#lesson', 'index.html'],
    ['vietlingo://app/assets/index.js?v=1', 'assets/index.js'],
    ['vietlingo://app/fonts/be-vietnam-pro.ttf', 'fonts/be-vietnam-pro.ttf'],
    ['vietlingo://app/icon.svg', 'icon.svg'],
    ['vietlingo://app/hello%20world.txt', 'hello world.txt'],
  ]) assert.equal(resolveAsset(url, root), path.resolve(root, asset));
});

test('untrusted URLs, traversal, private files and unsupported assets are rejected', () => {
  const urls = [
    'https://app/index.html', 'file:///index.html', 'vietlingo://evil/index.html',
    'vietlingo://user@app/index.html', 'vietlingo://app:80/index.html',
    'vietlingo://app.evil/index.html', 'vietlingo://app/../index.html',
    'vietlingo://app/assets/../../index.html', 'vietlingo://app/%2e%2e/index.html',
    'vietlingo://app/assets/%2E%2E/index.html', 'vietlingo://app/%252e%252e/index.html',
    'vietlingo://app/assets%2findex.js', 'vietlingo://app/assets%5cindex.js',
    'vietlingo://app/assets\\index.js', 'vietlingo://app/.env',
    'vietlingo://app/.private/config.json', 'vietlingo://app/.git/config.json',
    'vietlingo://app/node_modules/module/index.js', 'vietlingo://app/desktop/main.js',
    'vietlingo://app/package.json', 'vietlingo://app/index.html.exe',
    'vietlingo://app/source.map', 'vietlingo://app/assets/',
    'vietlingo://app//index.html', 'vietlingo://app/C:/index.html',
    'vietlingo://app/index.html:secret.txt', 'vietlingo://app/%00index.html',
    'vietlingo://app/%zz.js', 'vietlingo://app/CON.txt', ' vietlingo://app/index.html',
  ];
  for (const url of urls) assert.throws(() => resolveAsset(url, root), undefined, url);
});

test('resolver is pure and does not require an existing file', () => {
  assert.equal(resolveAsset('vietlingo://app/not-built-yet.js', root), path.join(root, 'not-built-yet.js'));
});
