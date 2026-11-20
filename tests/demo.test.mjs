import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import sharp from 'sharp';
import { createApp } from '../backend/src/server.mjs';
import { answer, ranked } from '../backend/src/modules/stylist/rules.mjs';
import { products } from '../data/catalog.mjs';
import { sampleProfile } from '../shared/contracts/index.mjs';

test('stylist queries honor the category, color, occasion, stock and budget', () => {
  const cases = [
    ['áo sơ mi đi làm cho da ngăm dưới 500k', p=>p.cut==='shirt'&&p.occasions.includes('office')&&p.tones.includes('deep')&&p.price<=500000],
    ['quần đi làm dưới 650k',p=>p.category==='bottoms'&&p.occasions.includes('office')&&p.price<=650000],
    ['đầm dự tiệc dưới 900k',p=>p.category==='dresses'&&p.occasions.includes('formal')&&p.price<=900000],
    ['chân váy đỏ rượu',p=>p.cut==='skirt'&&p.color==='Đỏ rượu'],
    ['blazer xanh navy',p=>p.cut==='blazer'&&p.color==='Xanh navy'],
    ['áo size XL',p=>p.category==='tops'&&p.stock.XL>0],
    ['đầm dạo phố cho da sáng',p=>p.category==='dresses'&&p.occasions.includes('casual')&&p.tones.includes('light')],
    ['quần jeans',p=>p.id==='blue-jeans'],
    ['áo dưới 300.000',p=>p.category==='tops'&&p.price<=300000],
    ['đầm dưới 1,2 triệu',p=>p.category==='dresses'&&p.price<=1200000],
  ];
  for (const [q,accept] of cases) {
    const { results } = ranked({q},sampleProfile);
    assert.ok(results.length,q);
    assert.ok(results.every(r=>accept(r.product)),q);
  }
  assert.equal(ranked({q:'xyz123'}).results.length,0);
  assert.equal(ranked({q:'đầm dưới 50k'}).results.length,0);
  const set=ranked({q:'phối set đi làm dưới 1,2 triệu'},sampleProfile).results;
  assert.equal(set.length,2);
  assert.ok(set.reduce((n,r)=>n+r.product.price,0)<=1200000);
  assert.match(answer('Tôi mặc size gì?',null,products[0]).text,/số đo/);
  assert.match(answer('Tôi mặc size gì?',{...sampleProfile,bust:89},products[0]).text,/size S/);
  assert.deepEqual(Object.values(Object.groupBy(products,p=>p.category)).map(group=>group.length),[8,8,8]);
});

test('guest and account retain their own data, with validated cart and cached try-on', async t => {
  const {server,store}=await createApp({file:':memory:',demo:true});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.db.close();});
  const origin='http://127.0.0.1:'+server.address().port;
  function client(){
    let sid='';
    return async (path,method='GET',body,expect=200) => {
      const r=await fetch(origin+'/api'+path,{method,headers:{Cookie:sid,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
      const c=r.headers.get('set-cookie');if(c)sid=c.split(';')[0];
      assert.equal(r.status,expect,`${method} ${path}`);
      return r.headers.get('content-type')?.startsWith('image/')?Buffer.from(await r.arrayBuffer()):r.json();
    };
  }
  const a=client(), b=client();
  const guest=await a('/session'), other=await b('/session');
  assert.notEqual(other.conversationId,guest.conversationId);
  await a('/admin/overview','GET',undefined,403);
  await a('/profile','PUT',{...sampleProfile,height:210},422);
  const session=await a('/profile','PUT',sampleProfile);
  assert.equal(session.profileVersion,1);
  const d={productId:'linen-shirt',size:'S',quantity:1};
  assert.equal((await a('/cart/items','POST',d)).total,489000);
  await a('/cart/items','PATCH',{...d,quantity:99},422);
  assert.equal((await b('/cart')).count,0);
  const chat=await a('/chat','POST',{message:'áo sơ mi đi làm cho da ngăm dưới 500k'});
  assert.deepEqual(chat.messages[1].cards.map(x=>x.productId),['linen-shirt']);
  await b('/conversations/'+chat.conversationId,'GET',undefined,404);
  const png=await sharp({create:{width:90,height:90,channels:3,background:'#c29d85'}}).png().toBuffer();
  await a('/media','POST',{image:'data:image/png;base64,YWJjZA=='},422);
  const media=await a('/media','POST',{image:'data:image/png;base64,'+png.toString('base64')},201);
  assert.equal((await a('/session')).faceId,media.id);
  await b('/media/'+media.id,'GET',undefined,404);
  await a('/media/'+media.id,'DELETE');
  await a('/media/'+media.id,'GET',undefined,404);
  const current=await a('/session');
  const jobBody={profileVersion:current.profileVersion,productId:d.productId};
  await a('/try-ons','POST',{...jobBody,profileVersion:1},409);
  const queued=await a('/try-ons','POST',jobBody,202);
  assert.equal((await a('/try-ons','POST',jobBody,202)).jobId,queued.jobId);
  await b('/jobs/'+queued.jobId,'GET',undefined,404);
  let job=queued;
  for(let i=0;i<30&&['queued','processing'].includes(job.status);i++){await sleep(75);job=await a('/jobs/'+queued.jobId);}
  assert.equal(job.status,'completed');assert.equal(job.mode,'2d');
  const {width,height}=await sharp(await a(job.imageUrl.slice(4))).metadata();
  assert.deepEqual([width,height],[768,1024]);
  await b(job.imageUrl.slice(4),'GET',undefined,404);
  assert.equal((await a('/try-ons/'+job.jobId,'PATCH',{})).saved,true);
  const account=await a('/auth/register','POST',{name:'Người thử',email:'demo-test@example.com',password:'DemoPassword2026'},201);
  assert.equal(account.user.role,'member');
  assert.equal(account.cart.count,1);
  assert.equal(account.profile.height,165);
  assert.equal((await a('/try-ons')).items[0].jobId,job.jobId);
  assert.equal((await a('/conversations/'+account.conversationId)).messages.length,2);
  await a('/admin/overview','GET',undefined,403);
  assert.equal((await a('/auth/logout','POST')).cart.count,0);
  assert.equal((await a('/auth/login','POST',{email:'demo-test@example.com',password:'DemoPassword2026'})).cart.count,1);
  const admin=await b('/auth/login','POST',{email:'studio@forme.demo',password:'FormeStudio2026!'});
  assert.equal(admin.user.role,'admin');
  assert.equal((await b('/admin/overview')).products,24);
});
