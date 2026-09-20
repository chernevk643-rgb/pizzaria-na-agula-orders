// Mirrors netlify/functions/addons.json for instant client-side rendering.
// The server re-validates every price from its own copy — this file only
// drives the UI, it is never trusted for totals.
const ADDON_GROUPS = {
  combo: [
    { key: 'sinyo-sirene', name: 'Синьо сирене', price: 1.99 },
    { key: 'krave-sirene', name: 'Краве сирене', price: 1.99 },
    { key: 'kiseli-krastavichki', name: 'Кисели краставички', price: 0.99 },
    { key: 'tsarevitsa', name: 'Царевица', price: 0.99 },
    { key: 'gabi', name: 'Гъби', price: 0.99 },
    { key: 'maslini', name: 'Маслини', price: 0.99 },
    { key: 'presna-chushka', name: 'Прясна чушка', price: 0.99 },
    { key: 'luk', name: 'Лук', price: 0.99 },
    { key: 'topeno-sirene', name: 'Топено сирене', price: 1.99 },
    { key: 'peperoni', name: 'Пеперони', price: 1.99 },
    { key: 'pueshko-file', name: 'Пуешко филе', price: 1.99 },
    { key: 'bekon', name: 'Бекон', price: 1.99 },
    { key: 'svinska-shunka', name: 'Свинска шунка', price: 1.99 },
    { key: 'oshte-motsarela', name: 'Още моцарела', price: 1.99 }
  ],
  pizza30: [
    { key: 'oshte-motsarela', name: 'Още моцарела', price: 1.99 },
    { key: 'svinska-shunka', name: 'Свинска шунка', price: 1.99 },
    { key: 'bekon', name: 'Бекон', price: 1.99 },
    { key: 'pueshko-file', name: 'Пуешко филе', price: 1.99 },
    { key: 'peperoni', name: 'Пеперони', price: 1.99 },
    { key: 'topeno-sirene', name: 'Топено сирене', price: 0.99 },
    { key: 'sinyo-sirene', name: 'Синьо сирене', price: 1.99 },
    { key: 'krave-sirene', name: 'Краве сирене', price: 1.99 },
    { key: 'kiseli-krastavichki', name: 'Кисели краставички', price: 0.99 },
    { key: 'tsarevitsa', name: 'Царевица', price: 0.99 },
    { key: 'presna-chushka', name: 'Прясна чушка', price: 0.99 },
    { key: 'gabi', name: 'Гъби', price: 0.99 },
    { key: 'maslini', name: 'Маслини', price: 0.99 },
    { key: 'luk', name: 'Лук', price: 0.99 }
  ],
  pizza60: [
    { key: 'oshte-motsarela', name: 'Още моцарела', price: 2.99 },
    { key: 'pueshko-file', name: 'Пуешко филе', price: 2.99 },
    { key: 'bekon', name: 'Бекон', price: 2.99 },
    { key: 'peperoni', name: 'Пеперони', price: 3.99 },
    { key: 'topeno-sirene', name: 'Топено сирене', price: 2.99 },
    { key: 'halapenyo', name: 'Халапеньо', price: 1.99 },
    { key: 'gabi', name: 'Гъби', price: 1.99 },
    { key: 'tsarevitsa', name: 'Царевица', price: 1.99 },
    { key: 'kiseli-krastavichki', name: 'Кисели краставички', price: 1.99 },
    { key: 'luk', name: 'Лук', price: 1.99 },
    { key: 'maslini', name: 'Маслини', price: 1.99 },
    { key: 'presni-chushki', name: 'Пресни чушки', price: 1.99 },
    { key: 'krave-sirene', name: 'Краве сирене', price: 1.99 },
    { key: 'sinyo-sirene', name: 'Синьо сирене', price: 2.99 }
  ],
  hotdog: [
    { key: 'domashen-chesnov-sos', name: 'Домашен чеснов сос', price: 0 },
    { key: 'ketchup', name: 'Кетчуп', price: 0 },
    { key: 'mayoneza', name: 'Майонеза', price: 0 },
    { key: 'gorchitsa', name: 'Горчица', price: 0 },
    { key: 'chili-sos', name: 'Чили сос', price: 0 }
  ],
  sandwich: [
    { key: 'domati', name: 'Домати', price: 0 },
    { key: 'krastavitsi', name: 'Краставици', price: 0 },
    { key: 'maslini-s', name: 'Маслини', price: 0 },
    { key: 'salata-po-izbor', name: 'Салата по избор', price: 0 },
    { key: 'luk-s', name: 'Лук', price: 0 },
    { key: 'chushki-s', name: 'Чушки', price: 0 }
  ]
};

// The 12 pizzas Bolt Food lets you pick for a combo (ids = our 30см pizzas).
const COMBO_PIZZAS = [
  { key: 'bianka-std', name: 'Бианка' },
  { key: 'kornichoza-std', name: 'Корничоза' },
  { key: 'avtorska-std', name: 'Авторска' },
  { key: 'margarita-1', name: 'Маргарита' },
  { key: 'kaprichoza-2', name: 'Капричоза' },
  { key: 'kremoza-3', name: 'Кремоза' },
  { key: 'peperoni-4', name: 'Пеперони' },
  { key: 'polo-5', name: 'Поло' },
  { key: '4-sirena-7', name: '4 Сирена' },
  { key: 'retro-6', name: 'Ретро' },
  { key: 'spetsialna-8', name: 'Специална' },
  { key: 'kremperoni-std', name: 'Кремперони' }
];
