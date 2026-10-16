'use strict';

const PRODUCTS = {
  renova: {name:'ankor RENOVA',price:41810,format:'60 капсул',image:'./assets/renova-editorial.jpg',alt:'Флаконы и капсулы Ankor RENOVA',tag:'Липофильный концентрат облепихи',description:'Основа RENOVA — ТОМ К-90®, липофильный концентрат облепихи. Он объединяет природные жирные кислоты, каротиноиды и полифенолы. Продукт разработан и производится в Казахстане.',composition:'Масло какао, твёрдое облепиховое масло (ТОМ К-90®). Оболочка капсулы: очищенная вода, крахмал тапиоки, глицерин.',url:'https://ankor.life/products/масло-облепихи-ankor-renova'},
  detox: {name:'ankor DETOX',price:21470,format:'20 саше по 10 г',image:'./assets/detox-editorial.jpg',alt:'Упаковка и саше Ankor DETOX',tag:'Два растительных компонента',description:'Композиция обезжиренных плодов сибирской облепихи и крупноплодного шиповника из гор Кыргызстана. Порционный формат для приготовления напитка.',composition:'Обезжиренные плоды облепихи, плоды шиповника.',url:'https://ankor.life/products/энтеросорбент-ankor-detox'},
  renovaPlus: {name:'ankor RENOVA+',price:41810,format:'60 капсул',image:'./assets/renova-plus.webp',alt:'Флакон Ankor RENOVA+ с оранжевой этикеткой и капсулы',portrait:true,tag:'Новый продукт · Облепиха',description:'Новый продукт линейки RENOVA на основе липофильного концентрата облепихи ТОМ К-90®. В стеклянном флаконе — 60 капсул.',compositionTitle:'Компоненты на этикетке',composition:'Омега-7, янтарная кислота, β-каротин, витамины E и K. Полный состав и сведения об оболочке капсулы указаны на упаковке.'},
  nigella: {name:'ankor NIGELLA S.',price:54200,format:'90 капсул',image:'./assets/nigella-s.webp',alt:'Флакон Ankor NIGELLA S. с чёрно-белой этикеткой и капсулы',portrait:true,tag:'Новый продукт · Чёрный тмин',description:'Липофильный концентрат чёрного тмина в капсулах. Новый растительный комплекс Ankor в стеклянном флаконе на 90 капсул.',compositionTitle:'Компоненты на этикетке',composition:'Жирные кислоты омега-3, 6 и 9, тимохинон и катехин. Полный состав и сведения об оболочке капсулы указаны на упаковке.'}
};
const money = value => new Intl.NumberFormat('ru-KZ').format(value) + ' ₸';
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const whatsapp = message => 'https://wa.me/77715371627?text='+encodeURIComponent(message);
function buildCheckout(items) {
  const entries=Object.entries(items).filter(([key,qty])=>Object.hasOwn(PRODUCTS,key)&&Number.isInteger(qty)&&qty>0);
  const total=entries.reduce((sum,[key,qty])=>sum+PRODUCTS[key].price*qty,0);
  const lines=entries.map(([key,qty])=>`${PRODUCTS[key].name} (${PRODUCTS[key].format}) — ${qty} шт. × ${money(PRODUCTS[key].price)} = ${money(PRODUCTS[key].price*qty)}`);
  return {total,url:whatsapp(['Здравствуйте! Хочу оформить заказ Ankor:',...lines,`Итого: ${money(total)}. Доставка отдельно.`,`Подтвердите, пожалуйста, наличие и условия доставки.`].join('\n'))};
}
const cartKey = 'ankor-redesign-cart-v1';
let cart = {};
try {const saved = JSON.parse(localStorage.getItem(cartKey) || '{}');for(const key of Object.keys(PRODUCTS)){if(Number.isInteger(saved?.[key]) && saved[key]>0) cart[key]=Math.min(saved[key],99);}} catch {cart={};}
let toastTimer;
const dialogs = [...document.querySelectorAll('dialog')];
const productDialog = document.getElementById('product-dialog');
const cartDialog = document.getElementById('cart-dialog');
const compareDialog = document.getElementById('compare-dialog');
function showDialog(dialog) {dialogs.forEach(other=>{if(other!==dialog && other.open) other.close();});if(!dialog.open)dialog.showModal();document.body.classList.add('dialog-open');}
dialogs.forEach(dialog=>{
  dialog.addEventListener('close',()=>{if(!dialogs.some(item=>item.open))document.body.classList.remove('dialog-open');});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom)dialog.close();}});
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
});

