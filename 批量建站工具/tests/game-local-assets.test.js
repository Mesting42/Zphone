import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={};
const source=readFileSync(new URL('../game-builder/js/generator.js',import.meta.url),'utf8');
vm.runInNewContext(source.slice(0,source.indexOf('const Generator ='))+';this.assets=GameLocalAssets;',context);
describe('game export asset adapters',()=>{
 it('normalizes local aliases against actual packaged assets without mutating input',()=>{
  const data=[{url:'ball.html',gameFile:'ball.html',thumb:'ball.webp',coverFile:'ball.webp',description:'Original'}];
  const result=context.assets.exportData(data,'thumb',{'original/images/ball.webp':{}},{'ball.html':'game'});
  expect(JSON.parse(JSON.stringify(result))).toEqual([{url:'games/ball.html',gameFile:'games/ball.html',thumb:'images/ball.webp',coverFile:'images/ball.webp',description:'Original'}]);
  expect(data[0].url).toBe('ball.html');expect(data[0].thumb).toBe('ball.webp');
 });
 it('preserves remote URLs and unresolved references for the preflight to inspect',()=>{
  const data=[{url:'https://games.example/game.html',thumb:'missing.webp',coverFile:'https://images.example/a.webp'}];
  expect(JSON.stringify(context.assets.exportData(data,'thumb',{},{}))).toBe(JSON.stringify(data));
 });
 it('maps Windows paths and is idempotent',()=>{
  const data=[{game_file:'folder\\ball.html',image:'images/ball.webp'}];
  const once=context.assets.exportData(data,'image',{'ball.webp':{}},{'ball.html':''});
  expect(JSON.stringify(context.assets.exportData(once,'image',{'ball.webp':{}},{'ball.html':''}))).toBe(JSON.stringify(once));
 });
 it('repairs only the known game catalog navigation, retaining other game actions',()=>{
  const html='<a class="primary" href="index.html">游戏目录</a><a href="index.html">Restart</a><script>const file="index.html";</script>';
  expect(context.assets.catalogLinks(html)).toBe(html.replace('href="index.html">游戏目录','href="../index.html">游戏目录'));
 });
});
