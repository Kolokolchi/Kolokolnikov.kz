// Add a project here. Use only public/demo content: this static catalogue is not access control.
// demoUrl: a build hosted here. url: the original publication, kept as a reference.
export const projects = [
  {
    id:'garilla', name:'GARILLA_GARAGE', category:'website', type:'Сайт с 3D-стендом', status:'Опубликован',
    summary:'Тюнинг-ателье для рамных внедорожников: 3D-разбор и расчёт сметы.',
    description:'Одностраничный сайт внедорожного тюнинг-ателье в стиле «Трафарет и шагрень»: плакатная типографика, срезы как у букв логотипа, фактура RAPTOR. В 3D-стенде «Анатомия рамника» кузов поднимается над рамой и разбирается на 36 узлов с 11 зонами коррозии и 7 доработками. Калькулятор из пяти шагов собирает заявку для WhatsApp.',
    features:['3D-стенд на three.js: 36 узлов, 11 зон коррозии, 7 доработок','Лаборатория покрытий RAPTOR и слайдер «до/после»','Калькулятор-заявка из пяти шагов','Галерея проектов и раздел об автотуризме'],
    tags:['3D','React','Брендинг'], image:'assets/projects/garilla.webp',
    url:'https://kolokolchi.github.io/garilla-garage/', repository:'https://github.com/Kolokolchi/garilla-garage',
    gallery:[{src:'assets/projects/garilla.webp',caption:'Первый экран опубликованной версии GARILLA_GARAGE'},{src:'assets/projects/garilla-rig.webp',caption:'3D-стенд «Анатомия рамника»: кузов над рамой, отмечены зоны коррозии. Модель Defender 110 — meeww, Sketchfab, CC BY 4.0'},{src:'assets/projects/garilla-quiz.webp',caption:'Калькулятор сметы: пять шагов до заявки'}]
  },
  {
    id:'sensata-tours', name:'Sensata 360°', category:'product', type:'Движок 3D-туров и редактор', status:'Опубликован',
    summary:'Свой WebGL-движок туров 360° для пяти ЖК и редактор Studio.',
    description:'Собственный движок виртуальных туров на Three.js вместо прежней сборки на Panotour: аэропанорамы, дворы, холлы и квартиры пяти жилых комплексов Sensata Group открываются в одном окне без перезагрузки. К движку сделан Windows-редактор Sensata 360° Studio: замена панорам с сохранением точек, расстановка меток прямо на сфере, экспорт и подписанная публикация на хост заказчика. Панорамы и рендеры предоставлены заказчиком.',
    features:['Переходы аэро → двор → холл → квартира без перезагрузки','Метки инфраструктуры, схема двора и планировка с точками комнат','RU / KZ / EN и встраивание в сайты на Тильде','Редактор Studio для Windows: установщик, экспорт и откат публикаций'],
    tags:['Three.js','360°','Windows-приложение'], image:'assets/projects/sensata-tours.jpg',
    url:'https://kolokolchi.github.io/sensata-360-tours/', repository:null,
    gallery:[{src:'assets/projects/sensata-tours.jpg',caption:'Аэропанорама ЖК NYGMET в собственном движке: метки, фильтры инфраструктуры и переключатель зон'},{src:'assets/projects/sensata-tours-complexes.webp',caption:'Витрина: пять жилых комплексов в одном окне'},{src:'assets/projects/sensata-tours-apartment.webp',caption:'Квартира: тур по комнатам с планировкой и точками перехода'},{src:'assets/projects/sensata-tours-studio.jpg',caption:'Sensata 360° Studio: замена панорамы, стартовый ракурс и калибровка компаса'}]
  },
  {
    id:'rpk', name:'RPK', category:'website', type:'Корпоративный сайт', status:'Опубликован',
    summary:'Рекламное производство — от каталога технологий до готовых объектов.',
    description:'Сайт рекламно-производственной компании в Алматы. Каталог связывает технологии изготовления, варианты применения и решения для разных объектов.',
    features:['Каталог направлений и технологий','Решения по типам объектов','Галерея выполненных работ','Адаптивная версия и форма обращения'],
    tags:['Каталог','Next.js','Фирменный стиль'], image:'assets/projects/rpk.webp',
    url:'https://kolokolchi.github.io/rpk-site/', repository:'https://github.com/Kolokolchi/rpk-site',
    gallery:[{src:'assets/projects/rpk.webp',caption:'Первый экран опубликованной версии RPK'}]
  },
  {
    id:'ankor', name:'Ankor', category:'website', type:'Сайт с каталогом', status:'Опубликован',
    summary:'Редизайн бренда: продукты, сравнение и удобная корзина.',
    description:'Редизайн сайта Ankor с акцентом на природные материалы и спокойную типографику. Каталог объединяет RENOVA, DETOX, RENOVA+ и NIGELLA S., подробную информацию, сравнение и корзину. Заказ подготавливается для отправки в WhatsApp.',
    features:['Новая визуальная подача и адаптивная вёрстка','Карточки и сравнение четырёх продуктов','Корзина с сохранением выбранных товаров','Подготовка заказа для WhatsApp'],
    tags:['Редизайн','Каталог','Корзина'], image:'assets/projects/ankor.webp',
    demoUrl:'demos/ankor/', url:'https://kolokolchi.github.io/ankor-life/', repository:'https://github.com/Kolokolchi/ankor-life',
    gallery:[{src:'assets/projects/ankor.webp',caption:'Главный экран опубликованного редизайна Ankor'},{src:'assets/projects/ankor-products.webp',caption:'Каталог продуктов RENOVA и DETOX'}]
  },
  {
    id:'vodostok', name:'Воду в сток', category:'website', type:'Магазин с 3D-калькулятором', status:'Опубликован',
    summary:'Водостоки под размеры дома: 3D-схема, комплект и расчёт.',
    description:'Сайт-магазин водосточных систем VEGASTOK и POLIVENT. Посетитель выбирает форму дома или рисует свой план, видит в 3D, где пройдут желоба и трубы, и получает совместимый комплект. Расчёт можно сохранить в PDF или CSV и отправить менеджеру в WhatsApp.',
    features:['3D-калькулятор с шестью типами крыш','Свой план дома по точкам или из фигур','Каталог из 34 позиций с выбором цвета','Экспорт расчёта и заявка в WhatsApp'],
    tags:['3D-калькулятор','Каталог','React'], image:'assets/projects/vodostok.webp',
    url:'https://kolokolchi.github.io/vodu-v-stok-site/', repository:'https://github.com/Kolokolchi/vodu-v-stok-site',
    gallery:[{src:'assets/projects/vodostok.webp',caption:'Главная: выбор цвета системы и калькулятор на первом экране. Цены и телефон скрыты'},{src:'assets/projects/vodostok-calculator.webp',caption:'3D-схема П-образного дома и состав комплекта. Цены скрыты'},{src:'assets/projects/vodostok-plan.webp',caption:'Редактор плана: контур дома из фигур с поворотом и размерами'}]
  },
  {
    id:'saf', name:'SAF Avenue', category:'product', type:'Интерактивный каталог', status:'Опубликован',
    summary:'Выбор квартир через визуальный каталог и параметры планировок.',
    description:'Рабочее пространство для выбора объекта и планировки. Визуальная навигация дополняется фильтрами и карточками квартир. Публичный каталог планировок отделён от подтверждения наличия и цены.',
    features:['Визуальный выбор объекта и секции','Подбор планировок по параметрам','Карточки и сравнение вариантов','Интерактивная презентация жилого комплекса'],
    tags:['Недвижимость','React','Интерактив'], image:'assets/projects/saf-section-picker.webp',
    url:'https://kolokolchi.github.io/Sansata/', repository:'https://github.com/Kolokolchi/Sansata',
    gallery:[{src:'assets/projects/saf-section-picker.webp',caption:'Визуальный выбор секции — экран локальной версии'},{src:'assets/projects/saf.webp',caption:'Выбор объекта — опубликованная версия'}]
  },
  {
    id:'izum', name:'Izum Design & Production', category:'website', type:'Сайт с 3D-конструктором', status:'Опубликован',
    summary:'Сайт швейного продакшна на сетке знака и 3D-конструктор мерча.',
    description:'Сайт производства одежды и корпоративного мерча в Алматы. Сетка всех страниц выведена из пропорций знака IZUM: арка U, диагональ Z и галочка M задают колонки, срезы фото и линии первого экрана. В 3D-конструкторе изделие крутится в браузере, нанесение кладётся слоями, лекала скачиваются в SVG и DXF.',
    features:['Сетка страниц из пропорций знака','Оборот изделия на 360° и перекраска в восемь цветов','3D-конструктор мерча: нанесение слоями, PNG и отправка макета','Лекала S–XXXL в SVG и DXF'],
    tags:['3D-конструктор','three.js','Айдентика'], image:'assets/projects/izum.webp',
    url:'https://kolokolchi.github.io/izum-grid/', repository:'https://github.com/Kolokolchi/izum-grid',
    gallery:[{src:'assets/projects/izum.webp',caption:'Первый экран: знак во весь экран, вещь в арке U'},{src:'assets/projects/izum-constructor.webp',caption:'3D-конструктор мерча: изделие, выкройка и параметры'},{src:'assets/projects/izum-production.webp',caption:'Страница производства на той же сетке'}]
  },
  {
    id:'lesa', name:'Леса-вышки', category:'website', type:'Сайт с конфигуратором', status:'Опубликован',
    summary:'Каталог оборудования с интерактивной сборкой конструкции.',
    description:'Адаптивный сайт строительного оборудования. Посетитель выбирает леса или вышку, меняет размеры, видит схему сборки и передаёт выбранную комплектацию в запрос менеджеру.',
    features:['Каталог лесов и вышек-тур','Интерактивная схема сборки','Настройка высоты, длины и площадки','Заявка с выбранной комплектацией'],
    tags:['Конфигуратор','JavaScript','Адаптив'], image:'assets/projects/lesa.webp',
    demoUrl:'demos/lesa/', url:'https://kolokolchi.github.io/lesa-vyshki/', repository:'https://github.com/Kolokolchi/lesa-vyshki',
    gallery:[{src:'assets/projects/lesa.webp',caption:'Главная страница опубликованного сайта'},{src:'assets/projects/lesa-configurator.webp',caption:'Конфигуратор строительных лесов'},{src:'assets/projects/lesa-mobile.webp',caption:'Первый экран на телефоне'}]
  },
  {
    id:'rmx', name:'RMX Solutions', category:'website', type:'Корпоративный сайт', status:'Локальный прототип',
    summary:'Дизайн, инженерия и производство — с 3D-моделью в браузере.',
    description:'Лендинг инженерно-дизайнерской компании из Алматы: коммерческие интерьеры, конструкции и холодильное оборудование. В блоке «Инженерия» холодильный модуль из шести узлов можно повернуть, разобрать и включить вентиляторы. Логотип, палитра и вёрстка созданы с нуля.',
    features:['WebGL-модель модуля: сборка и разборка по узлам','Кейсы с фильтрами и галереей','Семь направлений компетенций','Новый логотип и графитово-латунная палитра'],
    tags:['WebGL','Three.js','Айдентика'], image:'assets/projects/rmx.webp',url:null,repository:null,
    gallery:[{src:'assets/projects/rmx.webp',caption:'Первый экран. Фото объекта заказчика с ретушью'},{src:'assets/projects/rmx-engineering.webp',caption:'Холодильный модуль в разборе: шесть узлов, вентиляторы включены'},{src:'assets/projects/rmx-projects.webp',caption:'Кейсы с фильтрами. Фото объектов предоставлены заказчиком'}]
  },
  {
    id:'killdez', name:'KILL DEZ', category:'website', type:'Сайт услуг', status:'Опубликован',
    summary:'Выразительная подача сервиса по борьбе с вредителями.',
    description:'Сайт услуг с контрастной типографикой и графическим фирменным стилем. Услуги организованы по задачам посетителя и типам объектов, с русской и казахской версиями.',
    features:['Фирменный стиль и графическая подача','Каталог услуг и типов объектов','Русский и казахский языки','Сценарий запроса стоимости обработки'],
    tags:['Брендинг','Next.js','RU / KZ'], image:'assets/projects/killdez.webp',
    url:'https://kolokolchi.github.io/KillDEZ/', repository:'https://github.com/Kolokolchi/KillDEZ',
    gallery:[{src:'assets/projects/killdez.webp',caption:'Первый экран опубликованной версии KILL DEZ'}]
  },
  {
    id:'patrol', name:'Patrol Control', category:'product', type:'Приложение', status:'Локальный прототип',
    summary:'Бортовой интерфейс для света, оборудования и телеметрии.',
    description:'Приложение для управления дополнительным оборудованием внедорожника. В интерфейсе собраны освещение, датчики, карта и диагностика. В презентации показан локальный интерфейс без подключения к автомобилю.',
    features:['Единая панель управления оборудованием','Управление дополнительным светом','Экраны датчиков и диагностики','Интерфейс для телефона и бортового экрана'],
    tags:['Приложение','React','ESP32'], image:'assets/projects/patrol.webp',url:null,repository:null,
    gallery:[{src:'assets/projects/patrol.webp',caption:'Локальный прототип, офлайн-режим. Показатели на экране не являются измерениями подключённого автомобиля.'}]
  },
  {
    id:'qysym', name:'Qysym Lab', category:'product', type:'Учебное приложение', status:'Android-приложение, локальная сборка',
    summary:'Интерактивная лаборатория к школьному исследованию о давлении.',
    description:'Учебное веб-приложение и Android-APK к школьному исследованию о повышенном давлении. Посетитель выбирает или создаёт персонажа, меняет параметры и видит, как отвечает модель логистической регрессии, обученная на открытом датасете. Это учебная демонстрация, а не медицинский инструмент: интерфейс на казахском и русском, расчёт идёт в браузере без сети.',
    features:['Персонажи с оригинальными векторными аватарами','Сценарий «А что, если…» для возраста и веса','Раздел о методике, метриках и ограничениях модели','Қазақша / русский, офлайн, Android APK'],
    tags:['Приложение','KZ / RU','Android'], image:'assets/projects/qysym.webp', url:null, repository:null,
    gallery:[{src:'assets/projects/qysym.webp',caption:'Первый экран: персонажи лаборатории и результат эксперимента'},{src:'assets/projects/qysym-scenario.webp',caption:'Сценарий «А что, если изменить вес» для примера «Ерлан»'},{src:'assets/projects/qysym-research.webp',caption:'Раздел об исследовании: метрики и сравнение моделей'},{src:'assets/projects/qysym-mobile.webp',caption:'Казахская версия на телефоне'}]
  },
  {
    id:'saf-landing', name:'SAF Avenue — лендинг', category:'website', type:'Сайт недвижимости', status:'Опубликован',
    summary:'Презентационный сайт жилого комплекса на двух языках.',
    description:'Работа с существующим презентационным сайтом SAF Avenue: адаптация и публикация с сохранением исходной композиции, фотографий, анимаций и визуального стиля комплекса.',
    features:['Сохранение исходного дизайна комплекса','Русская и казахская версии','Фотогалереи и интерактивные блоки','Адаптация статической публикации'],
    tags:['Адаптация','Недвижимость','RU / KZ'], image:'assets/projects/saf-landing.webp',
    url:'https://kolokolchi.github.io/SAF_Landing/',repository:'https://github.com/Kolokolchi/SAF_Landing',
    gallery:[{src:'assets/projects/saf-landing.webp',caption:'Первый экран опубликованного сайта SAF Avenue'}]
  },
  {
    id:'dis-cleaning', name:'Dis Cleaning', category:'website', type:'Корпоративный сайт', status:'Опубликован',
    summary:'Услуги дезинфекции и клининга для дома и бизнеса.',
    description:'Сайт сервисной компании с каталогом услуг и решениями для разных типов объектов. Структура помогает посетителю найти нужную обработку, изучить порядок работ и обратиться за расчётом.',
    features:['Каталог направлений обработки','Навигация по типам объектов','Ответы на частые вопросы','Русская и казахская версии'],
    tags:['Каталог услуг','Next.js','RU / KZ'],image:'assets/projects/dis-cleaning.webp',
    url:'https://kolokolchi.github.io/Site_Disinfection/',repository:'https://github.com/Kolokolchi/Site_Disinfection',
    gallery:[{src:'assets/projects/dis-cleaning.webp',caption:'Первый экран опубликованной версии Dis Cleaning'}]
  }
];
export const contact = {email:'kolokolnikovk@gmail.com',phone:'+77074151715'};
