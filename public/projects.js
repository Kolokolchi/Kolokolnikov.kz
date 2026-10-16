// Add a project here. Use only public/demo content: this static catalogue is not access control.
// demoUrl: a build hosted here. url: the original publication, kept as a reference.
export const projects = [
  {
    id:'rpk', name:'RPK', category:'website', type:'Корпоративный сайт', status:'Опубликован',
    summary:'Рекламное производство — от каталога технологий до готовых объектов.',
    description:'Сайт рекламно-производственной компании в Алматы. Каталог связывает технологии изготовления, варианты применения и решения для разных объектов.',
    features:['Каталог направлений и технологий','Решения по типам объектов','Галерея выполненных работ','Адаптивная версия и форма обращения'],
    tags:['Каталог','Next.js','Фирменный стиль'], image:'assets/projects/rpk.jpg',
    url:'https://kolokolchi.github.io/rpk-site/', repository:'https://github.com/Kolokolchi/rpk-site',
    gallery:[{src:'assets/projects/rpk.jpg',caption:'Первый экран опубликованной версии RPK'}]
  },
  {
    id:'ankor', name:'Ankor', category:'website', type:'Сайт с каталогом', status:'Опубликован',
    summary:'Редизайн бренда: продукты, сравнение и удобная корзина.',
    description:'Редизайн сайта Ankor с акцентом на природные материалы и спокойную типографику. Каталог объединяет RENOVA, DETOX, RENOVA+ и NIGELLA S., подробную информацию, сравнение и корзину. Заказ подготавливается для отправки в WhatsApp.',
    features:['Новая визуальная подача и адаптивная вёрстка','Карточки и сравнение четырёх продуктов','Корзина с сохранением выбранных товаров','Подготовка заказа для WhatsApp'],
    tags:['Редизайн','Каталог','Корзина'], image:'assets/projects/ankor.jpg',
    demoUrl:'demos/ankor/', url:'https://kolokolchi.github.io/ankor-life/', repository:'https://github.com/Kolokolchi/ankor-life',
    gallery:[{src:'assets/projects/ankor.jpg',caption:'Главный экран опубликованного редизайна Ankor'},{src:'assets/projects/ankor-products.jpg',caption:'Каталог продуктов RENOVA и DETOX'}]
  },
  {
    id:'saf', name:'SAF Avenue', category:'product', type:'Интерактивный каталог', status:'Опубликован',
    summary:'Выбор квартир через визуальный каталог и параметры планировок.',
    description:'Рабочее пространство для выбора объекта и планировки. Визуальная навигация дополняется фильтрами и карточками квартир. Публичный каталог планировок отделён от подтверждения наличия и цены.',
    features:['Визуальный выбор объекта и секции','Подбор планировок по параметрам','Карточки и сравнение вариантов','Интерактивная презентация жилого комплекса'],
    tags:['Недвижимость','React','Интерактив'], image:'assets/projects/saf.png',
    url:'https://kolokolchi.github.io/Sansata/', repository:'https://github.com/Kolokolchi/Sansata',
    gallery:[{src:'assets/projects/saf.png',caption:'Визуальный выбор секции — экран локальной версии'},{src:'assets/projects/saf.jpg',caption:'Выбор объекта — опубликованная версия'}]
  },
  {
    id:'lesa', name:'Леса-вышки', category:'website', type:'Сайт с конфигуратором', status:'Опубликован',
    summary:'Каталог оборудования с интерактивной сборкой конструкции.',
    description:'Адаптивный сайт строительного оборудования. Посетитель выбирает леса или вышку, меняет размеры, видит схему сборки и передаёт выбранную комплектацию в запрос менеджеру.',
    features:['Каталог лесов и вышек-тур','Интерактивная схема сборки','Настройка высоты, длины и площадки','Заявка с выбранной комплектацией'],
    tags:['Конфигуратор','JavaScript','Адаптив'], image:'assets/projects/lesa.jpg',
    demoUrl:'demos/lesa/', url:'https://kolokolchi.github.io/lesa-vyshki/', repository:'https://github.com/Kolokolchi/lesa-vyshki',
    gallery:[{src:'assets/projects/lesa.jpg',caption:'Главная страница опубликованного сайта'},{src:'assets/projects/lesa-configurator.png',caption:'Конфигуратор строительных лесов'},{src:'assets/projects/lesa-mobile.png',caption:'Первый экран на телефоне'}]
  },
  {
    id:'killdez', name:'KILL DEZ', category:'website', type:'Сайт услуг', status:'Опубликован',
    summary:'Выразительная подача сервиса по борьбе с вредителями.',
    description:'Сайт услуг с контрастной типографикой и графическим фирменным стилем. Услуги организованы по задачам посетителя и типам объектов, с русской и казахской версиями.',
    features:['Фирменный стиль и графическая подача','Каталог услуг и типов объектов','Русский и казахский языки','Сценарий запроса стоимости обработки'],
    tags:['Брендинг','Next.js','RU / KZ'], image:'assets/projects/killdez.jpg',
    url:'https://kolokolchi.github.io/KillDEZ/', repository:'https://github.com/Kolokolchi/KillDEZ',
    gallery:[{src:'assets/projects/killdez.jpg',caption:'Первый экран опубликованной версии KILL DEZ'}]
  },
  {
    id:'patrol', name:'Patrol Control', category:'product', type:'Приложение', status:'Локальный прототип',
    summary:'Бортовой интерфейс для света, оборудования и телеметрии.',
    description:'Приложение для управления дополнительным оборудованием внедорожника. В интерфейсе собраны освещение, датчики, карта и диагностика. В презентации показан локальный интерфейс без подключения к автомобилю.',
    features:['Единая панель управления оборудованием','Управление дополнительным светом','Экраны датчиков и диагностики','Интерфейс для телефона и бортового экрана'],
    tags:['Приложение','React','ESP32'], image:'assets/projects/patrol.jpg',url:null,repository:null,
    gallery:[{src:'assets/projects/patrol.jpg',caption:'Локальный прототип, офлайн-режим. Показатели на экране не являются измерениями подключённого автомобиля.'}]
  },
  {
    id:'aral', name:'ARAL DUNE', category:'presentation', type:'Веб-презентация', status:'Опубликован',
    summary:'Интерактивная презентация фестиваля автотуризма в Аралкуме.',
    description:'Веб-презентация концепции фестиваля DRIVE FORUM GREAT ORDA — ARAL DUNE. Формат объединяет программу, интерактивную схему трассы, практические материалы и чек-лист для участников.',
    features:['Презентация формата и программы','Интерактивная схема трассы','Чек-лист подготовки автомобиля','Материалы и документы для участников'],
    tags:['Презентация','React','Интерактив'], image:'assets/projects/aral.jpg',
    url:'https://kolokolchi.github.io/aral-dune/', repository:'https://github.com/Kolokolchi/aral-dune',
    gallery:[{src:'assets/projects/aral.jpg',caption:'Главный экран веб-презентации ARAL DUNE'}]
  },
  {
    id:'saf-landing', name:'SAF Avenue — лендинг', category:'website', type:'Сайт недвижимости', status:'Опубликован',
    summary:'Презентационный сайт жилого комплекса на двух языках.',
    description:'Работа с существующим презентационным сайтом SAF Avenue: адаптация и публикация с сохранением исходной композиции, фотографий, анимаций и визуального стиля комплекса.',
    features:['Сохранение исходного дизайна комплекса','Русская и казахская версии','Фотогалереи и интерактивные блоки','Адаптация статической публикации'],
    tags:['Адаптация','Недвижимость','RU / KZ'], image:'assets/projects/saf-landing.jpg',
    url:'https://kolokolchi.github.io/SAF_Landing/',repository:'https://github.com/Kolokolchi/SAF_Landing',
    gallery:[{src:'assets/projects/saf-landing.jpg',caption:'Первый экран опубликованного сайта SAF Avenue'}]
  },
  {
    id:'dis-cleaning', name:'Dis Cleaning', category:'website', type:'Корпоративный сайт', status:'Опубликован',
    summary:'Услуги дезинфекции и клининга для дома и бизнеса.',
    description:'Сайт сервисной компании с каталогом услуг и решениями для разных типов объектов. Структура помогает посетителю найти нужную обработку, изучить порядок работ и обратиться за расчётом.',
    features:['Каталог направлений обработки','Навигация по типам объектов','Ответы на частые вопросы','Русская и казахская версии'],
    tags:['Каталог услуг','Next.js','RU / KZ'],image:'assets/projects/dis-cleaning.jpg',
    url:'https://kolokolchi.github.io/Site_Disinfection/',repository:'https://github.com/Kolokolchi/Site_Disinfection',
    gallery:[{src:'assets/projects/dis-cleaning.jpg',caption:'Первый экран опубликованной версии Dis Cleaning'}]
  }
];
export const contact = {email:'kolokolnikovk@gmail.com',phone:'+77074151715'};
