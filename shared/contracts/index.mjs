export const tones = [
  { name: 'Sáng hồng', color: '#f3c8b1', group: 'light' }, { name: 'Sáng ấm', color: '#eab99a', group: 'light' },
  { name: 'Trung tính', color: '#ce9673', group: 'medium' }, { name: 'Nâu mật', color: '#b57951', group: 'medium' },
  { name: 'Nâu ấm', color: '#965a3a', group: 'deep' }, { name: 'Nâu sâu', color: '#70432e', group: 'deep' },
];
export const measurements = {
  height: ['Chiều cao', 145, 190, 'cm'], weight: ['Cân nặng', 40, 100, 'kg'],
  bust: ['Vòng ngực', 65, 135, 'cm'], waist: ['Vòng eo', 50, 125, 'cm'], hip: ['Vòng hông', 70, 145, 'cm'],
};
export const sampleProfile = { height: 165, weight: 54, bust: 86, waist: 69, hip: 93, tone: 2, style: '', faceShape: '' };
export const categoryNames = { tops: 'Áo', bottoms: 'Quần & váy', dresses: 'Đầm liền' };
export const occasionNames = { office: 'Đi làm', casual: 'Dạo phố', formal: 'Dự tiệc' };
export const styles = { minimal: 'Tối giản', classic: 'Thanh lịch', relaxed: 'Thoải mái' };
export const faceShapes = { oval: 'Trái xoan', round: 'Tròn', square: 'Vuông', heart: 'Trái tim' };
export const money = n => `${new Intl.NumberFormat('vi-VN').format(n)} ₫`;
export const skinGroup = p => tones[p?.tone ?? 2]?.group;
export function bodyShape(p) {
  if (!p) return '';
  if (p.hip - p.bust > 8) return 'dáng quả lê';
  if (p.bust - p.hip > 8) return 'dáng tam giác ngược';
  return Math.min(p.bust, p.hip) - p.waist >= 21 ? 'dáng đồng hồ cát' : 'dáng thẳng';
}
export function fitSize(product, profile) {
  const keys = { tops: ['bust'], bottoms: ['waist', 'hip'], dresses: ['bust', 'waist', 'hip'] }[product.category];
  if (!profile || !keys.every(k => Number.isFinite(profile[k]))) return null;
  const size = Object.keys(product.sizeChart).find(s => keys.every(k => profile[k] <= product.sizeChart[s][k]));
  return size && product.stock[size] > 0 ? size : null;
}
