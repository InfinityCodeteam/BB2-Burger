const api = {
  async load(path) {
    try {
      const r = await fetch(path, { cache: 'no-store' });
      if (!r.ok) throw new Error(`فشل تحميل ${path}: ${r.status}`);
      return await r.json();
    } catch (e) {
      console.error(`خطأ في تحميل ${path}:`, e);
      throw e;
    }
  }
};

const CART_KEY = 'bb2-cart';
const FAV_KEY = 'bb2-favorites';
const store = {
  cart: JSON.parse(localStorage.getItem(CART_KEY) || '[]'),
  favorites: JSON.parse(localStorage.getItem(FAV_KEY) || '[]'),
  saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(this.cart)); },
  saveFavorites() { localStorage.setItem(FAV_KEY, JSON.stringify(this.favorites)); },
  addToCart(item) {
    this.cart.push(item);
    this.saveCart();
  },
  removeFromCart(i) {
    this.cart.splice(i, 1);
    this.saveCart();
  },
  updateQty(i, qty) {
    this.cart[i].qty = qty;
    this.saveCart();
  },
  clearCart() {
    this.cart = [];
    this.saveCart();
  },
  toggleFavorite(id) {
    const index = this.favorites.indexOf(id);
    if (index > -1) {
      this.favorites.splice(index, 1);
    } else {
      this.favorites.push(id);
    }
    this.saveFavorites();
  },
  isFavorite(id) {
    return this.favorites.includes(id);
  }
};

function lineTotal(it) {
  const addonsTotal = (it.addons || []).reduce((s, a) => s + a.price, 0);
  const base = it.unitPrice;
  const combo = it.combo ? it.combo.extra : 0;
  return (base + addonsTotal + combo) * it.qty;
}

function cartTotal(cart) {
  return cart.reduce((s, it) => s + lineTotal(it), 0);
}

const egp = n => `${n.toLocaleString('ar-EG')} ج`;
const encode = str => encodeURIComponent(str);

function showToast(msg) {
  const toast = document.querySelector('#toast');
  if (toast) {
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 2000);
  }
}

function updateStickyCart() {
  const count = store.cart.length;
  const bottomBadge = document.querySelector('#bottom-badge');
  if(bottomBadge) {
    bottomBadge.textContent = count;
    bottomBadge.style.display = count > 0 ? 'flex' : 'none';
  }

  const stickyCart = document.querySelector('#sticky-cart');
  if (stickyCart) {
    const total = cartTotal(store.cart);
    const cartCountEl = document.querySelector('#cart-count');
    const cartTotalEl = document.querySelector('#cart-total');
    if(cartCountEl) cartCountEl.textContent = `${count} عناصر`;
    if(cartTotalEl) cartTotalEl.textContent = egp(total);
    stickyCart.style.display = count > 0 ? 'flex' : 'none';
  }
}

function createProductCard(item, category = '') {
  const card = document.createElement('div');
  card.classList.add('card', 'product-card');
  card.dataset.id = item.id;

  const isNoSize = ['e', 'f', 'g'].includes(item.category);
  
  let priceHTML = '';
  if (isNoSize) {
    priceHTML = `<div class="price">${egp(item.price.single)}</div>`;
  } else {
    const doublePriceDisplay = item.price.double ? ` — دابل ${egp(item.price.double)}` : '';
    priceHTML = `<div class="price">سينجل ${egp(item.price.single)}${doublePriceDisplay}</div>`;
  }

  card.innerHTML = `
    <img src="${item.image || 'https://via.placeholder.com/150'}" alt="${item.name}" loading="lazy">
    <h3>${item.name}</h3>
    <p class="card-desc">${item.desc}</p>
    ${priceHTML}
    <button class="add-cart-btn" data-id="${item.id}" data-category="${item.category}">أضف للسلة</button>
    <button class="fav-btn ${store.isFavorite(item.id) ? 'favorited' : ''}" data-id="${item.id}">
      <i class="fas fa-heart"></i>
    </button>
  `;

  card.addEventListener('click', e => {
    if (!e.target.closest('.fav-btn') && !e.target.closest('.add-cart-btn')) {
      if(item.category !== 'g') {
        window.location.href = `product.html?id=${item.id}`;
      }
    }
  });
  return card;
}

