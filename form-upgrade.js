/* Splits the homepage availability Service address field into street, city, state, ZIP. */
(function () {
  const addr = document.getElementById('addr-copy');
  if (!addr || document.getElementById('avail-city')) return;

  const label = document.querySelector('label[for="addr-copy"]');
  if (label) label.textContent = 'Street address';
  addr.placeholder = '123 Main St';

  const wrap = addr.closest('div');
  if (!wrap || !wrap.parentNode) return;

  function field(id, name, labelText, placeholder, attrs) {
    const div = document.createElement('div');
    const lab = document.createElement('label');
    lab.setAttribute('for', id);
    lab.textContent = labelText;
    const input = document.createElement('input');
    input.id = id;
    input.name = name;
    input.placeholder = placeholder;
    input.required = true;
    Object.keys(attrs || {}).forEach(function (k) { input.setAttribute(k, attrs[k]); });
    div.appendChild(lab);
    div.appendChild(input);
    return div;
  }

  const city = field('avail-city', 'city', 'City', 'Sevierville', { autocomplete: 'address-level2' });
  const state = field('avail-state', 'state', 'State', 'TN', { autocomplete: 'address-level1' });
  state.querySelector('input').value = 'TN';
  const zip = field('avail-zip', 'zip', 'ZIP Code', '37862', { autocomplete: 'postal-code', inputmode: 'numeric' });
  zip.className = 'full';

  wrap.insertAdjacentElement('afterend', zip);
  wrap.insertAdjacentElement('afterend', state);
  wrap.insertAdjacentElement('afterend', city);

  const hero = document.getElementById('hero-addr');
  if (hero) {
    hero.placeholder = '123 Main St, Sevierville, TN 37862';
    hero.setAttribute('aria-label', 'Service address, city, state, and ZIP');
  }
})();
