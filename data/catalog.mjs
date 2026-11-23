const rows = [
  ['linen-shirt','Sơ mi linen Mộc','tops','shirt','Trắng ngà','#d1d1c6',489000,'office casual','light medium deep','relaxed','Mới','Linen thoáng, vai thả nhẹ và cổ mở.'],
  ['tailored-trouser','Quần ống suông Atelier','bottoms','pants','Nâu đất','#7f6759',629000,'office formal casual','light medium deep','classic','Bán chạy','Lưng cao, hai ly trước và đường may thẳng.'],
  ['olive-dress','Đầm midi Olive','dresses','dress','Xanh ô liu','#167962',789000,'casual office formal','light medium deep','minimal','Mới','Dáng midi, eo chiết nhẹ, cổ vuông.'],
  ['navy-blazer','Blazer cổ ve Muse','tops','blazer','Xanh navy','#164472',899000,'office formal casual','light medium deep','classic','Bán chạy','Vai đứng và đường cắt gọn.'],
  ['ivory-tee','Áo thun cotton Everyday','tops','tee','Kem','#efeeed',279000,'casual office','light medium deep','minimal','Bán chạy','Cotton dày vừa, cổ tròn.'],
  ['blue-shirt','Sơ mi xanh Oxford','tops','shirt','Xanh phấn','#c6d5da',529000,'office casual','light medium deep','classic','Yêu thích','Vải Oxford, form rộng vừa.'],
  ['rose-knit','Áo dệt kim Rosé','tops','knit','Hồng đất','#d69499',459000,'office casual','light medium deep','classic','Thanh lịch','Dệt gân mảnh, bo nhẹ.'],
  ['black-top','Áo sát nách Line','tops','tank','Đen','#292738',329000,'casual formal office','light medium deep','minimal','Thiết kế','Cổ vuông và đường may ôm nhẹ.'],
  ['sage-tee','Áo thun Sage','tops','tee','Xanh sage','#9b9c99',319000,'casual office','light medium deep','relaxed','Mới','Thun cotton mềm, dễ phối.'],
  ['brown-knit','Áo len mỏng Cacao','tops','knit','Nâu cacao','#c3a898',549000,'office casual','light medium deep','relaxed','Mới','Mặt dệt nhẹ và cổ chữ V.'],
  ['black-trouser','Quần tây Noir','bottoms','pants','Đen','#525152',599000,'office formal casual','light medium deep','classic','Bán chạy','Quần dài có ly, cạp cao.'],
  ['blue-jeans','Jeans ống đứng Indigo','bottoms','pants','Xanh denim','#335268',579000,'casual office','light medium deep','relaxed','Phổ biến','Denim xanh vừa, dáng ống đứng.'],
  ['cream-skirt','Chân váy chữ A Sable','bottoms','skirt','Be cát','#e4dcd0',459000,'office casual formal','light medium deep','minimal','Thanh lịch','Cạp gọn và đường xòe chữ A.'],
  ['wine-skirt','Chân váy midi Merlot','bottoms','skirt','Đỏ rượu','#24252e',589000,'office formal casual','light medium deep','classic','Nổi bật','Midi rủ nhẹ, đường gấp tinh giản.'],
  ['olive-shorts','Quần shorts Safari','bottoms','shorts','Xanh rêu','#a9a49e',379000,'casual','light medium deep','relaxed','Năng động','Cạp cao, hai túi hông.'],
  ['ivory-pants','Quần linen Lumi','bottoms','pants','Trắng ngà','#b6ab9d',649000,'casual office formal','light medium deep','minimal','Mới','Linen sáng, ống rộng.'],
  ['navy-skirt','Chân váy navy Prelude','bottoms','skirt','Xanh navy','#363645',499000,'office casual formal','light medium deep','classic','Bán chạy','Váy chữ A dáng dài.'],
  ['black-dress','Đầm đen Nocturne','dresses','slip','Đen','#7b7672',849000,'formal casual','light medium deep','minimal','Dự tiệc','Đầm hai dây dáng suông.'],
  ['brick-dress','Đầm cổ V Terracotta','dresses','wrap','Cam đất','#a9675d',759000,'casual formal office','light medium deep','classic','Nổi bật','Cổ V, đường vạt chéo.'],
  ['cloud-dress','Đầm sơ mi Cloud','dresses','shirtDress','Xanh phấn','#a0cbee',729000,'office casual','light medium deep','relaxed','Mới','Cổ sơ mi và đai eo.'],
  ['pearl-dress','Đầm hai dây Pearl','dresses','slip','Kem ngọc trai','#dadada',799000,'formal casual','light medium deep','minimal','Cao cấp','Hai dây mảnh và chân váy rủ.'],
  ['plum-dress','Đầm midi Prune','dresses','dress','Tím mận','#756181',829000,'formal office casual','light medium deep','classic','Thanh lịch','Thân ôm nhẹ với cổ vuông.'],
  ['navy-dress','Đầm quấn Midnight','dresses','wrap','Xanh navy','#768b8e',869000,'office formal casual','light medium deep','classic','Bán chạy','Vạt quấn, đai eo liền.'],
  ['sage-dress','Đầm sơ mi Jardin','dresses','shirtDress','Xanh sage','#9e9a97',699000,'casual office','light medium deep','relaxed','Mới','Đầm sơ mi với hàng cúc dọc.'],
];
const chart = (category, form) => Object.fromEntries(['XS','S','M','L','XL'].map((size, i) => {
  const ease = form === 'relaxed' ? 3 : 0;
  return [size, { bust: 82 + 4*i + ease + (category === 'tops' ? 1 : 0), waist: 64 + 5*i + ease, hip: 88 + 5*i + ease }];
}));
export const products = rows.map(([id,name,category,cut,color,hex,price,occasions,tones,form,badge,description], i) => ({
  id, name, category, cut, color, hex, price, occasions: occasions.split(' '), tones: tones.split(' '), form, badge, description,
  image: `/images/products/${id}.webp`, garmentImage: `/images/garments/${id}.png`, imageVersion: '5',
  createdAt: new Date(Date.UTC(2026, 8, 1 + (i < 4 ? 28 - i : i))).toISOString(),
  stock: { XS: 5, S: 8, M: 9, L: 6, XL: i % 7 === 0 ? 0 : 4 }, sizeChart: chart(category, form),
}));
export const byId = new Map(products.map(p => [p.id,p]));
