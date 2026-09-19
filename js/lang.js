/* DEKKAN i18n — Arabic (default) + English, RTL/LTR flip, persisted.
 * Static text:  [data-i18n]  = textContent
 *                [data-i18n-ph]  = placeholder
 *                [data-i18n-title] = title / aria-label
 * Dynamic text (app.js): T.t('key')
 * A change fires 'dekkan:lang' so views re-render their text.
 */
'use strict';
(function () {
  const LS_LANG = 'dekkan.lang';

  const AR = {
    'app.name': 'دكان', 'app.tagline': 'صندوق + مخزون + ديون لمحلك',
    'cashbox.label': 'رصيد الصندوق', 'today': 'اليوم: ',
    'curr': 'د.ت',

    'tab.sell': 'البيع', 'tab.stock': 'المخزون', 'tab.debts': 'الديون',
    'tab.report': 'التقرير', 'tab.settings': 'الإعدادات',

    'sell.title': 'البيع',
    'sell.sub': 'بيع نقدي أو بالدين — كل شيء يُحسب وحدو',
    'sell.refund': 'استرجاع',
    'refund.title': 'استرجاع منتوج',
    'refund.qty': 'الكمية', 'refund.reason': 'السبب',
    'refund.reasonPh': 'اختياري — مثل: سلعة معيبة',
    'refund.go': 'تسجيل الاسترجاع',
    'free.title': 'سلعة / خدمة بدون مخزون',
    'free.namePh': 'الاسم — مثل: قهوة، حلاقة', 'free.pricePh': 'الثمن',
    'free.add': 'إضافة', 'free.qty': 'كمية',
    'basket.title': 'السلة',
    'disc.pct': 'خصم %', 'disc.flat': 'خصم ثابت',
    'credit.label': 'اسم الزبون',
    'credit.ph': 'للبيع بالدين أو الدفع الناقص',
    'sell.paid': 'المبلغ المدفوع',
    'sell.paidPh': 'الفلوس اللي عطاها الزبون',
    'sell.change': 'الباقي للزبون:',
    'sell.exact': 'دفع بالضبط — بلا باقي',
    'sell.rest': 'الباقي على الزبون:',
    'sell.restNeedName': 'اكتب اسم الزبون',
    'sell.onCredit': 'بالدِّين على:',
    'sell.go': 'تسجيل البيع',
    'stock.left': 'متبقية', 'stock.leftEn': 'left',
    'basket.empty': 'السلة فارغة — اضغط على منتوج',
    'sell.none': 'لا منتوجات بعد — أضف واحدًا من تبويب المخزون',

    'stock.title': 'المخزون', 'stock.sub': 'كل منتوج بثمنيه: شراء وبيع',
    'stock.new': 'منتج جديد', 'stock.edit': 'تعديل',
    'stock.name': 'الاسم', 'stock.buy': 'ثمن الشراء', 'stock.sell': 'ثمن البيع',
    'stock.qty': 'الكمية', 'stock.lowAt': 'تنبيه عند (كمية قليلة)',
    'stock.empty': 'لا منتوجات — أضف أول منتوج',
    'common.cancel': 'إلغاء', 'common.save': 'حفظ',

    'debts.title': 'الديون', 'debts.sub': 'الدفتر الرقمي — من عليه وكم',
    'debts.new': 'دين جديد',
    'debts.name': 'اسم الزبون', 'debts.amount': 'المبلغ',
    'debts.phone': 'الهاتف (اختياري)', 'debts.note': 'ملاحظة',
    'debts.pay': 'سداد', 'debts.paid': 'مدفوع', 'debts.settled': 'مُسَدَّس',
    'debts.empty': 'لا ديون — ممتاز',
    'debts.payTitle': 'سداد',

    'report.title': 'تقرير اليوم', 'report.sub': 'القصة الكاملة للفلوس',
    'report.check': 'عدّ الصندوق',
    'report.checkPh': 'عدّ الفلوس في الصندوق الآن',
    'report.checkGo': 'تسجيل العدّ',
    'report.expected': 'الصندوق يجب أن يحتوي: ',
    'report.movements': 'حركة اليوم',
    'report.matched': 'مطابق', 'report.diff': 'فرق: ',
    'report.noChecks': 'لم تعدَّ الصندوق اليوم بعد',
    'report.noMoves': 'لا حركة اليوم بعد',
    'report.chip.start': 'فلوس الصبح', 'report.chip.now': 'في الصندوق الآن',
    'report.chip.sales': 'مبيعات اليوم', 'report.chip.refunds': 'استرجاعات',
    'report.chip.expenses': 'مصاريف', 'report.chip.buys': 'شراء مخزون',
    'report.chip.profit': 'ربح اليوم', 'report.chip.inventory': 'قيمة المخزون',
    'report.chip.debts': 'ديون مفتوحة',
    'report.chip.low': 'بضاعة قليلة',
    'kind.sale': 'بيع', 'kind.debtPay': 'سداد دين', 'kind.refund': 'استرجاع',
    'kind.buy': 'شراء مخزون', 'kind.expense': 'مصروف', 'kind.income': 'إيراد',
    'kind.check': 'عدّ صندوق',

    'settings.title': 'الإعدادات', 'settings.sub': 'المحل، المظهر، اللغة، خيارات اليوم',
    'settings.sect.shop': 'المحل', 'settings.sect.look': 'المظهر',
    'settings.sect.lang': 'اللغة', 'settings.sect.behave': 'السلوك',
    'settings.sect.day': 'إدارة اليوم', 'settings.sect.about': 'عن التطبيق',
    'settings.theme': 'شكل الدكان', 'settings.version': 'النسخة',
    'settings.storage': 'المساحة المستعملة',
    'theme.souk': 'الذهبي', 'theme.mint': 'الزمرد', 'theme.royal': 'البنفسجي',
    'toast.themeOk': 'تم تغيير شكل الدكان',
    'settings.shopName': 'اسم المحل', 'settings.startCash': 'فلوس بداية اليوم',
    'settings.startCashHint': 'بداية اليوم تُغيّر عند فتح صندوق جديد (إغلاق اليوم).',
    'settings.discount': 'الخصم مسموح', 'settings.discountHint': 'تظهر حقول الخصم في البيع',
    'settings.refund': 'الاسترجاع مسموح', 'settings.refundHint': 'تظهر خاصية الاسترجاع',
    'settings.closeDay': 'إغلاق يوم اليوم',
    'settings.export': 'حفظ نسخة (JSON)',
    'settings.reset': 'مسح كل شيء وإعادة البدء',
    'settings.autosave': 'الحفظ تلقائي على كل عملية. النسخة الاحتياطية مزدوجة داخل المتصفح.',
    'settings.language': 'لغة الواجهة',

    'toast.couldntSave': 'تعذّر الحفظ',
    'toast.saleOk': 'سُجّل البيع', 'toast.saleCredit': 'سُجّل على الدين: ',
    'toast.saleRest': 'سُجّل البيع، والباقي على: ',
    'toast.change': 'أعطِ الزبون الباقي:',
    'toast.paidBad': 'المبلغ المدفوع غير صحيح',
    'toast.restName': 'الباقي يحتاج اسم الزبون',
    'toast.freeName': 'اكتب اسم السلعة',
    'toast.refundPick': 'اختر منتوجًا للاسترجاع',
    'toast.refundOk': 'تم الاسترجاع',
    'toast.prodName': 'اكتب اسم المنتوج', 'toast.prodPrice': 'اكتب ثمن البيع',
    'toast.savedOk': 'تم الحفظ',
    'toast.debtName': 'اكتب الاسم والمبلغ', 'toast.debtOk': 'سُجّل الدين',
    'toast.amount': 'اكتب المبلغ', 'toast.payOk': 'تم السداد',
    'toast.checkAmt': 'اكتب العدد الذي عاددته', 'toast.checkOk': 'سُجّل العدّ',
    'toast.dayClosed': 'أُغلق اليوم، وبدأ يوم جديد بنفس الرصيد',
    'toast.debtDeleted': 'حُذف من السجل',
    'toast.resetConfirm': 'مسح كل بيانات المحل؟ هذا لا يُرجع. (يمكنك حفظ نسخة أولًا)',
    'toast.resetOk': 'بدأنا من جديد',
    'toast.restock': 'أُضيف للمخزون'
  };

  const EN = {
    'app.name': 'Dekkan', 'app.tagline': 'cash box + stock + debts for your shop',
    'cashbox.label': 'Cash in box', 'today': 'Today: ',
    'curr': 'TND',

    'tab.sell': 'Sell', 'tab.stock': 'Stock', 'tab.debts': 'Debts',
    'tab.report': 'Report', 'tab.settings': 'Settings',

    'sell.title': 'Sell',
    'sell.sub': 'Cash or credit — everything counts itself',
    'sell.refund': 'Refund',
    'refund.title': 'Refund an item',
    'refund.qty': 'Qty', 'refund.reason': 'Reason',
    'refund.reasonPh': 'optional — e.g. damaged item',
    'refund.go': 'Record refund',
    'free.title': 'Item / service without stock',
    'free.namePh': 'name — e.g. coffee, haircut', 'free.pricePh': 'price',
    'free.add': 'Add', 'free.qty': 'Qty',
    'basket.title': 'Basket',
    'disc.pct': 'Discount %', 'disc.flat': 'Discount TND',
    'credit.label': 'Customer name',
    'credit.ph': 'for credit or part payment',
    'sell.paid': 'Cash handed over',
    'sell.paidPh': 'what the customer gave you',
    'sell.change': 'Change to give back:',
    'sell.exact': 'Exact money — no change',
    'sell.rest': 'Rest on the customer:',
    'sell.restNeedName': 'type the customer name',
    'sell.onCredit': 'On credit to:',
    'sell.go': 'Record sale',
    'stock.left': 'left', 'stock.leftEn': 'left',
    'basket.empty': 'Basket empty — tap a product',
    'sell.none': 'No products yet — add one from Stock',

    'stock.title': 'Stock', 'stock.sub': 'Every product, two prices: buy & sell',
    'stock.new': 'New product', 'stock.edit': 'Edit',
    'stock.name': 'Name', 'stock.buy': 'Buy price', 'stock.sell': 'Sell price',
    'stock.qty': 'Qty', 'stock.lowAt': 'Low-stock alert at',
    'stock.empty': 'No products — add your first one',
    'common.cancel': 'Cancel', 'common.save': 'Save',

    'debts.title': 'Debts', 'debts.sub': 'The digital notebook — who owes & how much',
    'debts.new': 'New debt',
    'debts.name': 'Customer name', 'debts.amount': 'Amount',
    'debts.phone': 'Phone (optional)', 'debts.note': 'Note',
    'debts.pay': 'Pay', 'debts.paid': 'paid', 'debts.settled': 'Settled',
    'debts.empty': 'No debts — clean',
    'debts.payTitle': 'Pay',

    'report.title': "Today's report", 'report.sub': 'The full money story',
    'report.check': 'Count the box',
    'report.checkPh': 'count the cash in the box now',
    'report.checkGo': 'Record count',
    'report.expected': 'The box should hold: ',
    'report.movements': "Today's moves",
    'report.matched': 'Matches', 'report.diff': 'diff: ',
    'report.noChecks': 'No box counts yet today',
    'report.noMoves': 'No movement today',
    'report.chip.start': 'MORNING CASH', 'report.chip.now': 'IN BOX NOW',
    'report.chip.sales': "TODAY'S SALES", 'report.chip.refunds': 'REFUNDS',
    'report.chip.expenses': 'EXPENSES', 'report.chip.buys': 'STOCK BUYS',
    'report.chip.profit': "TODAY'S PROFIT", 'report.chip.inventory': 'INVENTORY',
    'report.chip.debts': 'OPEN DEBTS',
    'report.chip.low': 'LOW STOCK',
    'kind.sale': 'SALE', 'kind.debtPay': 'DEBT PAY', 'kind.refund': 'REFUND',
    'kind.buy': 'STOCK BUY', 'kind.expense': 'EXPENSE', 'kind.income': 'INCOME',
    'kind.check': 'BOX COUNT',

    'settings.title': 'Settings', 'settings.sub': 'Shop, look, language, day options',
    'settings.sect.shop': 'The shop', 'settings.sect.look': 'The look',
    'settings.sect.lang': 'Language', 'settings.sect.behave': 'Behaviour',
    'settings.sect.day': 'The day', 'settings.sect.about': 'The app',
    'settings.theme': 'Shop look', 'settings.version': 'Version',
    'settings.storage': 'Storage used',
    'theme.souk': 'Gold Souk', 'theme.mint': 'Midnight Mint', 'theme.royal': 'Indigo Night',
    'toast.themeOk': 'Shop look changed',
    'settings.shopName': 'Shop name', 'settings.startCash': 'Morning cash',
    'settings.startCashHint': 'Morning cash changes when a fresh day opens (close day first).',
    'settings.discount': 'Discounted sales allowed',
    'settings.discountHint': 'shows discount fields in Sell',
    'settings.refund': 'Refunds allowed', 'settings.refundHint': 'shows the refund feature',
    'settings.closeDay': 'Close today',
    'settings.export': 'Save backup (JSON)',
    'settings.reset': 'Wipe everything & start over',
    'settings.autosave': 'Everything auto-saves on every action. Backups are doubled inside the browser.',
    'settings.language': 'Interface language',

    'toast.couldntSave': "Couldn't save",
    'toast.saleOk': 'Sale recorded', 'toast.saleCredit': 'Recorded on credit: ',
    'toast.saleRest': 'Sale recorded, rest owed by: ',
    'toast.change': 'Give the customer this change:',
    'toast.paidBad': 'That paid amount is not valid',
    'toast.restName': 'The unpaid rest needs a customer name',
    'toast.freeName': 'Type the item name',
    'toast.refundPick': 'Pick a product to refund',
    'toast.refundOk': 'Refund recorded',
    'toast.prodName': 'Type the product name', 'toast.prodPrice': 'Type the sell price',
    'toast.savedOk': 'Saved',
    'toast.debtName': 'Enter the name and amount', 'toast.debtOk': 'Debt recorded',
    'toast.amount': 'Enter an amount', 'toast.payOk': 'Payment recorded',
    'toast.checkAmt': 'Enter the amount you counted', 'toast.checkOk': 'Count recorded',
    'toast.dayClosed': 'Day closed — a new one opened with the same cash',
    'toast.debtDeleted': 'Deleted from the record',
    'toast.resetConfirm': "Erase all shop data? This can't be undone. (Export a backup first)",
    'toast.resetOk': 'Fresh start',
    'toast.restock': 'Added to stock'
  };

  const T = {
    lang: 'ar',
    t: function (k) {
      const d = this.lang === 'ar' ? AR : EN;
      if (d[k] !== undefined) return d[k];
      if (AR[k] !== undefined) return AR[k];
      return k;
    },
    set: function (lang) {
      this.lang = (lang === 'en') ? 'en' : 'ar';
      try { localStorage.setItem(LS_LANG, this.lang); } catch (e) {}
      document.documentElement.lang = this.lang;
      document.documentElement.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
      this.apply();
      window.dispatchEvent(new CustomEvent('dekkan:lang'));
    },
    apply: function () {
      var self = this;
      var els = document.querySelectorAll('[data-i18n]');
      for (var i = 0; i < els.length; i++) els[i].textContent = self.t(els[i].getAttribute('data-i18n'));
      var phs = document.querySelectorAll('[data-i18n-ph]');
      for (var j = 0; j < phs.length; j++) phs[j].setAttribute('placeholder', self.t(phs[j].getAttribute('data-i18n-ph')));
      var tis = document.querySelectorAll('[data-i18n-title]');
      for (var k = 0; k < tis.length; k++) tis[k].setAttribute('title', self.t(tis[k].getAttribute('data-i18n-title')));
    }
  };

  var saved = null;
  try { saved = localStorage.getItem(LS_LANG); } catch (e) {}
  T.lang = saved === 'en' ? 'en' : 'ar';

  window.T = T;
  // exposed for the i18n consistency check (node scripts/check-i18n.js)
  window.__DEKKAN_I18N__ = { AR: AR, EN: EN };
})();