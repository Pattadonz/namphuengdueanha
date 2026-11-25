/* ==========================================================
   น้ำผึ้งเดือนห้า — shared script (product / order / admin)
   Each page is detected by the element ids it contains.
   ========================================================== */

(function () {
  'use strict';

  var ORDER_URL = 'https://script.google.com/macros/s/AKfycbxLzlOMvJkHhiwWqluKxrvXo9yEUQPO9HGmSpcoY8zsNeja-jUMoGIIxH5U1ufy_-iM7g/exec';
  var ADMIN_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT4llH8cwdUSBmxZ_4H78n1OxKfqy2FrXK9WN1DlZupx1dVEmFXOfnGmkmrmyQby7Pv-hcyDcCXDEje/pub?gid=0&single=true&output=csv';

  var SIZES = ['big', 'mid', 'tube', 'jam'];

  function byId(id) {
    return document.getElementById(id);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function init() {
    if (byId('product-list')) initProducts();
    if (byId('orderForm')) initOrder();
    if (byId('ordersTable')) initAdmin();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ========================================================
     1) product.html
     ======================================================== */

  function initProducts() {
    var list = byId('product-list');
    var bar = byId('filter-bar');

    fetch('products.json')
      .then(function (res) {
        if (!res.ok) throw new Error('โหลด products.json ไม่สำเร็จ (' + res.status + ')');
        return res.json();
      })
      .then(function (products) {
        var labels = {};
        products.forEach(function (p) {
          labels[p.size] = p.sizeLabel || p.size;
        });

        // ?mood=big|mid|tube|jam filters automatically on load
        var mood = (new URLSearchParams(window.location.search).get('mood') || '')
          .trim()
          .toLowerCase();
        var current = SIZES.indexOf(mood) !== -1 ? mood : 'all';

        function render() {
          list.textContent = '';
          var shown = products.filter(function (p) {
            return current === 'all' || p.size === current;
          });
          if (!shown.length) {
            list.appendChild(el('p', '', 'ไม่พบสินค้าในหมวดนี้'));
            return;
          }
          shown.forEach(function (p) {
            list.appendChild(createCard(p));
          });
        }

        function markActive() {
          if (!bar) return;
          Array.prototype.forEach.call(bar.querySelectorAll('button'), function (btn) {
            var active = btn.dataset.filter === current;
            btn.classList.toggle('btn--solid', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
        }

        if (bar) {
          bar.textContent = '';
          bar.setAttribute('role', 'group');
          bar.setAttribute('aria-label', 'กรองสินค้าตามขนาด');

          var options = [{ key: 'all', label: 'ทั้งหมด' }].concat(
            SIZES.map(function (s) {
              return { key: s, label: labels[s] || s };
            })
          );
          options.forEach(function (opt) {
            var btn = el('button', 'btn', opt.label);
            btn.type = 'button';
            btn.dataset.filter = opt.key;
            btn.addEventListener('click', function () {
              current = opt.key;
              markActive();
              render();
            });
            bar.appendChild(btn);
          });
          markActive();
        }

        render();
      })
      .catch(function (error) {
        console.error(error);
        list.textContent = '';
        list.appendChild(el('p', '', 'ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง'));
      });
  }

  function createCard(p) {
    var card = el('article', 'product-card');
    card.dataset.size = p.size;

    var imageWrap = el('div', 'product-image');
    var img = document.createElement('img');
    img.src = p.image;
    img.alt = p.name;
    img.loading = 'lazy';
    imageWrap.appendChild(img);

    var name = el('h3', 'product-name', p.name);

    var volume = el('p', 'product-volume');
    volume.appendChild(el('span', 'size-dot'));
    volume.appendChild(document.createTextNode(' ' + p.sizeLabel + ' ' + p.volume));

    var price = el('p', 'product-price', Number(p.price).toLocaleString('en-US') + ' ');
    price.appendChild(el('small', '', 'บาท'));

    // e.g. order.html?item=น้ำผึ้งขวดใหญ่ 750ml&price=450 (properly encoded)
    var query = new URLSearchParams({
      item: p.name + ' ' + String(p.volume).replace(/\s+/g, ''),
      price: p.price
    });
    var buy = el('a', 'btn btn--block', 'สั่งซื้อ');
    buy.href = 'order.html?' + query.toString();

    card.appendChild(imageWrap);
    card.appendChild(name);
    card.appendChild(volume);
    card.appendChild(price);
    card.appendChild(buy);
    return card;
  }

  /* ========================================================
     2) order.html
     ======================================================== */

  function initOrder() {
    var form = byId('orderForm');
    var params = new URLSearchParams(window.location.search);

    // fill BOTH #items and #total straight away
    var item = params.get('item');
    var price = params.get('price');
    if (item !== null && byId('items')) byId('items').value = item;
    if (price !== null && byId('total')) byId('total').value = price;

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var payload = {
        customerName: byId('customerName').value.trim(),
        contact: byId('contact').value.trim(),
        items: byId('items').value.trim(),
        total: byId('total').value.trim(),
        note: byId('note') ? byId('note').value.trim() : ''
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(ORDER_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
        .then(() => { window.location.href = 'thankyou.html'; })
        .catch(error => {
          console.error(error);
          if (submitBtn) submitBtn.disabled = false;
          alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        });
    });
  }

  /* ========================================================
     3) admin.html
     ======================================================== */

  function initAdmin() {
    var tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;

    showMessage(tbody, 'กำลังโหลดข้อมูล...');

    fetch(ADMIN_CSV_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('โหลดข้อมูลคำสั่งซื้อไม่สำเร็จ (' + res.status + ')');
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text).filter(function (row) {
          return row.some(function (cell) { return cell.trim() !== ''; });
        });

        // skip a header row if the sheet has one (a real timestamp always has digits)
        if (rows.length && !/\d/.test(rows[0][0])) rows.shift();

        // the Apps Script appends rows in order, so reverse = newest first
        rows.reverse();

        tbody.textContent = '';
        if (!rows.length) {
          showMessage(tbody, 'ยังไม่มีคำสั่งซื้อ');
          return;
        }
        rows.forEach(function (row) {
          var tr = document.createElement('tr');
          for (var i = 0; i < 6; i++) {
            tr.appendChild(el('td', '', row[i] !== undefined ? row[i] : ''));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        showMessage(tbody, 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      });
  }

  function showMessage(tbody, message) {
    tbody.textContent = '';
    var tr = document.createElement('tr');
    var td = el('td', '', message);
    td.colSpan = 6;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  // Minimal CSV parser: quoted fields, escaped quotes (""), commas and
  // line breaks inside quotes, CRLF / LF line endings, optional BOM.
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }

    // last field / row when the file doesn't end with a newline
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }
})();
