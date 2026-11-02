window.SITE = {
  brand: "NimetBars",
  tagline: "Doğal Taş Atölyesi",
  // TODO: Gerçek iletişim bilgileriyle değiştirin (uluslararası formatta, başında + olmadan).
  whatsapp: "905000000000",
  phoneDisplay: "+90 500 000 00 00",
  email: "info@nimetbars.com",
  city: "Türkiye geneli gönderim",
  instagram: "#"
};

window.CATEGORIES = [
  { id: "kurna", name: "Hamam Kurnaları", short: "Kurnalar", blurb: "Tek blok taştan oyulan, hamam ve spa alanlarına yakışan kurnalar.", cover: "p34-1" },
  { id: "lavabo", name: "Eviye & Lavabolar", short: "Lavabolar", blurb: "Tezgah üstü kullanıma uygun, her biri tek desenli taş lavabolar.", cover: "p27-1" },
  { id: "sehpa", name: "Sehpa & Masalar", short: "Sehpalar", blurb: "Yaşam alanında odak noktası olan heykelsi taş mobilyalar.", cover: "p17-1" },
  { id: "aksesuar", name: "Banyo Aksesuarları", short: "Aksesuarlar", blurb: "Sabunluk ve tezgah setleriyle banyoda bütünlüklü bir görünüm.", cover: "p05-1" },
  { id: "dekor", name: "Dekoratif Ürünler", short: "Dekor", blurb: "Kase, heykel ve sunum objeleriyle taşın sıcaklığı her köşede.", cover: "p04-2" }
];

