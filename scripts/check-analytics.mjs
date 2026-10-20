const id = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || '';
if (id && !/^[1-9]\d{0,11}$/.test(id)) throw new Error('NEXT_PUBLIC_YANDEX_METRIKA_ID must be a numeric counter ID');
console.log(id ? 'Yandex Metrika counter configured; actual goal delivery requires verification in the counter.'
  : '::notice::Yandex Metrika counter ID is not configured. Lead capture and attribution work independently; external analytics delivery is disabled.');