async function loadFooterData() {
  try {
    const settings = await api.load('settings.json');
    const addressEl = document.querySelector('#footer-address');
    const hoursEl = document.querySelector('#footer-hours');
    if (addressEl) addressEl.textContent = settings.address || '';
    if (hoursEl) hoursEl.textContent = settings.hours || '';
  } catch (e) { console.error('خطأ:', e); }
}

async function loadLogo() {
  try {
    const settings = await api.load('settings.json');
    const logoImgs = document.querySelectorAll('#logo-img');
    logoImgs.forEach(img => img.src = settings.logo || 'logo.png');
  } catch (e) { console.error('خطأ:', e); }
}

document.addEventListener('click', e => {
  const favBtn = e.target.closest('.fav-btn');
  const removeFavBtn = e.target.closest('.remove-fav-btn');
  const addCartBtn = e.target.closest('.add-cart-btn');

  if (favBtn) {
    const id = parseInt(favBtn.dataset.id);
    store.toggleFavorite(id);
    favBtn.classList.toggle('favorited');
    showToast(store.isFavorite(id) ? 'تمت الإضافة للمفضلة ❤️' : 'تمت الإزالة 🤍');
    if (document.querySelector('#favorites-grid')) loadFavorites();
  }

  if (addCartBtn) {
    const id = parseInt(addCartBtn.dataset.id);
    const cat = addCartBtn.dataset.category;

    if (cat === 'g') {
      e.preventDefault();
      const originalHTML = addCartBtn.innerHTML;
      addCartBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 
      
      api.load('items.json').then(items => {
        const item = items.find(i => i.id === id);
        if (item) {
          store.addToCart({
            id: item.id,
            name: item.name,
            size: '',
            unitPrice: item.price.single,
            qty: 1,
            addons: [],
            combo: null,
            category: item.category,
            image: item.image
          });
          showToast('تمت الإضافة للسلة 🛒');
          updateStickyCart();
        }
        addCartBtn.innerHTML = originalHTML;
      }).catch(() => { addCartBtn.innerHTML = originalHTML; });
    } else {
      window.location.href = `product.html?id=${id}`;
    }
  }

  if (removeFavBtn) {
    const id = parseInt(removeFavBtn.dataset.id);
    store.toggleFavorite(id);
    showToast('تمت الإزالة 🗑️');
    loadFavorites();
  }

  if (e.target.classList.contains('filter-btn')) {
    const category = e.target.dataset.category;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    loadMenu(category);
  }
});

async function loadFavorites() {
  try {
    const items = await api.load('items.json');
    const grid = document.querySelector('#favorites-grid');
    const noFavorites = document.querySelector('#no-favorites');
    if (grid) {
      grid.innerHTML = '';
      const favoriteItems = items.filter(item => store.isFavorite(item.id));
      if (favoriteItems.length === 0) {
        noFavorites.style.display = 'flex';
        grid.style.display = 'none';
      } else {
        noFavorites.style.display = 'none';
        grid.style.display = 'grid';
        favoriteItems.forEach(item => {
          const card = createProductCard(item);
          card.querySelector('.add-cart-btn').outerHTML = `<button class="remove-fav-btn" data-id="${item.id}">إزالة</button>`;
          grid.appendChild(card);
        });
      }
    }
  } catch (e) { console.error(e); }
}

let scrollInterval; 

async function loadMenu(category = 'all') {
  try {
    const items = await api.load('items.json');
    const categories = await api.load('categories.json');
    const grid = document.querySelector('#menu-grid');
    const filters = document.querySelector('#filters');
    
    if (grid && filters) {
      grid.innerHTML = '';
      
      if (!filters.dataset.loaded) {
        filters.dataset.loaded = "true";
        filters.innerHTML = `<button class="btn filter-btn ${category === 'all' ? 'active' : ''}" data-category="all">الكل</button>`;
        categories.forEach(cat => {
          filters.innerHTML += `<button class="btn filter-btn ${category === cat.id ? 'active' : ''}" data-category="${cat.id}">${cat.title}</button>`;
        });

        // 🌟 حركة السكرول التلقائي (أسرع وأكثر مرونة)
        setTimeout(() => {
          let step = -2; // السرعة أصبحت الضعف (كانت -1)
          scrollInterval = setInterval(() => {
            const maxScroll = filters.scrollWidth - filters.clientWidth;
            if (maxScroll <= 0) return;
            
            filters.scrollBy({ left: step, behavior: 'auto' });
            
            if (Math.abs(filters.scrollLeft) >= maxScroll - 2) {
              step = 2; 
            } else if (Math.abs(filters.scrollLeft) <= 2) {
              step = -2; 
            }
          }, 20); // Interval أقل يعني نعومة وسرعة أعلى
        }, 800);

        const stopScroll = () => clearInterval(scrollInterval);
        filters.addEventListener('touchstart', stopScroll);
        filters.addEventListener('mousedown', stopScroll);
        filters.addEventListener('wheel', stopScroll);
      }

      const filteredItems = category === 'all' ? items : items.filter(item => item.category === category);
      filteredItems.forEach(item => grid.appendChild(createProductCard(item, category)));
    }
  } catch (e) { console.error(e); }
}

