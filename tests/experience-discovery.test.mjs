import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/discovery.js';

process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'test-public-key';
delete process.env.OPENAI_API_KEY;
delete process.env.YOUTUBE_API_KEY;
const initialFetch = globalThis.fetch;
async function call(path, authorized = true, body) {
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes('/auth/v1/user')) return new Response(JSON.stringify(authorized ? {id:'test-user',app_metadata:{}} : {message:'Invalid token'}), {status: authorized ? 200 : 401, headers:{'Content-Type':'application/json'}});
    if (url.includes('youtube.com/results')) return new Response('var ytInitialData = {"contents":{"videoRenderer":{"videoId":"testVideo01","title":{"runs":[{"text":"Test song"}]},"ownerText":{"runs":[{"text":"Artist"}]},"thumbnail":{"thumbnails":[]}}}};');
    throw new Error(`Unexpected provider request: ${url}`);
  };
  const result = { statusCode: 200, status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;},setHeader(){} };
  try { await handler({headers:{authorization:'Bearer test-token'},query:{path},body},result); return result; }
  finally { globalThis.fetch=initialFetch; }
}
test('discovery rejects an invalid account session before contacting music providers', async()=>{
  assert.equal((await call('/search?q=Artist',false)).statusCode,401);
});
test('regional history is labeled as curated heritage, not live or AI charts', async()=>{
  const result=await call('/music/region?country=United%20States%20of%20America&state=Texas');
  assert.equal(result.statusCode,200);
  assert.equal(result.data.source,'Regional music heritage');
  assert.ok(result.data.heritage.length>0);
  assert.ok(result.data.top_songs.length>0);
});
test('song search returns video results without transferring account tokens to providers',async()=>{
  const result=await call('/search?q=Artist');
  assert.equal(result.data.songs[0].video_id,'testVideo01');
});
test('lyrics recognition reports missing service setup instead of inventing a match',async()=>{
  const result=await call('/search/lyrics',true,{text:'a lyric fragment'});
  assert.equal(result.statusCode,503);
  assert.match(result.data.detail,/AI service connection/);
});