function showProduct(key) {
  const p=PRODUCTS[key];if(!p)return;
  document.getElementById('product-dialog-content').innerHTML=`<div class="detail-grid"><div class="detail-image${p.portrait?' detail-image--portrait':''}"><img src="${p.image}" alt="${p.alt}"></div><div class="detail-content"><p class="eyebrow">${p.tag}</p><h2 id="detail-title">${p.name}</h2><p class="detail-format">${p.format}</p><p class="detail-description">${p.description}</p><h3>${p.compositionTitle||'Что внутри'}</h3><p class="detail-composition">${p.composition}</p><div class="product-bottom"><div class="price">${money(p.price)}</div><button class="button button-primary" data-add="${key}">В корзину ${icon('plus')}</button></div><a class="text-link" href="${p.url||whatsapp('Здравствуйте! Расскажите, пожалуйста, подробнее о '+p.name+'.')}" target="_blank" rel="noopener">${p.url?'Полная информация о продукте':'Уточнить состав и применение'} ${icon('diagonal')}</a><p class="dialog-footnote">БАД. Не является лекарственным средством. Перед применением ознакомьтесь с инструкцией и проконсультируйтесь со специалистом.</p></div></div>`;
  showDialog(productDialog);
}
function updateCart(){
  let count=0,total=0;
  for(const [key,quantity] of Object.entries(cart)){count+=quantity;total+=PRODUCTS[key].price*quantity;}
  document.querySelectorAll('.cart-count').forEach(el=>el.textContent=count);
  document.querySelector('.bag-button').setAttribute('aria-label',`Открыть корзину: ${count} товаров`);
  document.getElementById('cart-heading-count').textContent=count;
  const holder=document.getElementById('cart-items');
  if(!count){holder.innerHTML=`<div class="empty-cart">${icon('bag')}<h3>Место для заботы о себе</h3><p>Познакомьтесь с продуктами Ankor и добавьте подходящий в корзину.</p><button class="button button-primary" id="continue-shopping">Выбрать продукт ${icon('arrow')}</button></div>`;}
  else{holder.innerHTML=Object.entries(cart).map(([key,quantity])=>{const p=PRODUCTS[key];return `<article class="cart-item"><img src="${p.image}" alt="${p.name}"><div><h3>${p.name}</h3><p class="cart-item-format">${p.format}</p><span class="cart-item-price">${money(p.price*quantity)}</span><div class="cart-item-actions"><div class="quantity"><button data-quantity="${key}" data-change="-1" aria-label="Уменьшить количество ${p.name}">${icon('minus')}</button><span aria-label="Количество">${quantity}</span><button data-quantity="${key}" data-change="1" ${quantity>=99?'disabled':''} aria-label="Увеличить количество ${p.name}">${icon('plus')}</button></div><button class="remove-item" data-remove="${key}" aria-label="Удалить ${p.name} из корзины">Удалить</button></div></div></article>`;}).join('');}
  document.getElementById('cart-summary').hidden=!count;
  document.getElementById('cart-total').textContent=money(total);
  const order=buildCheckout(cart);
  const checkout=document.getElementById('checkout');
  checkout.href=order.url;

  try{localStorage.setItem(cartKey,JSON.stringify(cart));}catch{/* Browsing with storage disabled still supports this session's cart. */}
}
function addProduct(key){
  if(!PRODUCTS[key])return;
  const before=cart[key]||0;
  if(before>=99){showDialog(cartDialog);return;}
  cart[key]=before+1;updateCart();
  if(productDialog.open){productDialog.close();showDialog(cartDialog);return;}
  document.getElementById('toast-message').textContent=PRODUCTS[key].name+' в корзине';
  const toast=document.getElementById('toast');toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),4500);
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-product'))showProduct(button.dataset.product);
  if(button.hasAttribute('data-add'))addProduct(button.dataset.add);
  if(button.hasAttribute('data-cart-open')){document.getElementById('toast').classList.remove('visible');showDialog(cartDialog);}
  if(button.hasAttribute('data-compare') || button.id==='compare-open')showDialog(compareDialog);
  if(button.hasAttribute('data-quantity')){const key=button.dataset.quantity;if(!PRODUCTS[key])return;cart[key]=Math.min(99,(cart[key]||0)+Number(button.dataset.change));if(cart[key]<=0)delete cart[key];updateCart();const replacement=cartDialog.querySelector(`[data-quantity="${key}"][data-change="${button.dataset.change}"]`);(replacement||cartDialog.querySelector('[data-close]')).focus();}
  if(button.hasAttribute('data-remove')){delete cart[button.dataset.remove];updateCart();cartDialog.querySelector('[data-close]').focus();}
  if(button.id==='continue-shopping'){cartDialog.close();document.getElementById('products').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
});
const menuButton=document.querySelector('.menu-button');
const mobileNav=document.getElementById('mobile-nav');
function closeMenu(){menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Открыть меню');mobileNav.hidden=true;}
menuButton.addEventListener('click',()=>{const expanded=menuButton.getAttribute('aria-expanded')==='true';menuButton.setAttribute('aria-expanded',String(!expanded));menuButton.setAttribute('aria-label',expanded?'Открыть меню':'Закрыть меню');mobileNav.hidden=expanded;});
mobileNav.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
document.addEventListener('click',event=>{if(!event.target.closest('.header')&&!mobileNav.hidden)closeMenu();});
document.querySelectorAll('.faq-list details').forEach(detail=>detail.addEventListener('toggle',()=>{if(detail.open)document.querySelectorAll('.faq-list details').forEach(other=>{if(other!==detail)other.open=false;});}));
window.addEventListener('storage',event=>{if(event.key!==cartKey)return;try{const next=JSON.parse(event.newValue||'{}');cart={};for(const key of Object.keys(PRODUCTS)){if(Number.isInteger(next?.[key])&&next[key]>0)cart[key]=Math.min(next[key],99);}updateCart();}catch{/* Ignore invalid data from another tab. */}});
document.getElementById('year').textContent=new Date().getFullYear();
updateCart();

// One-time entrances enhance the story; content stays visible without animation support.
function initializeMotion() {
  if (!('IntersectionObserver' in window) || !Element.prototype.animate) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim();
  const active = new Map();
  let keyboardInput = false;
  const targets = document.querySelectorAll('.hero-content > .origin-label, .hero-content > h1, .hero-description, .hero-visual, .section-heading, .product-image, .nature-visual, .nature-content, .science-top, .timeline article, .lab-gallery figure, .questions-intro, .contact-banner');
  const stopMotion = () => { active.forEach(animation => animation.cancel()); active.clear(); };
  document.addEventListener('keydown', event => {
    if (['Tab', 'Enter', ' ', 'Escape', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) {
      keyboardInput = true;
      stopMotion();
    }
  });
  document.addEventListener('pointerdown', () => { keyboardInput = false; }, {passive:true});
  reduced.addEventListener('change', stopMotion);
  const observer = new IntersectionObserver(entries => {
    let sequence = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const target = entry.target;
      observer.unobserve(target);
      target.dataset.motion = 'shown';
      if (keyboardInput || target.contains(document.activeElement)) continue;
      const frames = reduced.matches
        ? [{opacity:0}, {opacity:1}]
        : [{opacity:0,transform:'translateY(16px)'}, {opacity:1,transform:'translateY(0)'}];
      const animation = target.animate(frames, {
        duration:reduced.matches ? 200 : 600,
        delay:reduced.matches ? 0 : Math.min(sequence++, 3) * 50,
        easing, fill:'backwards'
      });
      active.set(target, animation);
      animation.finished.then(() => active.delete(target), () => active.delete(target));
    }
  }, {threshold:0.08,rootMargin:'0px 0px -24px 0px'});
  targets.forEach(target => { target.dataset.motion = 'pending'; observer.observe(target); });
}
initializeMotion();
