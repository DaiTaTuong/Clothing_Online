const rows = [
  ['linen-shirt','Sơ mi linen Mộc','tops','shirt','Trắng ngà','#eee8d9',489000,'office casual','light medium deep','relaxed','Mới','Linen thoáng, vai thả nhẹ và cổ mở.'],
  ['tailored-trouser','Quần ống suông Atelier','bottoms','pants','Nâu đất','#89745c',629000,'office formal','light medium','classic','Bán chạy','Lưng cao, hai ly trước và đường may thẳng.'],
  ['olive-dress','Đầm midi Olive','dresses','dress','Xanh ô liu','#6f7850',789000,'casual office','medium deep','minimal','Mới','Dáng midi, eo chiết nhẹ, cổ vuông.'],
  ['navy-blazer','Blazer cổ ve Muse','tops','blazer','Xanh navy','#343d4e',899000,'office formal','light medium deep','classic','','Vai đứng và đường cắt gọn.'],
  ['ivory-tee','Áo thun cotton Everyday','tops','tee','Kem','#e7d9c1',279000,'casual office','light medium deep','minimal','','Cotton dày vừa, cổ tròn.'],
  ['blue-shirt','Sơ mi xanh Oxford','tops','shirt','Xanh phấn','#9db7ca',529000,'office casual','light medium deep','classic','','Vải Oxford, form rộng vừa.'],
  ['rose-knit','Áo dệt kim Rosé','tops','knit','Hồng đất','#b77679',459000,'office casual','light medium','classic','','Dệt gân mảnh, bo nhẹ.'],
  ['black-top','Áo sát nách Line','tops','tank','Đen','#363331',329000,'casual formal','light medium deep','minimal','','Cổ vuông và đường may ôm nhẹ.'],
  ['sage-tee','Áo thun Sage','tops','tee','Xanh sage','#8c9b84',319000,'casual','medium deep','relaxed','','Thun cotton mềm, dễ phối.'],
  ['brown-knit','Áo len mỏng Cacao','tops','knit','Nâu cacao','#906650',549000,'office casual','light medium','relaxed','','Mặt dệt nhẹ và cổ chữ V.'],
  ['black-trouser','Quần tây Noir','bottoms','pants','Đen','#383638',599000,'office formal','light medium deep','classic','','Quần dài có ly, cạp cao.'],
  ['blue-jeans','Jeans ống đứng Indigo','bottoms','pants','Xanh denim','#677e9c',579000,'casual','light medium deep','relaxed','','Denim xanh vừa, dáng ống đứng.'],
  ['cream-skirt','Chân váy chữ A Sable','bottoms','skirt','Be cát','#d1bd9e',459000,'office casual','medium deep','minimal','','Cạp gọn và đường xòe chữ A.'],
  ['wine-skirt','Chân váy midi Merlot','bottoms','skirt','Đỏ rượu','#783e4a',589000,'office formal','light medium deep','classic','','Midi rủ nhẹ, đường gấp tinh giản.'],
  ['olive-shorts','Quần shorts Safari','bottoms','shorts','Xanh rêu','#777c5b',379000,'casual','medium deep','relaxed','','Cạp cao, hai túi hông.'],
  ['ivory-pants','Quần linen Lumi','bottoms','pants','Trắng ngà','#e2d5be',649000,'casual office','medium deep','minimal','','Linen sáng, ống rộng.'],
  ['navy-skirt','Chân váy navy Prelude','bottoms','skirt','Xanh navy','#40495f',499000,'office','light medium deep','classic','','Váy chữ A dáng dài.'],
  ['black-dress','Đầm đen Nocturne','dresses','slip','Đen','#39373c',849000,'formal','light medium deep','minimal','','Đầm hai dây dáng suông.'],
  ['brick-dress','Đầm cổ V Terracotta','dresses','wrap','Cam đất','#b66049',759000,'casual formal','medium deep','classic','','Cổ V, đường vạt chéo.'],
  ['cloud-dress','Đầm sơ mi Cloud','dresses','shirtDress','Xanh phấn','#9dafbd',729000,'office casual','light medium deep','relaxed','','Cổ sơ mi và đai eo.'],
  ['pearl-dress','Đầm hai dây Pearl','dresses','slip','Kem ngọc trai','#e4d5bc',799000,'formal casual','medium deep','minimal','','Hai dây mảnh và chân váy rủ.'],
  ['plum-dress','Đầm midi Prune','dresses','dress','Tím mận','#76566d',829000,'formal office','light medium','classic','','Thân ôm nhẹ với cổ vuông.'],
  ['navy-dress','Đầm quấn Midnight','dresses','wrap','Xanh navy','#454c62',869000,'office formal','light medium deep','classic','','Vạt quấn, đai eo liền.'],
  ['sage-dress','Đầm sơ mi Jardin','dresses','shirtDress','Xanh sage','#84977c',699000,'casual office','medium deep','relaxed','','Đầm sơ mi với hàng cúc dọc.'],
];
const chart = (category, form) => Object.fromEntries(['XS','S','M','L','XL'].map((size, i) => {
  const ease = form === 'relaxed' ? 3 : 0;
  return [size, { bust: 82 + 4*i + ease + (category === 'tops' ? 1 : 0), waist: 64 + 5*i + ease, hip: 88 + 5*i + ease }];
}));
export const products = rows.map(([id,name,category,cut,color,hex,price,occasions,tones,form,badge,description], i) => ({
  id, name, category, cut, color, hex, price, occasions: occasions.split(' '), tones: tones.split(' '), form, badge, description,
  image: `/images/products/${id}.webp`, garmentImage: `/images/garments/${id}.jpg`, imageVersion: '1',
  createdAt: new Date(Date.UTC(2026, 8, 1 + (i < 4 ? 28 - i : i))).toISOString(),
  stock: { XS: 5, S: 8, M: 9, L: 6, XL: i % 7 === 0 ? 0 : 4 }, sizeChart: chart(category, form),
}));
export const byId = new Map(products.map(p => [p.id,p]));
