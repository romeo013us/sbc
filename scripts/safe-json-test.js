'use strict';
const assert=require('assert');
const {parseJson,stringifyJson}=require('../enterprise/sbc-safe-json');
const object={ok:true,nested:{n:2}};
assert.deepStrictEqual(parseJson(object,{}),object);
assert.deepStrictEqual(parseJson('{"ok":true}',{}),{ok:true});
assert.deepStrictEqual(parseJson(Buffer.from('{"buffer":true}'),{}),{buffer:true});
assert.deepStrictEqual(parseJson('{bad',{}),{});
assert.deepStrictEqual(parseJson(null,{fallback:true}),{fallback:true});
assert.strictEqual(stringifyJson(object),'{"ok":true,"nested":{"n":2}}');
console.log(JSON.stringify({ok:true,version:'60.4.5',checks:[
  'object-boundary-no-json-parse-coercion',
  'string-json-parse',
  'buffer-json-parse',
  'invalid-json-fallback',
  'null-fallback',
  'stable-json-stringify'
].map(name=>({name,ok:true}))},null,2));