async function loadFeatured() {
  try {
    const items = await api.load('items.json');
    const grid = document.querySelector('#featured-grid');
    if (grid) {
      grid.innerHTML = '';
      const featuredItems = items.filter(item => item.featured).slice(0, 6);
      featuredItems.forEach(item => {
        grid.appendChild(createProductCard(item));
      });
    }
  } catch (e) { console.error(e); }
}

async function loadBanner() {
  try {
    const settings = await api.load('settings.json');
    const slider = document.querySelector('.banner-slider');
    if (slider && settings.banners && settings.banners.length > 0) {
      let current = 0;
      const images = settings.banners;
      slider.innerHTML = images.map((src, i) => `<img src="${src}" class="${i === 0 ? 'active' : ''}">`).join('');
      const cycleImages = () => {
        const imgs = slider.querySelectorAll('img');
        if(imgs.length > 0) {
          imgs[current].classList.remove('active');
          current = (current + 1) % images.length;
          imgs[current].classList.add('active');
        }
      };
      setInterval(cycleImages, 5000);
    }
  } catch (e) { console.error(e); }
}

if (document.querySelector('#menu-grid')) {
  (async () => {
    updateStickyCart();
    window.addEventListener('storage', updateStickyCart);
    await loadLogo();
    await loadFooterData();
    await loadMenu();
  })();
} else if (document.querySelector('#featured-grid')) {
  (async () => {
    updateStickyCart();
    window.addEventListener('storage', updateStickyCart);
    await loadLogo();
    await loadFooterData();
    await loadFeatured();
    await loadBanner();
  })();
} else if (document.querySelector('#product-details')) {
  (async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const id = parseInt(params.get('id'));
      
      if (!id) {
        document.querySelector('#product-details').innerHTML = '<p style="text-align:center; padding-top: 100px;">المنتج غير موجود</p>';
        return;
      }

      const items = await api.load('items.json');
      const addons = await api.load('addons.json');
      const item = items.find(i => i.id === id);
      
      const isNoSize = item && ['e', 'f', 'g'].includes(item.category);
      const combos = [{ id: 'combo', name: 'كومبو', extra: 50 }]; 
      
      const details = document.querySelector('#product-details');
      const sizeGroup = document.querySelector('#size-group');
      const singleBtn = document.querySelector('.size-btn[data-size="single"]');
      const doubleBtn = document.querySelector('.size-btn[data-size="double"]');
      const sizeBtns = document.querySelectorAll('.size-btn');
      
      const comboCheck = document.querySelector('#combo');
      const qtyDisplay = document.querySelector('#qty-display');
      const qtyInput = document.querySelector('#qty');
      const qtyPlus = document.querySelector('#qty-plus');
      const qtyMinus = document.querySelector('#qty-minus');
      const addonsList = document.querySelector('#addons');
      const totalPrice = document.querySelector('#total-price');
      const addBtn = document.querySelector('#add-btn');
      const favBtn = document.querySelector('#fav-btn');

      if (!item) {
        details.innerHTML = '<p style="text-align:center; padding-top: 100px;">المنتج غير موجود</p>';
        return;
      }

      details.innerHTML = `
        <img src="${item.image || 'https://via.placeholder.com/400'}" alt="${item.name}">
        <h2>${item.name}</h2>
        <p>${item.desc}</p>
      `;
      
      favBtn.classList.toggle('favorited', store.isFavorite(id));
      
      addonsList.innerHTML = addons.map(a => `
        <label>
          <input type="checkbox" data-id="${a.id}" data-price="${a.price}"> 
          <span>${a.name} <strong style="color:var(--brand);">+${a.price} ج</strong></span>
        </label>
      `).join('');

      if (isNoSize) {
        if (sizeGroup) sizeGroup.style.display = 'none';
        item.price.singleOnly = true;
      } else {
        if (singleBtn) {
          singleBtn.innerHTML = `سينجل <small>${egp(item.price.single)}</small>`;
        }
        if (doubleBtn) {
          if (item.price.double) {
            doubleBtn.innerHTML = `دابل <small>${egp(item.price.double)}</small>`;
          } else {
            doubleBtn.innerHTML = `دابل <small>غير متوفر</small>`;
            doubleBtn.disabled = true;
          }
        }
      }

      let currentSize = 'single';

      sizeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          if(btn.disabled) return;
          sizeBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentSize = btn.dataset.size;
          updatePrice();
        });
      });

      function updateQty(value) {
        let qty = parseInt(value);
        if (qty < 1) qty = 1;
        if (qty > 99) qty = 99;
        qtyInput.value = qty;
        qtyDisplay.textContent = qty;
        updatePrice();
      }

      if (qtyPlus) qtyPlus.addEventListener('click', () => updateQty(parseInt(qtyInput.value) + 1));
      if (qtyMinus) qtyMinus.addEventListener('click', () => updateQty(parseInt(qtyInput.value) - 1));

      function updatePrice() {
        const size = isNoSize ? 'single' : currentSize;
        const basePrice = item.price[size] || item.price.single;
        const comboExtra = comboCheck && comboCheck.checked ? combos[0].extra : 0;
        const addonsTotal = Array.from(addonsList.querySelectorAll('input:checked')).reduce((s, inp) => s + parseInt(inp.dataset.price), 0);
        const total = (basePrice + comboExtra + addonsTotal) * parseInt(qtyInput.value || 1);
        totalPrice.textContent = `${egp(total)}`;
      }

      if (comboCheck) comboCheck.addEventListener('change', updatePrice);
      addonsList.addEventListener('change', updatePrice);
      updatePrice();

      addBtn.addEventListener('click', () => {
        const sizeLabelText = isNoSize ? '' : (currentSize === 'single' ? 'سينجل' : 'دابل');
        const selectedAddons = Array.from(addonsList.querySelectorAll('input:checked')).map(inp => ({
          id: inp.dataset.id,
          name: addons.find(a => a.id === inp.dataset.id).name,
          price: parseInt(inp.dataset.price)
        }));
        const combo = (comboCheck && comboCheck.checked) ? combos[0] : null;
        
        const newItem = {
          id: item.id,
          name: item.name,
          size: sizeLabelText,
          unitPrice: item.price[currentSize] || item.price.single,
          qty: parseInt(qtyInput.value || 1),
          addons: selectedAddons,
          combo,
          category: item.category,
          image: item.image
        };
        store.addToCart(newItem);
        showToast('تمت الإضافة إلى السلة ✓');
        updateStickyCart();
      });

      favBtn.addEventListener('click', () => {
        store.toggleFavorite(id);
        favBtn.classList.toggle('favorited');
        showToast(store.isFavorite(id) ? 'تمت الإضافة للمفضلة ❤️' : 'تمت الإزالة 🤍');
      });

      await loadLogo();
      await loadFooterData();
      updateStickyCart();
    } catch (e) {
      console.error(e);
      document.querySelector('#product-details').innerHTML = '<p style="text-align:center; padding-top: 100px;">خطأ في تحميل المنتج</p>';
    }
  })();
} else if (document.querySelector('#cart-list')) {
  (async () => {
    try {
      const settings = await api.load('settings.json');
      let phone = settings.whatsapp || '201000000000';
      phone = phone.replace(/[^0-9]/g, '');
      if(!phone.startsWith('2') && phone.length >= 10) phone = '2' + phone;

      const name = document.querySelector('#name');
      const mobile = document.querySelector('#mobile');
      const address = document.querySelector('#address');
      const notes = document.querySelector('#notes');
      const payment = document.querySelector('#payment');
      const cartList = document.querySelector('#cart-list');
      const grandTotalEl = document.querySelector('#grand-total');

      function updateCart() {
        cartList.innerHTML = '';
        if(store.cart.length === 0) {
          cartList.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-muted);">السلة فارغة حالياً</p>';
          grandTotalEl.textContent = '0 ج';
          updateStickyCart();
          return;
        }

        store.cart.forEach((it, i) => {
          const div = document.createElement('div');
          div.classList.add('card');
          const sizeDisplay = it.size ? ` (${it.size})` : '';
          const addonsText = (it.addons && it.addons.length > 0) ? it.addons.map(a => a.name).join('، ') : 'بدون';
          
          div.innerHTML = `
            <img src="${it.image || 'https://via.placeholder.com/90'}" alt="${it.name}">
            <div>
              <h3>${it.name}${sizeDisplay}</h3>
              <p>إضافات: ${addonsText}</p>
              <p>كومبو: ${it.combo ? 'نعم' : 'لا'}</p>
              <div class="cart-qty-control">
                <button class="c-qty-btn minus" data-i="${i}">-</button>
                <span class="c-qty-display">${it.qty}</span>
                <button class="c-qty-btn plus" data-i="${i}">+</button>
              </div>
              <p class="price" style="margin-top: 5px;">${egp(lineTotal(it))}</p>
            </div>
            <button class="remove-btn" data-i="${i}"><i class="fas fa-trash-alt" style="pointer-events: none;"></i></button>
          `;
          cartList.appendChild(div);
        });

        const grand = cartTotal(store.cart);
        grandTotalEl.textContent = egp(grand);
        updateStickyCart();
      }

      cartList.addEventListener('click', e => {
        const removeBtn = e.target.closest('.remove-btn');
        const plusBtn = e.target.closest('.plus');
        const minusBtn = e.target.closest('.minus');

        if (removeBtn) { store.removeFromCart(removeBtn.dataset.i); updateCart(); }
        else if (plusBtn) { const i = plusBtn.dataset.i; store.updateQty(i, store.cart[i].qty + 1); updateCart(); }
        else if (minusBtn) { const i = minusBtn.dataset.i; if (store.cart[i].qty > 1) { store.updateQty(i, store.cart[i].qty - 1); updateCart(); } }
      });

      document.querySelector('#whatsapp-order').addEventListener('click', () => {
  if(store.cart.length === 0) { showToast('السلة فارغة!'); return; }
  if(!name.value.trim() || !mobile.value.trim() || !address.value.trim()) { showToast('برجاء إكمال البيانات الأساسية.'); return; }
  
  const lines = [];
  lines.push(`*طلب جديد | ${settings.brand || 'BB2 Burger - قليوب'}*`);
  lines.push(`======================`);
  
  store.cart.forEach((it, idx) => {
    const sizeDisplay = it.size ? ` (${it.size})` : '';
    
    // اسم المنتج بخط عريض
    lines.push(`*[${idx + 1}] ${it.name}${sizeDisplay}*`);
    lines.push(`- الكمية: ${it.qty}`);
    
    if(it.addons && it.addons.length > 0) {
      const addons = it.addons.map(a => a.name).join('، ');
      lines.push(`- الإضافات: ${addons}`);
    }
    
    if(it.combo) {
      lines.push(`- كومبو: نعم (+${it.combo.extra}ج)`);
    }
    
    lines.push(`- السعر: ${egp(lineTotal(it))}`);
    lines.push(`----------------------`);
  });
  
  lines.push(`*الإجمالي المطلوب بدون توصيل :  ${egp(cartTotal(store.cart))}*`);
  lines.push(`======================`);
  lines.push(`*بيانات العميل:*`);
  lines.push(`- الاسم: ${name.value.trim()}`);
  lines.push(`- الموبايل: ${mobile.value.trim()}`);
  lines.push(`- العنوان: ${address.value.trim()}`);
  lines.push(`- الدفع: ${payment.value}`);
  
  if (notes.value.trim()) {
    lines.push(`- ملاحظات: ${notes.value.trim()}`);
  }
  
  const msg = encodeURIComponent(lines.join('\n'));
  window.location.href = `https://wa.me/${phone}?text=${msg}`;
  store.clearCart();
});

      updateCart();
      await loadLogo();
      await loadFooterData();
    } catch (e) { console.error('خطأ:', e); }
  })();
} else if (document.querySelector('#favorites-grid')) {
  (async () => {
    updateStickyCart();
    window.addEventListener('storage', updateStickyCart);
    await loadLogo();
    await loadFooterData();
    await loadFavorites();
  })();
}