window.PRODUCTS = [
  {
    id: "p01", cat: "kurna", name: "Beyaz Afyon Modern Kurna",
    stone: "Afyon Beyaz Mermer", finish: "Parlak cila",
    summary: "Sade hatlı, çağdaş banyolar için tasarlanmış beyaz mermer kurna.",
    desc: "Süt beyazı zemini ve ince damarlarıyla Afyon mermerinin en yalın yorumu. Keskin süslemeler yerine yumuşak kavisler tercih edilerek hem klasik hamamlara hem de minimal banyolara uyum sağlaması hedeflendi.",
    features: ["Tek parça mermerden oyma gövde", "Modern ve klasik mekânlara uyumlu form", "Siparişe özel ölçü imkânı"],
    sizes: "45 × 45 × 25 cm veya 35 × 35 × 25 cm",
    images: ["p01-1"]
  },
  {
    id: "p02", cat: "kurna", name: "Siyah Doğal Taş Kurna",
    stone: "Siyah Doğal Taş", finish: "El işçiliği yüzey",
    summary: "Koyu tonlu taşın güçlü duruşunu taşıyan, elde şekillendirilmiş kurna.",
    desc: "Derin siyah rengiyle açık tonlu mermer duvarlar ve pirinç bataryalarla çarpıcı bir kontrast oluşturur. Tamamen usta elinde biçimlendirilir; yüzeydeki küçük farklılıklar ürünün el yapımı karakterinin bir parçasıdır.",
    features: ["%100 el işçiliği", "Açık zeminlerde güçlü kontrast", "Farklı ölçülerde üretilebilir"],
    sizes: "35 × 35 × 25 cm veya 45 × 45 × 25 cm",
    images: ["p02-1"]
  },
  {
    id: "p03", cat: "kurna", name: "Mini Köşe Kurna",
    stone: "Afyon Beyaz Mermer", finish: "Parlak cila",
    summary: "Dar alanlar ve köşe montajı için kompakt boyutlu mermer kurna.",
    desc: "Küçük banyolarda, misafir tuvaletlerinde veya sauna girişlerinde hamam ritüelini mümkün kılan kompakt bir model. Köşeye oturan formu sayesinde yerden tasarruf ederken mekâna zarif bir detay ekler.",
    features: ["Köşe montajına uygun gövde", "Kompakt ölçü", "Pirinç batarya ile şık uyum"],
    images: ["p03-1"]
  },
  {
    id: "p04", cat: "dekor", name: "Mermer Aslan Heykeli",
    stone: "Doğal Mermer", finish: "El oyması",
    summary: "Giriş, bahçe ve villa projeleri için anıtsal mermer aslan figürü.",
    desc: "Bekçi aslan motifinin klasik duruşunu doğal mermerle yeniden yorumlayan bu heykel, kapı girişlerinde ve bahçe yollarında güçlü bir karşılama etkisi yaratır. Otel ve konut projeleri için çift olarak da hazırlanabilir.",
    features: ["Usta heykeltıraş işçiliği", "Dış mekân kullanımına uygun", "Farklı taş, renk ve boy seçenekleri"],
    images: ["p04-1", "p04-2", "p04-3"]
  },
  {
    id: "p05", cat: "aksesuar", name: "Gri Mermer Sabunluk Seti",
    stone: "Gri Mermer", finish: "Mat ve parlak karışık",
    summary: "Tezgahta bütünlüklü görünüm sağlayan gri mermer banyo seti.",
    desc: "Sıvı sabunluk, diş fırçalık ve sabunluktan oluşan set, gri mermerin serin tonlarını tezgaha taşır. Taşın ağırlığı sayesinde parçalar devrilmeden sabit durur.",
    features: ["Çok parçalı set", "Ağır ve dengeli gövde", "Kolay temizlenen yüzey"],
    images: ["p05-1"]
  },
  {
    id: "p06", cat: "dekor", name: "Traverten Mama & Su Kabı",
    stone: "Traverten", finish: "Honlu (mat)",
    summary: "Evcil dostlar için ağır, kaymayan ve şık traverten kaplar.",
    desc: "Plastik kapların yerini alan bu traverten ikili, ağırlığı sayesinde yerde kaymaz ve kolayca devrilmez. Doğal taş dokusu mutfak ve salon dekoruyla uyumlu bir görüntü sunar.",
    features: ["İkili set", "Kaymaz, ağır taban", "Hijyenik ve kolay yıkanır"],
    sizes: "Çap 20 cm, yükseklik 6 cm",
    images: ["p06-1"]
  },
  {
    id: "p07", cat: "lavabo", name: "Yaprak Formlu Oniks Lavabo",
    stone: "Oniks Mermer", finish: "Parlak cila",
    summary: "Yaprak silüetinden ilham alan, damar geçişleri belirgin oniks lavabo.",
    desc: "Organik yaprak formu, oniks taşının beyaz, gri ve lila tonlu damarlarıyla birleşerek tezgah üzerinde bir sanat objesine dönüşür. Her blok farklı desen taşıdığı için iki ürün asla birbirinin aynısı olmaz.",
    features: ["Tezgah üstü montaj", "Asimetrik organik form", "Tek ve tekrarsız desen"],
    images: ["p07-1", "p07-2"]
  },
  {
    id: "p08", cat: "lavabo", name: "Violet Spiral Lavabo",
    stone: "Afyon Violet Mermer", finish: "Parlak cila",
    summary: "Spiral oluklu dış yüzeyiyle hareketli, mor damarlı mermer lavabo.",
    desc: "Dış gövdeye işlenen spiral oluklar, ışık değdikçe hareket hissi veren bir yüzey yaratır. Afyon Violet mermerin mor ve gri damarları bu ritmik formu daha da belirgin kılar.",
    features: ["Spiral oluk işçiliği", "Tezgah üstü kullanım", "Mor-gri damarlı zemin"],
    images: ["p08-1", "p08-2"]
  },
  {
    id: "p09", cat: "lavabo", name: "Yaprak Formlu Traverten Lavabo",
    stone: "Traverten", finish: "Honlu (mat)",
    summary: "Sıcak bej tonlarıyla doğal yaprak formunda traverten lavabo.",
    desc: "Traverten taşının sıcak bej rengi ve gözenekli dokusu, yaprak formunun yumuşak kıvrımlarıyla birleşir. Ahşap tezgahlar ve doğal tonlu banyolar için ideal bir tamamlayıcıdır.",
    features: ["Organik yaprak tasarımı", "Sıcak bej renk paleti", "Tek bloktan işçilik"],
    images: ["p09-1", "p09-2", "p09-3"]
  },
  {
    id: "p10", cat: "sehpa", name: "Siyah Mermer Yan Sehpa",
    stone: "Siyah Mermer", finish: "Parlak cila",
    summary: "Kalın mermer tabla ve ince metal ayakla minimal yan sehpa.",
    desc: "Beyaz damarlı siyah mermer tabla, tek ve ince siyah metal ayak üzerinde havada duruyormuş gibi görünür. Koltuk yanında veya okuma köşesinde güçlü ama sade bir aksan oluşturur.",
    features: ["Masif mermer tabla", "Minimal metal ayak", "Beyaz damarlı siyah zemin"],
    images: ["p10-1", "p10-2"]
  },
  {
    id: "p11", cat: "lavabo", name: "Golden Marble Oval Lavabo",
    stone: "Golden Marble", finish: "Parlak cila",
    summary: "Gri ve altın tonlu damarlarıyla dikkat çeken oval mermer lavabo.",
    desc: "Gri zemin üzerinde altın sarısına çalan damarlar, oval formun her yüzünde farklı bir desen ortaya çıkarır. Altın veya pirinç bataryalarla birlikte kullanıldığında uyumu daha da belirginleşir.",
    features: ["Oval tezgah üstü form", "Altın tonlu damarlar", "Parlak, kolay silinen yüzey"],
    images: ["p11-1", "p11-2", "p11-3"]
  },
  {
    id: "p12", cat: "lavabo", name: "Patlatma Yüzeyli Traverten Lavabo",
    stone: "Traverten", finish: "Dışı patlatma, içi cilalı",
    summary: "Ham taş görünümlü dış yüzey ve pürüzsüz iç hazneyle oval lavabo.",
    desc: "Dış yüzeyi kırık taş dokusunda bırakılan, iç haznesi ise pürüzsüz işlenen bu lavabo, ham ile rafine olanı tek parçada buluşturur. Rustik ve modern banyolarda aynı ölçüde etkileyicidir.",
    features: ["Doğal patlatma dış yüzey", "Pürüzsüz iç hazne", "Oval tezgah üstü form"],
    images: ["p12-1"]
  },
  {
    id: "p13", cat: "lavabo", name: "Golden Marble Kesik Kenarlı Lavabo",
    stone: "Golden Marble", finish: "Dışı patlatma, içi cilalı",
    summary: "Kaba yontulmuş dış hatlarıyla heykelsi görünümlü mermer lavabo.",
    desc: "Dış yüzeyde bırakılan kaba yontu izleri, Golden Marble'ın gri-altın damarlarını üç boyutlu bir dokuyla öne çıkarır. Sade tezgahlarda tek başına odak noktası olmaya aday bir parça.",
    features: ["El yontusu dış gövde", "Cilalı iç hazne", "Gri-altın damar dokusu"],
    images: ["p13-1", "p13-2"]
  },
  {
    id: "p14", cat: "lavabo", name: "Oval Traverten Lavabo",
    stone: "Traverten", finish: "Dışı patlatma, içi cilalı",
    summary: "Klasik oval formda, doğal dokulu traverten tezgah üstü lavabo.",
    desc: "Zamansız oval formu ve traverten taşının yumuşak krem tonlarıyla her banyo stiline kolayca uyum sağlar. Doğal yüzey dokusu, ışığın açısına göre farklı gölgeler yaratır.",
    features: ["Klasik oval form", "Krem-bej doğal ton", "Tezgah üstü montaj"],
    images: ["p14-1", "p14-2", "p14-3"]
  },
  {
    id: "p15", cat: "sehpa", name: "Sanatsal Mermer Yemek Masası",
    stone: "Doğal Mermer", finish: "Parlak cila",
    summary: "Akışkan damarlı geniş tabla ve heykelsi ayakla mermer masa.",
    desc: "Geniş mermer tabla üzerindeki gri, bej ve kahve tonlu damarlar, masayı yemek odasının ana sanat eserine dönüştürür. Yemek alanları, toplantı odaları ve showroomlar için uygundur.",
    features: ["Büyük ölçülü masif tabla", "Heykelsi orta ayak", "Projeye özel ölçü"],
    images: ["p15-1", "p15-2"]
  },
  {
    id: "p16", cat: "sehpa", name: "Mermer & Traverten Orta Sehpa",
    stone: "Mermer tabla, traverten ayak", finish: "Parlak tabla, mat ayak",
    summary: "Desenli mermer tabla ve silindir traverten ayaklarla iki taşlı sehpa.",
    desc: "Organik hatlı tablada yoğun damarlı mermer, ayaklarda ise sıcak tonlu traverten kullanılarak iki farklı taşın karakteri tek tasarımda buluşturuldu. Geniş salonlarda güçlü bir merkez parça olur.",
    features: ["İki farklı doğal taş", "Organik tabla formu", "Silindir traverten ayaklar"],
    images: ["p16-1", "p16-2", "p16-3"]
  },
  {
    id: "p17", cat: "sehpa", name: "Rosso Levanto Blok Sehpa",
    stone: "Rosso Levanto Mermer", finish: "Parlak cila",
    summary: "Bordo tonlu mermerden masif blok formda orta sehpa.",
    desc: "Rosso Levanto mermerinin bordo zemini ve beyaz-yeşil damarları, yalın blok formda en saf haliyle sergilenir. Nötr tonlu koltuk takımlarının önünde zengin ve sıcak bir renk vurgusu yaratır.",
    features: ["Masif blok gövde", "Bordo zemin, açık damarlar", "Modern ve klasik salonlara uyumlu"],
    images: ["p17-1", "p17-2", "p17-3"]
  },
  {
    id: "p18", cat: "sehpa", name: "Akışkan Formlu Traverten Sehpa",
    stone: "Traverten", finish: "Honlu (mat)",
    summary: "Bulut silüetli tabla ve küre ayaklarla heykelsi traverten sehpa.",
    desc: "Düz kenarlardan kaçınan akışkan tabla, küre formundaki traverten ayaklarla birleşerek yumuşak ve davetkâr bir siluet oluşturur. Japandi ve minimal iç mekânlarda öne çıkar.",
    features: ["Organik bulut formu", "Küre traverten ayaklar", "Mat, doğal dokulu yüzey"],
    images: ["p18-1", "p18-2"]
  },
  {
    id: "p19", cat: "sehpa", name: "Elips Traverten Orta Sehpa",
    stone: "Traverten", finish: "Honlu (mat)",
    summary: "Yumuşak elips tabla ve küre ayaklarla zamansız traverten sehpa.",
    desc: "Elips tabla, salonun akışını kesmeden geniş bir kullanım yüzeyi sunar. Küre ayaklar tasarıma heykelsi bir hafiflik katarken traverten dokusu mekâna sıcaklık getirir.",
    features: ["Elips tabla", "Küre traverten ayaklar", "Nötr bej tonları"],
    images: ["p19-1", "p19-2", "p19-3"]
  },
  {
    id: "p20", cat: "sehpa", name: "Cam Tablalı Traverten Sehpa",
    stone: "Traverten ayak, cam tabla", finish: "Mat ayak, şeffaf tabla",
    summary: "Şeffaf cam tabla ve traverten küre ayaklarla hafif görünümlü sehpa.",
    desc: "Şeffaf cam tabla, altındaki traverten ayakların dokusunu görünür kılarak küçük salonlarda bile ferah bir etki yaratır. Taş ve camın birlikteliği modern ve aydınlık bir dekor sunar.",
    features: ["Cam tabla", "El yapımı traverten ayaklar", "Ferah, hafif görünüm"],
    images: ["p20-1", "p20-2", "p20-3"]
  },
  {
    id: "p21", cat: "kurna", name: "Dalgalı Traverten Kurna",
    stone: "Traverten", finish: "Honlu (mat)",
    summary: "Dalga motifli gövdesiyle geleneksel hamam ruhunu taşıyan kurna.",
    desc: "Gövdeyi çevreleyen dalga oyması, klasik Türk hamamı kurnalarının ritmini modern bir sadelikle yeniden yorumlar. Traverten taşın sıcak tonları, çini duvarlar ve pirinç bataryalarla uyum içindedir.",
    features: ["Dalga motifli el oyması", "Hamam ve spa kullanımına uygun", "Sıcak traverten tonu"],
    images: ["p21-1"]
  },
  {
    id: "p22", cat: "kurna", name: "Rustik Kenarlı Traverten Kurna",
    stone: "Traverten", finish: "Dışı rustik, içi pürüzsüz",
    summary: "Ham bırakılmış kenarlarıyla doğal ve otantik traverten kurna.",
    desc: "Dış kenarlarda taşın doğal kırılma izleri korunurken iç hazne pürüzsüz işlenir. Ortaya çıkan zıtlık, kurnaya yüzyıllık bir hamamdan çıkmış gibi otantik bir görünüm kazandırır.",
    features: ["Rustik dış kenar", "Pürüzsüz iç hazne", "Duvara montaja uygun"],
    images: ["p22-1"]
  },
  {
    id: "p23", cat: "lavabo", name: "Rustik Kenarlı Traverten Lavabo",
    stone: "Traverten", finish: "Dışı rustik, içi cilalı",
    summary: "Doğal kırık kenar dokusuyla tezgah üstü traverten lavabo.",
    desc: "Geniş oval hazne ve doğal kırık kenarlar, lavaboya topraktan yeni çıkarılmış bir taş görünümü verir. Ahşap, beton veya mermer tezgahlarla aynı ölçüde iyi eşleşir.",
    features: ["Doğal kırık kenar dokusu", "Geniş oval hazne", "Tezgah üstü montaj"],
    images: ["p23-1", "p23-2", "p23-3"]
  },
  {
    id: "p24", cat: "kurna", name: "Klasik Hamam Kurnası",
    stone: "Doğal Taş", finish: "El işçiliği",
    summary: "Geleneksel oluk motifli, spa ve villa hamamları için kurna.",
    desc: "Osmanlı hamamlarında sıkça görülen oluklu gövde formunu koruyan bu kurna, modern banyolara köklü bir hamam atmosferi taşır. Çini kaplı duvarlarla birlikte kullanıldığında etkisi daha da güçlenir.",
    features: ["Geleneksel oluk motifi", "Villa ve otel spa projelerine uygun", "Tek parça gövde"],
    images: ["p24-1", "p24-2", "p24-3"]
  },
  {
    id: "p25", cat: "kurna", name: "Pirinç Ayaklı Hamam Kurnası",
    stone: "Doğal Taş", finish: "El işçiliği",
    summary: "Pirinç batarya ve aksesuarlarla tamamlanan klasik hamam kurnası.",
    desc: "Yuvarlak hatlı taş gövde, pirinç musluk ve hamam tasıyla birlikte kullanıldığında eksiksiz bir hamam köşesi oluşturur. Ev hamamları ve butik otel spaları için tasarlandı.",
    features: ["Yuvarlak hatlı gövde", "Pirinç bataryayla uyumlu", "Hamam köşesi kurulumuna uygun"],
    images: ["p25-1"]
  },
  {
    id: "p26", cat: "kurna", name: "Oniks Hamam Kurnası",
    stone: "Oniks", finish: "Parlak cila",
    summary: "Işık geçirgen oniks taşından, renk geçişleri belirgin kurna.",
    desc: "Oniks taşının yarı saydam yapısı ve bal tonlarından beyaza uzanan renk geçişleri, kurnayı hamamın en dikkat çekici detayı yapar. Arkadan aydınlatmalı nişlerde ayrı bir görsel etki yaratır.",
    features: ["Işık geçirgen oniks", "Zengin renk geçişleri", "Niş içi montaja uygun"],
    images: ["p26-1", "p26-2"]
  },
  {
    id: "p27", cat: "lavabo", name: "Oniks Kase Lavabo",
    stone: "Oniks", finish: "Parlak cila",
    summary: "Şeftali ve krem tonlarında, yuvarlak formlu oniks lavabo.",
    desc: "Kase formundaki bu lavabo, oniksin şeftali, pembe ve krem tonlarını iç ve dış yüzeyde kesintisiz sergiler. Tezgah üzerinde hem işlevsel hem de dekoratif bir obje gibi durur.",
    features: ["Yuvarlak kase formu", "Sıcak pastel tonlar", "Tezgah üstü montaj"],
    images: ["p27-1", "p27-2", "p27-3"]
  },
  {
    id: "p28", cat: "kurna", name: "Osmanlı Aynalı Beyaz Kurna",
    stone: "Beyaz Mermer", finish: "El oyması",
    summary: "Ayna taşı detaylı, Osmanlı süslemeli prestij kurna modeli.",
    desc: "Arka panelindeki ayna taşı ve oymalı süslemeler, saray hamamlarının ihtişamını günümüz banyolarına taşır. Prestijli konut ve otel projelerinde imza parça olarak tercih edilir.",
    features: ["Ayna taşlı arka panel", "Osmanlı motifli oyma", "Prestij projeler için"],
    images: ["p28-1", "p28-2"]
  },
  {
    id: "p29", cat: "dekor", name: "Ayaklı Traverten Kase",
    stone: "Traverten", finish: "Honlu (mat)",
    summary: "Masa ortası ve sunum için ayaklı, sade formlu traverten kase.",
    desc: "Yemek masasında meyve kasesi, konsolda dekor objesi ya da otel lobisinde sunum kabı olarak kullanılabilir. Yalın çizgileri her dekor tarzına kolayca eşlik eder.",
    features: ["Ayaklı kase formu", "Çok amaçlı kullanım", "Elde şekillendirilmiş"],
    sizes: "Yükseklik 15 cm, genişlik 26 cm",
    images: ["p29-1", "p29-2", "p29-3"]
  },
  {
    id: "p30", cat: "lavabo", name: "Altın Damarlı Mihri Lavabo",
    stone: "Doğal Taş", finish: "Parlak cila",
    summary: "Beyaz zemin üzerinde altın damarlı, tezgah üstü kase lavabo.",
    desc: "Beyaz zemindeki altın renkli damarlar, lavaboyu banyonun mücevheri haline getirir. Altın bataryalar ve sıcak aydınlatmayla birlikte kullanıldığında lüks bir otel banyosu havası yaratır.",
    features: ["Altın damar detayı", "Tezgah üstü kase form", "Parlak, kolay bakım"],
    images: ["p30-1"]
  },
  {
    id: "p31", cat: "aksesuar", name: "6 Parça Taş Banyo Seti",
    stone: "Traverten görünümlü doğal taş", finish: "Mat",
    summary: "Sabunluk, diş fırçalık ve sıvı sabunluktan oluşan 6 parçalı set.",
    desc: "Tepsi, sıvı sabunluk, diş fırçalık, sabunluk ve saklama kaplarıyla banyo tezgahını tek bir dille toparlar. Spa havası arayan banyolar ve otel odaları için ideal bir tamamlayıcıdır.",
    features: ["6 parçalı eksiksiz set", "Spa ve otel banyolarına uygun", "Nötr krem tonu"],
    images: ["p31-1"]
  },
  {
    id: "p32", cat: "lavabo", name: "Calacatta Viola Lavabo",
    stone: "Calacatta Viola Mermer", finish: "Parlak cila",
    summary: "Mor damarlı İtalyan mermerinden dikdörtgen tezgah lavabosu.",
    desc: "Beyaz zemin üzerinde güçlü bordo-mor damarlarıyla tanınan Calacatta Viola, bu lavaboda geniş yüzeylerde tüm etkisini gösterir. Banyoyu bir galeri duvarı kadar etkileyici kılmak isteyenler için.",
    features: ["İtalyan Calacatta Viola", "Geniş dikdörtgen hazne", "Altın ayaklı konsolla uyumlu"],
    images: ["p32-1", "p32-2"]
  },
  {
    id: "p33", cat: "kurna", name: "Aynalı Hamam Kurnası",
    stone: "Doğal Taş", finish: "Cilalı, ayna detaylı",
    summary: "Işığı yansıtan ayna işlemeleriyle göz alıcı kurna modeli.",
    desc: "Gövdedeki ayna işlemeleri ışığı yansıtarak hamama derinlik ve parıltı katar. Loş hamam aydınlatmasında bile kurnanın formu belirgin şekilde öne çıkar.",
    features: ["Ayna işlemeli gövde", "Işıkla canlanan yüzey", "Lüks hamam projelerine uygun"],
    images: ["p33-1"]
  },
  {
    id: "p34", cat: "kurna", name: "Osmanlı Motifli Afyon Kurna",
    stone: "Afyon Beyaz Mermer", finish: "El oyması",
    summary: "Afyon beyaz mermerinden, Osmanlı motifleriyle işlenmiş kurna.",
    desc: "Lale ve kemer motiflerinden ilham alan oymalar, Afyon beyazının saf zemininde zarif bir gölge oyunu yaratır. Tarihi dokuyu modern bir banyoya taşımak isteyenler için ideal.",
    features: ["Osmanlı motifli oyma", "Afyon beyaz mermer", "Uzun ömürlü, dayanıklı yapı"],
    images: ["p34-1", "p34-2", "p34-3"]
  },
  {
    id: "p35", cat: "kurna", name: "El Oyma Beyaz Mermer Kurna",
    stone: "Beyaz Mermer", finish: "El oyması",
    summary: "Tek bloktan oyulmuş, villa ve spa banyoları için beyaz kurna.",
    desc: "Tek parça beyaz mermerden usta elinde oyulan bu kurna, yumuşak dilimli gövdesiyle otantik bir hamam havası yaratır. Villa banyoları ve otel spa alanları için özel olarak hazırlanır.",
    features: ["Tek parça el oyması", "Dilimli gövde detayı", "Villa ve spa projelerine uygun"],
    images: ["p35-1", "p35-2"]
  },
  {
    id: "p36", cat: "kurna", name: "Afyon Grey Kurna",
    stone: "Afyon Grey Mermer", finish: "El oyması",
    summary: "Gri tonlu Afyon mermerinden, oyma detaylı lüks kurna.",
    desc: "Afyon Grey'in duman rengi zemini, oyma detaylarına derinlik kazandırır. Koyu tonlu banyolar ve doğal taş kaplı hamamlar için güçlü bir alternatiftir.",
    features: ["Gri tonlu Afyon mermeri", "Osmanlı esintili oyma", "Konut ve otel projelerine uygun"],
    images: ["p36-1", "p36-2"]
  },
  {
    id: "p37", cat: "kurna", name: "Ateş Grey Oniks Kurna",
    stone: "Ateş Grey Oniks Mermer", finish: "Parlak cila",
    summary: "Gri, kahve ve bal tonlu damarlarıyla dramatik oniks kurna.",
    desc: "Ateş Grey taşının alev dalgalarını andıran damarları, kurnanın her yüzünde farklı bir manzara sunar. Kurna veya lavabo olarak kullanılabilen çok yönlü bir model.",
    features: ["Kurna veya lavabo olarak kullanım", "Dramatik damar yapısı", "Pürüzsüz cilalı yüzey"],
    images: ["p37-1", "p37-2", "p37-3"]
  },
  {
    id: "p38", cat: "kurna", name: "El İşçiliği Mermer Kurna",
    stone: "Doğal Mermer", finish: "El oyması",
    summary: "Osmanlı hamam geleneğinden ilham alan el işçiliği mermer kurna.",
    desc: "Gövdesindeki ince oyma çizgiler, geleneksel hamam kurnalarının zarafetini sade bir dille aktarır. Modern duşakabinli banyolarda bile hamam ritüeline yer açar.",
    features: ["Geleneksel oyma detaylar", "Modern banyolara uyumlu", "Doğal mermer gövde"],
    images: ["p38-1", "p38-2"]
  },
  {
    id: "p39", cat: "dekor", name: "Dünya Küresi Karaf Seti",
    stone: "Cam, metal stant", finish: "Şeffaf cam",
    summary: "Küre formlu karaf ve harita desenli bardaklardan oluşan sunum seti.",
    desc: "Dünya küresi biçimindeki karaf, ahşap veya metal stant üzerinde dönen bir dekor objesi gibi durur. Harita desenli bardaklarla birlikte çalışma odası ve misafir köşeleri için şık bir hediye seçeneğidir.",
    features: ["Küre formlu cam karaf", "Harita desenli bardaklar", "Hediye için uygun"],
    images: ["p39-1", "p39-2"]
  }
];
