import { sampleProfile, tones } from './index.mjs';

export function mannequin(profile = sampleProfile, outfit = null, backdrop = '#F3F4F6') {
  const {height,weight,bust,waist,hip,tone} = profile;
  const skin = tones[tone].color, y = .92 + (height-145)*.0038;
  const B = 62+(bust-86)*.68+(weight-54)*.08, W = 49+(waist-69)*.6, H = 70+(hip-93)*.65, S = 75+(weight-54)*.28+(bust-86)*.18;
  const L = n => 384-n, R = n => 384+n;
  const torso = `M365 184 365 208Q352 216 ${L(S)} 235Q${L(B+8)} 262 ${L(B)} 331Q${L(W-9)} 377 ${L(W)} 414Q${L(H)} 460 ${L(H)} 518Q345 558 384 555Q423 558 ${R(H)} 518Q${R(H)} 460 ${R(W)} 414Q${R(W-9)} 377 ${R(B)} 331Q${R(B+8)} 262 ${R(S)} 235Q416 216 403 208L403 184Z`;
  const arm = `M${L(S-7)} 233Q${L(S+23)} 228 ${L(S+36)} 285L${L(S+60)} 392Q${L(S+67)} 420 ${L(S+67)} 436L${L(S+83)} 517Q${L(S+87)} 540 ${L(S+101)} 549Q${L(S+110)} 590 ${L(S+94)} 603Q${L(S+88)} 606 ${L(S+84)} 588L${L(S+81)} 570Q${L(S+76)} 574 ${L(S+73)} 565L${L(S+69)} 535 ${L(S+39)} 443Q${L(S+29)} 408 ${L(S+27)} 393L${L(S+10)} 319Q${L(S-2)} 297 ${L(S-7)} 274Z`;
  const leg = `M${L(H)} 488Q${L(H+11)} 545 ${L(H*.70)} 635Q${L(43)} 682 ${L(48)} 710Q${L(51)} 751 ${L(38)} 805L${L(33)} 860Q${L(44)} 884 ${L(56)} 896Q${L(58)} 907 ${L(21)} 906Q${L(9)} 902 ${L(11)} 890L${L(12)} 856Q${L(6)} 814 ${L(12)} 769L${L(15)} 708Q${L(10)} 679 ${L(13)} 643L${L(4)} 554 384 522Z`;
  const tank = `M${L(S-17)} 230 ${L(S-33)} 222Q${L(19)} 267 384 272Q${R(19)} 267 ${R(S-33)} 222L${R(S-17)} 230Q${R(S-17)} 280 ${R(B+1)} 292Q${R(B+4)} 332 ${R(W)} 371L${R(W)} 413Q384 425 ${L(W)} 413L${L(W)} 371Q${L(B+4)} 332 ${L(B+1)} 292Q${L(S-17)} 280 ${L(S-17)} 230Z`;
  const shorts = `M${L(W+5)} 421Q384 432 ${R(W+5)} 421Q${R(H+11)} 471 ${R(H+8)} 567L${R(12)} 573 384 550 ${L(12)} 573 ${L(H+8)} 567Q${L(H+11)} 471 ${L(W+5)} 421Z`;

  const top = outfit?.top || (outfit?.category === 'tops' ? outfit : null);
  const bottomItem = outfit?.bottom || (outfit?.category === 'bottoms' ? outfit : null);
  const dressItem = outfit?.dress || (outfit?.category === 'dresses' ? outfit : null);

  const topColor = top?.hex || '#a7a39c';
  const topCut = top?.cut;
  const bottomColor = bottomItem?.hex || '#767672';
  const bottomCut = bottomItem?.cut;
  const dressColor = dressItem?.hex || '#82817b';
  const dressCut = dressItem?.cut;

  const tankTop = `M${L(S-14)} 230 ${L(S-32)} 222 ${L(26)} 238 ${R(26)} 238 ${R(S-32)} 222 ${R(S-14)} 230Q${R(S-14)} 280 ${R(B+2)} 292Q${R(B+4)} 332 ${R(W)} 371L${R(W)} 413Q384 425 ${L(W)} 413L${L(W)} 371Q${L(B+4)} 332 ${L(B+2)} 292Q${L(S-14)} 280 ${L(S-14)} 230Z`;
  const upper = !top ? tank : (topCut === 'tank' ? tankTop :
    `M${L(S)} 230 ${L(28)} 216Q384 ${topCut === 'knit' ? 291 : 246} ${R(28)} 216L${R(S)} 230Q${R(S+27)} 243 ${R(S+35)} 268L${R(S+(topCut==='blazer'||topCut==='knit'?69:48))} ${topCut==='blazer'||topCut==='knit'?472:333} ${R(S+(topCut==='blazer'||topCut==='knit'?42:18))} ${topCut==='blazer'||topCut==='knit'?479:344} ${R(S+1)} 310Q${R(B+4)} 335 ${R(W)} 412L${R(H-7)} ${topCut==='blazer'?489:442}Q384 ${topCut==='blazer'?506:452} ${L(H-7)} ${topCut==='blazer'?489:442}L${L(W)} 412Q${L(B+4)} 335 ${L(S+1)} 310L${L(S+(topCut==='blazer'||topCut==='knit'?42:18))} ${topCut==='blazer'||topCut==='knit'?479:344} ${L(S+(topCut==='blazer'||topCut==='knit'?69:48))} ${topCut==='blazer'||topCut==='knit'?472:333} ${L(S+35)} 268Q${L(S+27)} 243 ${L(S)} 230Z`);
  const bottom = bottomCut === 'pants' ? `M${L(W+3)} 416Q384 427 ${R(W+3)} 416Q${R(H+9)} 469 ${R(H+6)} 528L${R(60)} 854 ${R(8)} 854 384 554 ${L(8)} 854 ${L(60)} 854 ${L(H+6)} 528Q${L(H+9)} 469 ${L(W+3)} 416Z` :
    bottomCut === 'skirt' ? `M${L(W+4)} 421Q384 432 ${R(W+4)} 421L${R(H+36)} 712Q384 734 ${L(H+36)} 712Z` : shorts;
  const dress = `M${L(S-15)} 229 ${L(S-31)} 219Q384 ${dressCut==='wrap'?298:271} ${R(S-31)} 219L${R(S-15)} 229Q${R(S-13)} 282 ${R(B)} 294Q${R(B+1)} 338 ${R(W)} 393Q${R(H+20)} 545 ${R(H+47)} 744Q384 778 ${L(H+47)} 744Q${L(H+20)} 545 ${L(W)} 393Q${L(B+1)} 338 ${L(B)} 294Q${L(S-13)} 282 ${L(S-15)} 229Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
  <defs>
    <linearGradient id="skin"><stop stop-color="#4c211e" stop-opacity=".25"/><stop offset=".26" stop-color="#fff3d9" stop-opacity=".22"/><stop offset=".56" stop-color="#fff3dc" stop-opacity=".03"/><stop offset="1" stop-color="#4c211e" stop-opacity=".28"/></linearGradient>
    <linearGradient id="cloth"><stop stop-color="#151615" stop-opacity=".28"/><stop offset=".3" stop-color="white" stop-opacity=".21"/><stop offset=".65" stop-color="white" stop-opacity=".03"/><stop offset="1" stop-color="#161616" stop-opacity=".25"/></linearGradient>
    <linearGradient id="hair"><stop stop-color="#17171a"/><stop offset=".5" stop-color="#483935"/><stop offset="1" stop-color="#17171a"/></linearGradient>
    <radialGradient id="shadow"><stop stop-color="#302b26" stop-opacity=".24"/><stop offset="1" stop-color="#302b26" stop-opacity="0"/></radialGradient>
    <g id="arm"><path d="${arm}" fill="${skin}" stroke="#663c31" stroke-opacity=".24"/><path d="${arm}" fill="url(#skin)"/></g>
    <g id="leg"><path d="${leg}" fill="${skin}" stroke="#663c31" stroke-opacity=".24"/><path d="${leg}" fill="url(#skin)"/></g>
  </defs>
  <rect width="768" height="1024" fill="${backdrop}"/><g transform="translate(0 ${(1-y)*260})">
  <ellipse cx="384" cy="${182+729*y+12}" rx="125" ry="20" fill="url(#shadow)"/>
  <g transform="translate(0 182) scale(1 ${y}) translate(0 -182)">
    <use href="#leg"/><use href="#leg" transform="translate(768) scale(-1 1)"/>
    <use href="#arm"/><use href="#arm" transform="translate(768) scale(-1 1)"/>
    <path d="${torso}" fill="${skin}"/><path d="${torso}" fill="url(#skin)"/>
    ${dressItem ? `<path d="${dress}" fill="${dressColor}"/><path d="${dress}" fill="url(#cloth)"/><path d="M${L(W)} 393Q384 411 ${R(W)} 393M378 412 352 735M408 412 448 734" fill="none" stroke="#221f1e" opacity=".28" stroke-width="2"/>` :
      `<path d="${bottom}" fill="${bottomItem ? bottomColor : '#767672'}"/><path d="${bottom}" fill="url(#cloth)"/>
       <path d="${upper}" fill="${top ? topColor : '#a7a39c'}"/><path d="${upper}" fill="url(#cloth)"/>
       ${['shirt','blazer'].includes(topCut) ? `<path d="M356 216 369 267 384 249 399 267 412 216M384 249V${topCut==='blazer'?496:444}" fill="none" stroke="#201d1a" opacity=".4" stroke-width="2"/>${[279,308,337,366,395,424].map(n=>`<circle cx="387" cy="${n}" r="2.6" fill="#201d1a" opacity=".53"/>`).join('')}` : topCut==='tank'&&top ? `<path d="M${L(26)} 238H${R(26)}" fill="none" stroke="#201d1a" opacity=".4" stroke-width="2"/>` : ''}
       ${bottomCut==='pants' ? '<path d="M384 442V546M345 455 352 841M423 455 416 841" fill="none" stroke="#28221d" stroke-width="2" opacity=".34"/>' : ''}`}
  </g>
  <ellipse cx="385" cy="85" rx="31" ry="31" fill="url(#hair)"/>
  <path d="M337 118Q333 80 366 73Q395 64 418 84Q439 100 431 149L425 181Q411 204 384 204Q354 202 343 181Z" fill="url(#hair)"/>
  <ellipse cx="343" cy="145" rx="8" ry="13" fill="${skin}"/><ellipse cx="425" cy="145" rx="8" ry="13" fill="${skin}"/>
  <path d="M347 121Q351 94 376 98Q406 82 422 115L421 153Q417 175 402 190Q384 204 365 190Q347 172 346 151Z" fill="${skin}"/>
  <path d="M347 121Q351 94 376 98Q406 82 422 115L421 153Q417 175 402 190Q384 204 365 190Q347 172 346 151Z" fill="url(#skin)"/>
  <path d="M351 127Q362 122 373 128M394 128Q405 122 416 127" fill="none" stroke="#49312e" stroke-width="2.7" stroke-linecap="round"/>
  <path d="M352 137Q361 131 373 138Q363 145 352 137M395 138Q405 131 416 137Q406 145 395 138" fill="#f8e6d1" stroke="#543633" stroke-width="1.2"/>
  <circle cx="363" cy="137.5" r="3.6" fill="#3a2b29"/><circle cx="405" cy="137.5" r="3.6" fill="#3a2b29"/>
  <path d="M385 137Q382 147 380 155Q384 159 389 155M374 171Q381 165 385 168Q389 165 396 171Q386 178 374 171" fill="none" stroke="#77463e" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M340 135Q334 104 349 87Q369 65 398 75Q435 78 431 125Q419 107 405 96Q375 111 348 119Z" fill="url(#hair)"/>
  </g></svg>`;
}
